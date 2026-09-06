import json
import asyncio
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from .models import (
    Issue,
    IssueCreateRequest,
    VerificationRequest,
    ResolutionClaimRequest,
    CommunityNoteCreateRequest,
    CommunityNoteResponse,
    IssueCategory,
    IssueStatus,
    ActionType,
    EvidenceMedia
)
from .database import db
from .adapters.base import global_event_broadcaster
from .services.digipin_service import haversine_distance_meters
from .services.nullifier_service import global_nullifier_registry

def get_client_ip(request: Optional[Request]) -> str:
    if not request:
        return "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

def enforce_rate_limit(request: Optional[Request], action: str, limit_per_minute: int):
    ip = get_client_ip(request)
    if not global_nullifier_registry.check_action_rate_limit(ip, action, limit_per_minute):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {action.lower()} operations. Please wait a moment before submitting again.",
            headers={"Retry-After": "60"}
        )
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

is_prod = os.getenv("ENVIRONMENT", "").lower() == "production" or os.getenv("RENDER", "").lower() == "true"
enable_docs = os.getenv("ENABLE_DOCS", "false").lower() in ("true", "1") or not is_prod

app = FastAPI(
    title="CivicTrace API",
    description="Anonymous, community-verified civic accountability platform API with Real-time Event Streaming",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs" if enable_docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if enable_docs else None,
)

# Strict CORS origin resolution
cors_origins_raw = os.getenv("CORS_ORIGINS", "")
if cors_origins_raw and cors_origins_raw.strip() != "*":
    cors_origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]
elif not is_prod:
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
else:
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

render_ext_url = os.getenv("RENDER_EXTERNAL_URL")
if render_ext_url and render_ext_url not in cors_origins:
    cors_origins.append(render_ext_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https://.*\.onrender\.com$" if is_prod else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS", "HEAD"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    max_age=600,
)

MAX_REQUEST_BODY_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 10 * 1024 * 1024))  # 10MB limit

@app.middleware("http")
async def security_and_payload_limit_middleware(request: Request, call_next):
    # 1. Enforce payload size limit before buffering into RAM
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BODY_SIZE:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": f"Payload exceeds maximum allowed size of {MAX_REQUEST_BODY_SIZE // (1024*1024)}MB"}
                )
        except ValueError:
            pass

    response = await call_next(request)

    # 2. Strict Security Headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self)"
    if "server" in response.headers:
        del response.headers["server"]

    return response

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
async def report_issue(payload: IssueCreateRequest, request: Request = None):
    # Tiered IP rate limit (10 req/min for report)
    enforce_rate_limit(request, "REPORT", 10)

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

@app.get("/api/v1/issues/{issue_id}/notes", response_model=List[CommunityNoteResponse])
async def list_community_notes(issue_id: str):
    issue = await db.get_by_id(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail=f"Issue '{issue_id}' not found")
    raw_notes = await db.get_community_notes(issue_id)
    return [
        CommunityNoteResponse(
            id=n["id"],
            issue_id=n["issue_id"],
            participant_badge=n["participant_badge"],
            stance=n.get("stance", "NEUTRAL"),
            is_consensus_verified=bool(n.get("is_consensus_verified", False)),
            text=n["text"],
            media_urls=n.get("media_urls") or [],
            created_at=n["created_at"]
        )
        for n in raw_notes
    ]

@app.post("/api/v1/issues/{issue_id}/notes", status_code=status.HTTP_201_CREATED, response_model=CommunityNoteResponse)
async def add_community_note(
    issue_id: str,
    payload: CommunityNoteCreateRequest,
    request: Request = None
):
    # 1. IP Burst Rate Limiting (ADR 0014, ADR 0015)
    enforce_rate_limit(request, "NOTE", 30)

    # 2. Ingest through deep Intake Module
    public_note, updated_issue = await intake_service.process_attestation_note(issue_id, payload)

    # 3. Real-time event broadcasts
    if updated_issue:
        await global_event_broadcaster.broadcast("ISSUE_VERIFIED", {
            "id": updated_issue.id,
            "status": updated_issue.status.value if hasattr(updated_issue.status, 'value') else updated_issue.status,
            "consensus_score": updated_issue.consensus_score,
            "verified_confirm_count": updated_issue.verified_confirm_count,
            "verified_dispute_count": updated_issue.verified_dispute_count,
            "evidence_list": [e.model_dump() if hasattr(e, 'model_dump') else e.__dict__ for e in updated_issue.evidence_list]
        })

    await global_event_broadcaster.broadcast("NOTE_ADDED", public_note)
    return public_note

@app.post("/api/v1/issues/{issue_id}/verify")
async def verify_issue(issue_id: str, payload: VerificationRequest, request: Request = None):
    # Tiered IP rate limit (30 req/min for verify)
    enforce_rate_limit(request, "VERIFY", 30)

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
async def claim_resolution(issue_id: str, payload: ResolutionClaimRequest, request: Request = None):
    # Tiered IP rate limit (5 req/min for claim)
    enforce_rate_limit(request, "CLAIM", 5)

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
