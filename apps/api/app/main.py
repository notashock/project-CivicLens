import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .models import (
    Issue,
    IssueCreateRequest,
    VerificationRequest,
    ResolutionClaimRequest,
    CommunityNoteCreateRequest,
    IssueCategory,
    IssueStatus,
    ActionType,
    EvidenceMedia
)
from .database import db
from .adapters.base import global_event_broadcaster
from .services.digipin_service import haversine_distance_meters
from .services.nullifier_service import global_nullifier_registry
from .services.intake_service import intake_service
from .services.neutrality_filter import neutrality_filter
from .state_machine import transition_issue_state

import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB adapter if Postgres
    if hasattr(db, "initialize"):
        try:
            await db.initialize()
        except Exception as e:
            print(f"Warning: Database initialization error: {e}")
    yield
    if hasattr(db, "close"):
        try:
            await db.close()
        except Exception as e:
            print(f"Warning: Database shutdown error: {e}")

app = FastAPI(
    title="CivicTrace API",
    description="Anonymous, community-verified civic accountability platform API with Real-time Event Streaming",
    version="1.1.0",
    lifespan=lifespan
)

cors_origins_raw = os.getenv("CORS_ORIGINS", "*")
cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()] if cors_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    from apps.api.app.adapters.postgres_adapter import PostgresDatabaseAdapter
    is_postgres = isinstance(db, PostgresDatabaseAdapter)
    db_status = "connected" if (getattr(db, "_pool", None) is not None if is_postgres else True) else "disconnected"
    return {
        "status": "healthy",
        "service": "civictrace-core-api",
        "database": {
            "type": "postgresql" if is_postgres else "in_memory",
            "status": db_status
        },
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/ready")
async def readiness_check():
    from apps.api.app.adapters.postgres_adapter import PostgresDatabaseAdapter
    is_postgres = isinstance(db, PostgresDatabaseAdapter)
    db_ready = (getattr(db, "_pool", None) is not None) if is_postgres else True
    if not db_ready:
        raise HTTPException(status_code=503, detail="Database connection not ready")
    return {
        "status": "ready",
        "service": "civictrace-core-api",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/api/v1/issues")
async def list_issues(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    issues = await db.get_all(category=category, status=status)
    return issues

@app.get("/api/v1/issues/{issue_id}")
async def get_issue(issue_id: str):
    issue = await db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")
    return issue

@app.get("/api/v1/geojson")
async def get_geojson_layer(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    issues = await db.get_all(category=category, status=status)
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
    # Neutrality and defamation validation on initial report
    is_valid, error_msg = neutrality_filter.validate_submission(
        text=f"{payload.observed_condition} {payload.landmark}",
        media_list=[payload.media_data_base64] if payload.media_data_base64 else None
    )
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)

    issue, is_new = await intake_service.process_report(payload)
    if is_new:
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
    else:
        await global_event_broadcaster.broadcast("ISSUE_VERIFIED", {
            "id": issue.id,
            "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
            "consensus_score": issue.consensus_score,
            "verified_confirm_count": issue.verified_confirm_count,
            "verified_dispute_count": issue.verified_dispute_count,
        })
    return issue

@app.get("/api/v1/issues/{issue_id}/notes")
async def list_community_notes(issue_id: str):
    issue = await db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")
    return await db.get_community_notes(issue_id)

@app.post("/api/v1/issues/{issue_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_community_note(
    issue_id: str,
    payload: CommunityNoteCreateRequest,
    request: Request = None
):
    issue = await db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")

    # 1. IP Burst Rate Limiting (ADR 0014)
    client_ip = request.client.host if (request and request.client) else "127.0.0.1"
    if not global_nullifier_registry.check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before submitting another update."
        )

    # 2. Validation: Empty check
    stance = (payload.stance or "NEUTRAL").upper()
    if not payload.text.strip() and stance == "NEUTRAL" and not payload.media_urls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Community note must contain text narrative, an attestation stance, or an evidence photo."
        )

    # 3. Content Moderation: Dual-tier neutrality & image OCR inspection
    if payload.text and payload.text.strip():
        is_valid, error_msg = neutrality_filter.validate_submission(
            text=payload.text,
            media_list=payload.media_urls
        )
        if not is_valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)
    elif payload.media_urls:
        for idx, img_b64 in enumerate(payload.media_urls):
            img_error = neutrality_filter.validate_image_ocr(img_b64)
            if img_error:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Evidence photo #{idx + 1}: {img_error}")

    now = datetime.utcnow()
    now_ms = int(now.timestamp() * 1000)
    badge = payload.participant_badge or f"Witness [{hex(now_ms)[-4:].upper()}]"

    # 4. 15-Minute Stance Change Cooldown & Hardware Nullifier Checks (ADR 0014)
    if payload.nullifier_hash and stance != "NEUTRAL":
        can_change, remaining_sec = global_nullifier_registry.can_update_stance(
            issue_id=issue_id,
            nullifier_hash=payload.nullifier_hash,
            new_stance=stance,
            cooldown_seconds=900
        )
        if not can_change:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Attestation stance change on cooldown. Next stance update available in {max(1, remaining_sec // 60)} minutes."
            )

    # 5. Spatial Proximity Check (<500m of DIGIPIN Centroid) for Consensus Quorum (ADR 0014)
    is_consensus_verified = False
    if payload.lat is not None and payload.lon is not None:
        dist_m = haversine_distance_meters(payload.lat, payload.lon, issue.lat, issue.lon)
        if dist_m <= 500.0:
            is_consensus_verified = True

    # 6. Process Consensus Quorum & Evidence Promotion if Physically Verified
    if is_consensus_verified and stance != "NEUTRAL" and payload.nullifier_hash:
        prev_stance = global_nullifier_registry.record_action(issue_id, payload.nullifier_hash, stance)

        # If flipping stance, decrement previous tally
        if prev_stance:
            if prev_stance in ["CONFIRM", "RESOLUTION_VERIFY"]:
                issue.verified_confirm_count = max(0, issue.verified_confirm_count - 1)
            elif prev_stance in ["DISPUTE", "RESOLUTION_DISPUTE"]:
                issue.verified_dispute_count = max(0, issue.verified_dispute_count - 1)

        action_map = {
            "CONFIRM": ActionType.CONFIRM,
            "DISPUTE": ActionType.DISPUTE,
            "RESOLUTION_VERIFY": ActionType.RESOLUTION_VERIFY,
            "RESOLUTION_DISPUTE": ActionType.RESOLUTION_DISPUTE
        }
        act = action_map.get(stance, ActionType.CONFIRM)
        issue, state_event = transition_issue_state(
            issue=issue,
            action=act,
            has_photo_evidence=bool(payload.media_urls)
        )
        if state_event:
            issue.timeline.append(state_event)

        # Promote verified witness photo(s) to primary Issue Evidence Gallery
        if payload.media_urls:
            for idx, media_url in enumerate(payload.media_urls):
                promoted_item = EvidenceMedia(
                    id=f"EVD-PROM-{issue_id}-{now_ms}-{idx}",
                    issue_id=issue_id,
                    media_url=media_url,
                    is_sanitized=True,
                    is_verified=True,
                    stance=stance,
                    created_at=now
                )
                issue.evidence_list.append(promoted_item)

        await db.save(issue)

        # Broadcast real-time consensus & evidence update
        await global_event_broadcaster.broadcast("ISSUE_VERIFIED", {
            "id": issue.id,
            "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
            "consensus_score": issue.consensus_score,
            "verified_confirm_count": issue.verified_confirm_count,
            "verified_dispute_count": issue.verified_dispute_count,
            "evidence_list": [e.model_dump() if hasattr(e, 'model_dump') else e.__dict__ for e in issue.evidence_list]
        })

    # 7. Save Note record
    note_data = {
        "id": f"NOTE-{issue_id}-{now_ms}",
        "issue_id": issue_id,
        "participant_badge": badge,
        "stance": stance,
        "is_consensus_verified": is_consensus_verified,
        "nullifier_hash": payload.nullifier_hash,
        "lat": payload.lat,
        "lon": payload.lon,
        "text": payload.text.strip(),
        "media_urls": payload.media_urls,
        "created_at": now.isoformat()
    }

    saved = await db.save_community_note(note_data)

    # Real-time event broadcast to all viewing clients
    await global_event_broadcaster.broadcast("NOTE_ADDED", saved)
    return saved

@app.post("/api/v1/issues/{issue_id}/verify")
async def verify_issue(issue_id: str, payload: VerificationRequest):
    issue = await intake_service.process_verification(issue_id, payload)
    await global_event_broadcaster.broadcast("ISSUE_VERIFIED", {
        "id": issue.id,
        "status": issue.status.value if hasattr(issue.status, 'value') else issue.status,
        "consensus_score": issue.consensus_score,
        "verified_confirm_count": issue.verified_confirm_count,
        "verified_dispute_count": issue.verified_dispute_count,
    })
    return issue

@app.post("/api/v1/issues/{issue_id}/claim-resolution")
async def claim_resolution(issue_id: str, payload: ResolutionClaimRequest):
    issue = await intake_service.process_resolution_claim(issue_id, payload)
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
    issues = await db.get_all()
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
