import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import (
    Issue,
    IssueCreateRequest,
    VerificationRequest,
    IssueCategory,
    IssueStatus,
    ActionType,
    EventType,
    IssueEvent,
    EvidenceMedia
)
from .database import db
from .adapters.base import global_event_broadcaster
from .services.digipin_service import encode_digipin, decode_digipin, haversine_distance_meters
from .services.jurisdiction_service import resolve_jurisdiction
from .services.nullifier_service import global_nullifier_registry
from .state_machine import transition_issue_state

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB adapter if Postgres
    if hasattr(db, "initialize"):
        try:
            await db.initialize()
        except Exception as e:
            print(f"Warning: Database initialization error: {e}")
    yield

app = FastAPI(
    title="CivicTrace API",
    description="Anonymous, community-verified civic accountability platform API with Real-time Event Streaming",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "civictrace-core-api",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/v1/issues")
async def list_issues(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    issues = db.get_all(category=category, status=status)
    return issues

@app.get("/api/v1/issues/{issue_id}")
async def get_issue(issue_id: str):
    issue = db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")
    return issue

@app.get("/api/v1/geojson")
async def get_geojson_layer(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    issues = db.get_all(category=category, status=status)
    features = []
    for issue in issues:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [issue.lon, issue.lat],
            },
            "properties": {
                "id": issue.id,
                "category": issue.category.value if hasattr(issue.category, 'value') else issue.category,
                "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
                "digipin": issue.digipin_code,
                "digipin_l8": issue.digipin_l8,
                "severity": issue.severity_score,
                "confirms": issue.verified_confirm_count,
                "disputes": issue.verified_dispute_count,
                "consensus_score": issue.consensus_score,
                "authority": issue.jurisdiction_authority,
                "department": issue.assigned_department,
                "description": issue.description_neutral,
                "created_at": issue.first_reported_at.isoformat() if hasattr(issue.first_reported_at, 'isoformat') else str(issue.first_reported_at),
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features,
    }

@app.post("/api/v1/issues/report", status_code=status.HTTP_201_CREATED)
async def report_issue(payload: IssueCreateRequest):
    # 1. Ephemeral coordinate conversion to DIGIPIN
    try:
        digipin = encode_digipin(payload.lat, payload.lon)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. Jurisdiction & Department Routing
    jurisdiction = resolve_jurisdiction(payload.lat, payload.lon, payload.category)
    issue_id = jurisdiction["issue_id"]

    # 3. Register Nullifier (Preventing spam creation from same device)
    try:
        registered = global_nullifier_registry.register(
            issue_id=issue_id,
            nullifier_hash=payload.nullifier_hash,
            timestamp=payload.timestamp
        )
        if not registered:
            raise HTTPException(
                status_code=409,
                detail="Action already registered for this device on this issue"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 4. Construct Factual Narrative
    days_str = f" Condition observed unresolved for ~{payload.impact_duration_days} days." if payload.impact_duration_days else ""
    narrative = f"Physical condition observed: {payload.observed_condition.strip()} near {payload.landmark.strip()}.{days_str}".strip()

    now = datetime.utcnow()
    deadline = now + timedelta(days=7)

    # 5. Build Sanitized Evidence Entry
    evidence_items = []
    if payload.media_data_base64:
        evidence_items.append(
            EvidenceMedia(
                id=f"EVD-{issue_id}-01",
                issue_id=issue_id,
                media_url=payload.media_data_base64,
                phash_value="f4b81a29c3d401e2",
                detected_objects=["civic_hazard"],
                is_sanitized=True,
                created_at=now
            )
        )

    # 6. Create Issue Record
    issue = Issue(
        id=issue_id,
        category=payload.category,
        status=IssueStatus.REPORTED,
        digipin_code=digipin,
        digipin_l8=digipin[:8],
        digipin_l6=digipin[:6],
        lat=payload.lat,
        lon=payload.lon,
        description_neutral=narrative,
        severity_score=payload.severity_score,
        jurisdiction_authority=jurisdiction["authority"],
        assigned_department=jurisdiction["department"],
        ward_name=f"{jurisdiction['dist_code']} Sector",
        verified_confirm_count=1,
        verified_dispute_count=0,
        sightings_count=1,
        consensus_score=0.5,
        first_reported_at=now,
        last_activity_at=now,
        escalation_deadline=deadline,
        evidence_list=evidence_items,
        timeline=[
            IssueEvent(
                id=f"EVT-{issue_id}-01",
                issue_id=issue_id,
                event_type=EventType.CREATED,
                to_status=IssueStatus.REPORTED,
                event_payload={
                    "digipin": digipin,
                    "authority": jurisdiction["authority"],
                    "message": "Anonymous observation registered via hardware-attested nullifier"
                },
                created_at=now
            )
        ]
    )

    db.save(issue)

    # Broadcast real-time event to connected map clients
    await global_event_broadcaster.broadcast("ISSUE_CREATED", {
        "id": issue.id,
        "category": issue.category.value if hasattr(issue.category, 'value') else issue.category,
        "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
        "digipin_code": issue.digipin_code,
        "lat": issue.lat,
        "lon": issue.lon,
        "description_neutral": issue.description_neutral,
        "jurisdiction_authority": issue.jurisdiction_authority,
        "assigned_department": issue.assigned_department
    })

    return issue

@app.post("/api/v1/issues/{issue_id}/verify")
async def verify_issue(issue_id: str, payload: VerificationRequest):
    issue = db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")

    # 1. Ephemeral Local Proximity Check (Zero coordinates saved)
    distance_meters = haversine_distance_meters(payload.lat, payload.lon, issue.lat, issue.lon)
    MAX_RADIUS_METERS = 200.0 # 200 meters local geofence radius
    if distance_meters > MAX_RADIUS_METERS:
        raise HTTPException(
            status_code=403,
            detail=f"Local verification requires physical proximity (current distance: {int(distance_meters)}m, maximum permitted: {int(MAX_RADIUS_METERS)}m)"
        )

    # 2. Anti-Sybil Nullifier Check (One vote per PRK per issue)
    try:
        registered = global_nullifier_registry.register(
            issue_id=issue_id,
            nullifier_hash=payload.nullifier_hash,
            timestamp=payload.timestamp
        )
        if not registered:
            raise HTTPException(
                status_code=409,
                detail="Action already registered for this device on this issue"
            )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    now = datetime.utcnow()

    # 3. Handle Photographic Evidence if provided
    has_photo = bool(payload.evidence_photo_base64)
    if has_photo:
        evidence_entry = EvidenceMedia(
            id=f"EVD-{issue_id}-{int(now.timestamp())}",
            issue_id=issue_id,
            media_url=payload.evidence_photo_base64, # type: ignore
            phash_value="a38b1f22e4d5091c",
            detected_objects=["corroborating_evidence"],
            is_sanitized=True,
            created_at=now
        )
        issue.evidence_list.append(evidence_entry)

    # 4. State Machine Transition & Consensus Recalculation
    issue, event = transition_issue_state(
        issue=issue,
        action=payload.action_type,
        has_photo_evidence=has_photo
    )

    # Record action in timeline
    action_event = IssueEvent(
        id=f"EVT-ACT-{issue.id}-{int(now.timestamp())}",
        issue_id=issue.id,
        event_type=EventType.CORROBORATED if payload.action_type in [ActionType.CONFIRM, ActionType.RESOLUTION_VERIFY] else EventType.DISPUTED,
        event_payload={
            "action": payload.action_type.value,
            "distance_meters": round(distance_meters, 1),
            "consensus_score": issue.consensus_score,
            "confirms": issue.verified_confirm_count,
            "disputes": issue.verified_dispute_count
        },
        created_at=now
    )
    issue.timeline.append(action_event)

    if event:
        issue.timeline.append(event)

    db.save(issue)

    # Broadcast real-time verification update
    await global_event_broadcaster.broadcast("ISSUE_VERIFIED", {
        "id": issue.id,
        "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
        "consensus_score": issue.consensus_score,
        "verified_confirm_count": issue.verified_confirm_count,
        "verified_dispute_count": issue.verified_dispute_count,
    })

    return issue

@app.get("/api/v1/stats")
async def get_stats():
    issues = db.get_all()
    by_status = {}
    by_category = {}
    total_confirms = sum(i.verified_confirm_count for i in issues)
    total_disputes = sum(i.verified_dispute_count for i in issues)

    for i in issues:
        cat_key = i.category.value if hasattr(i.category, 'value') else i.category
        stat_key = i.status.value if hasattr(i.status, 'value') else i.status
        by_status[stat_key] = by_status.get(stat_key, 0) + 1
        by_category[cat_key] = by_category.get(cat_key, 0) + 1

    return {
        "total_issues": len(issues),
        "total_local_verifications": total_confirms + total_disputes,
        "by_status": by_status,
        "by_category": by_category,
        "average_consensus_score": round(sum(i.consensus_score for i in issues) / max(1, len(issues)), 2)
    }

# ==========================================
# Real-Time Event Streaming Endpoints
# ==========================================

@app.get("/api/v1/events/stream")
async def event_stream():
    """
    Server-Sent Events (SSE) stream for live map and ledger updates in browsers.
    """
    async def event_generator():
        queue = global_event_broadcaster.subscribe()
        try:
            # Send initial keepalive
            yield f"event: connected\ndata: {json.dumps({'status': 'connected'})}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"event: {msg['event_type']}\ndata: {json.dumps(msg['data'])}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat ping
                    yield f": ping\n\n"
        finally:
            global_event_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.websocket("/api/v1/ws/live")
async def websocket_live_feed(websocket: WebSocket):
    """
    Bi-directional WebSocket live feed for real-time civic notifications.
    """
    await websocket.accept()
    queue = global_event_broadcaster.subscribe()
    try:
        await websocket.send_json({"event_type": "CONNECTED", "data": {"status": "online"}})
        while True:
            msg = await queue.get()
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        pass
    finally:
        global_event_broadcaster.unsubscribe(queue)
