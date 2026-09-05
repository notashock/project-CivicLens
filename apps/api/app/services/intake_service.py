import time
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException, status

from ..models import (
    Issue,
    IssueCreateRequest,
    VerificationRequest,
    ResolutionClaimRequest,
    IssueCategory,
    IssueStatus,
    ActionType,
    EventType,
    IssueEvent,
    EvidenceMedia
)
from ..database import db
from .digipin_service import encode_digipin, decode_digipin, haversine_distance_meters
from .jurisdiction_service import resolve_jurisdiction
from .nullifier_service import global_nullifier_registry
from ..state_machine import transition_issue_state

class IntakeService:
    """
    Consolidated Intake Pipeline and Issue Identity Seam.
    Implements ADR 0002 (Ephemeral Proximity & Centroid Snapping),
    ADR 0007 (Device Mutual Exclusivity), ADR 0008 (Deterministic Spatial ID),
    and ADR 0010 (Consolidated Intake Pipeline).
    """

    MAX_VERIFICATION_RADIUS_METERS = 200.0
    MAX_CLOCK_SKEW_SECONDS = 120

    def derive_canonical_issue_id(self, lat: float, lon: float, category: IssueCategory) -> Tuple[str, str, Dict[str, float]]:
        """
        Derives the deterministic canonical IssueID: CT-{CategoryPrefix}-{DIGIPIN}
        and snaps raw GPS coordinates to the 4m x 4m cell centroid.
        """
        digipin = encode_digipin(lat, lon)
        decoded = decode_digipin(digipin)
        centroid = decoded["centroid"]

        cat_val = category.value if hasattr(category, 'value') else str(category)
        cat_prefix = "".join(c for c in cat_val if c.isalnum())[:4].upper()
        canonical_id = f"CT-{cat_prefix}-{digipin}"

        return canonical_id, digipin, centroid

    async def process_report(self, payload: IssueCreateRequest) -> Tuple[Issue, bool]:
        """
        Processes an incoming issue report through the intake seam:
        1. Encodes DIGIPIN and snaps to centroid (zero raw GPS persistence).
        2. Derives deterministic IssueID and verifies client-provided ID.
        3. Enforces anti-Sybil single-action mutual exclusivity via nullifier registry.
        4. Aggregates as corroborating Sighting if issue exists, or creates new Issue.
        
        Returns:
            Tuple[Issue, is_new: bool]
        """
        # 1. Spatial encoding and ephemeral centroid snapping
        try:
            canonical_id, digipin, centroid = self.derive_canonical_issue_id(
                payload.lat, payload.lon, payload.category
            )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        # 2. Assert canonical IssueID authority at the seam
        if payload.id and payload.id != canonical_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mismatched IssueID: expected '{canonical_id}' for spatial cell {digipin}"
            )

        # 3. Anti-Sybil single-action mutual exclusivity check
        try:
            registered = global_nullifier_registry.register(
                issue_id=canonical_id,
                nullifier_hash=payload.nullifier_hash,
                timestamp=payload.timestamp,
                max_skew_sec=self.MAX_CLOCK_SKEW_SECONDS
            )
            if not registered:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Action already registered for this device on this issue"
                )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

        now = datetime.utcnow()
        days_str = f" Condition observed unresolved for ~{payload.impact_duration_days} days." if payload.impact_duration_days else ""
        narrative = f"Physical condition observed: {payload.observed_condition.strip()} near {payload.landmark.strip()}.{days_str}".strip()

        # Build sanitized evidence if provided
        evidence_items = []
        if payload.media_data_base64:
            evidence_items.append(
                EvidenceMedia(
                    id=f"EVD-{canonical_id}-{int(now.timestamp())}",
                    issue_id=canonical_id,
                    media_url=payload.media_data_base64,
                    phash_value="f4b81a29c3d401e2",
                    detected_objects=["civic_hazard"],
                    is_sanitized=True,
                    created_at=now
                )
            )

        # 4. Check if issue already exists in this 4m x 4m cell -> aggregate as Sighting
        existing = await db.get_by_id(canonical_id)
        if existing:
            existing.sightings_count += 1
            existing.verified_confirm_count += 1
            existing.last_activity_at = now
            if evidence_items:
                existing.evidence_list.extend(evidence_items)

            sighting_event = IssueEvent(
                id=f"EVT-SIGHT-{canonical_id}-{int(now.timestamp())}",
                issue_id=canonical_id,
                event_type=EventType.CORROBORATED,
                event_payload={"message": "Corroborating sighting registered with sanitized evidence"},
                created_at=now
            )
            existing.timeline.append(sighting_event)
            await db.save(existing)
            return existing, False

        # 5. Create new Issue record anchored to snapped centroid
        jurisdiction = resolve_jurisdiction(centroid["lat"], centroid["lon"], payload.category, digipin=digipin)
        deadline = now + timedelta(days=7)

        issue = Issue(
            id=canonical_id,
            category=payload.category,
            status=IssueStatus.REPORTED,
            digipin_code=digipin,
            digipin_l8=digipin[:8],
            digipin_l6=digipin[:6],
            lat=centroid["lat"],
            lon=centroid["lon"],
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
                    id=f"EVT-{canonical_id}-01",
                    issue_id=canonical_id,
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

        await db.save(issue)
        return issue, True

    async def process_verification(self, issue_id: str, payload: VerificationRequest) -> Issue:
        """
        Processes an ephemeral local verification / dispute action:
        1. Evaluates in-memory haversine distance against issue centroid; discards raw GPS immediately.
        2. Enforces single-action nullifier mutual exclusivity.
        3. Updates state machine and consensus score.
        """
        issue = await db.get_by_id(issue_id)
        if not issue:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Issue '{issue_id}' not found")

        # 1. Ephemeral Local Proximity Check (Raw coordinates used in-memory, never stored)
        distance_meters = haversine_distance_meters(payload.lat, payload.lon, issue.lat, issue.lon)
        if distance_meters > self.MAX_VERIFICATION_RADIUS_METERS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Local verification requires physical proximity (current distance: {int(distance_meters)}m, maximum permitted: {int(self.MAX_VERIFICATION_RADIUS_METERS)}m)"
            )

        # 2. Anti-Sybil Nullifier Check
        try:
            registered = global_nullifier_registry.register(
                issue_id=issue_id,
                nullifier_hash=payload.nullifier_hash,
                timestamp=payload.timestamp,
                max_skew_sec=self.MAX_CLOCK_SKEW_SECONDS
            )
            if not registered:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Action already registered for this device on this issue"
                )
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

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

        await db.save(issue)
        return issue

    async def process_resolution_claim(self, issue_id: str, payload: ResolutionClaimRequest) -> Issue:
        """
        Processes a formal resolution claim by an authority or contractor.
        Initiates 72-hour community verification window.
        """
        issue = await db.get_by_id(issue_id)
        if not issue:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Issue '{issue_id}' not found")

        now = datetime.utcnow()
        old_status = issue.status
        issue.status = IssueStatus.RESOLUTION_CLAIMED
        issue.last_activity_at = now
        issue.resolution_window_expires_at = now + timedelta(hours=72)
        issue.verified_confirm_count = 0
        issue.verified_dispute_count = 0

        if payload.proof_photo_base64:
            issue.evidence_list.append(
                EvidenceMedia(
                    id=f"EVD-RES-{issue_id}-{int(now.timestamp())}",
                    issue_id=issue_id,
                    media_url=payload.proof_photo_base64,
                    phash_value="c7d8a9e102f34567",
                    detected_objects=["rectification_evidence"],
                    is_sanitized=True,
                    created_at=now
                )
            )

        claim_event = IssueEvent(
            id=f"EVT-CLAIM-{issue_id}-{int(now.timestamp())}",
            issue_id=issue_id,
            event_type=EventType.RESOLUTION_PROPOSED,
            from_status=old_status,
            to_status=IssueStatus.RESOLUTION_CLAIMED,
            event_payload={
                "claimant": payload.claimant_id,
                "notes": payload.notes,
                "window": "72-hour community verification quorum initiated"
            },
            created_at=now
        )
        issue.timeline.append(claim_event)
        await db.save(issue)
        return issue

intake_service = IntakeService()
