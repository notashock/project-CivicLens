import time
from datetime import datetime
import pytest
from fastapi import HTTPException

from apps.api.app.models import (
    IssueCreateRequest,
    VerificationRequest,
    ResolutionClaimRequest,
    IssueCategory,
    IssueStatus,
    ActionType
)
from apps.api.app.services.intake_service import intake_service
from apps.api.app.services.digipin_service import decode_digipin, encode_digipin
from apps.api.app.services.nullifier_service import global_nullifier_registry
from apps.api.app.database import db

@pytest.fixture(autouse=True)
def reset_state():
    db.seed_initial_data()
    global_nullifier_registry.clear()

def test_derive_canonical_issue_id():
    lat = 12.9715987
    lon = 77.5945632
    canonical_id, digipin, centroid = intake_service.derive_canonical_issue_id(
        lat, lon, IssueCategory.ROAD_HAZARD
    )
    assert canonical_id.startswith("CT-ROAD-")
    assert len(digipin) == 10
    assert canonical_id == f"CT-ROAD-{digipin}"
    assert isinstance(centroid["lat"], float)
    assert isinstance(centroid["lon"], float)

@pytest.mark.asyncio
async def test_ephemeral_centroid_snapping_storage():
    raw_lat = 12.95628192837
    raw_lon = 77.70191827364
    expected_digipin = encode_digipin(raw_lat, raw_lon)
    expected_centroid = decode_digipin(expected_digipin)["centroid"]

    nullifier = "f" * 64
    payload = IssueCreateRequest(
        category=IssueCategory.DRAINAGE_WATER,
        observed_condition="Blocked stormwater drain overflowing onto road",
        landmark="Near Tech Park Gate 2",
        impact_duration_days=3,
        lat=raw_lat,
        lon=raw_lon,
        severity_score=4,
        nullifier_hash=nullifier,
        timestamp=int(time.time() * 1000)
    )

    issue, is_new = await intake_service.process_report(payload)
    assert is_new is True
    assert issue.id == f"CT-DRAI-{expected_digipin}"
    assert issue.lat == expected_centroid["lat"]
    assert issue.lon == expected_centroid["lon"]
    # Verify raw coordinates are not persisted
    assert issue.lat != raw_lat
    assert issue.lon != raw_lon

@pytest.mark.asyncio
async def test_mismatched_client_issue_id_rejected():
    lat = 12.9716
    lon = 77.5946
    nullifier = "e" * 64
    payload = IssueCreateRequest(
        id="CT-SPOOFED-000000",
        category=IssueCategory.ELECTRICAL_HAZARD,
        observed_condition="Non-functioning streetlight pole",
        landmark="Corner cross",
        lat=lat,
        lon=lon,
        severity_score=2,
        nullifier_hash=nullifier,
        timestamp=int(time.time() * 1000)
    )

    with pytest.raises(HTTPException) as exc_info:
        await intake_service.process_report(payload)
    assert exc_info.value.status_code == 400
    assert "Mismatched IssueID" in exc_info.value.detail

@pytest.mark.asyncio
async def test_anti_sybil_single_action_per_issue():
    lat = 28.6139
    lon = 77.2090
    nullifier = "c" * 64
    now_ms = int(time.time() * 1000)

    payload1 = IssueCreateRequest(
        category=IssueCategory.SOLID_WASTE,
        observed_condition="Large uncollected garbage heap",
        landmark="Behind bus shelter",
        lat=lat,
        lon=lon,
        severity_score=3,
        nullifier_hash=nullifier,
        timestamp=now_ms
    )

    issue, is_new = await intake_service.process_report(payload1)
    assert is_new is True

    # Same device attempts to report again on the same cell/issue
    payload2 = IssueCreateRequest(
        category=IssueCategory.SOLID_WASTE,
        observed_condition="Still uncollected garbage heap",
        landmark="Behind bus shelter",
        lat=lat,
        lon=lon,
        severity_score=3,
        nullifier_hash=nullifier,
        timestamp=now_ms + 1000
    )

    with pytest.raises(HTTPException) as exc_info:
        await intake_service.process_report(payload2)
    assert exc_info.value.status_code == 409
    assert "already registered" in exc_info.value.detail

@pytest.mark.asyncio
async def test_clock_skew_rejection():
    lat = 13.0827
    lon = 80.2707
    skewed_timestamp = int((time.time() - 300) * 1000) # 5 minutes ago (skew > 120s)

    payload = IssueCreateRequest(
        category=IssueCategory.ROAD_HAZARD,
        observed_condition="Damaged median barrier",
        landmark="Opposite railway station",
        lat=lat,
        lon=lon,
        severity_score=3,
        nullifier_hash="b" * 64,
        timestamp=skewed_timestamp
    )

    with pytest.raises(HTTPException) as exc_info:
        await intake_service.process_report(payload)
    assert exc_info.value.status_code == 400
    assert "acceptable replay window" in exc_info.value.detail

@pytest.mark.asyncio
async def test_sighting_aggregation_for_distinct_witnesses():
    lat = 19.0760
    lon = 72.8777
    now_ms = int(time.time() * 1000)

    # First reporter (Witness 1)
    payload1 = IssueCreateRequest(
        category=IssueCategory.DRAINAGE_WATER,
        observed_condition="Burst water main flooding sidewalk",
        landmark="Near metro pillar 45",
        lat=lat,
        lon=lon,
        severity_score=4,
        nullifier_hash="11" * 32,
        timestamp=now_ms
    )
    issue1, is_new1 = await intake_service.process_report(payload1)
    assert is_new1 is True
    assert issue1.sightings_count == 1
    assert issue1.verified_confirm_count == 1

    # Second reporter (Witness 2 with distinct nullifier) in the same cell
    payload2 = IssueCreateRequest(
        category=IssueCategory.DRAINAGE_WATER,
        observed_condition="Water still gushing across sidewalk",
        landmark="Near metro pillar 45",
        lat=lat,
        lon=lon,
        severity_score=4,
        nullifier_hash="22" * 32,
        timestamp=now_ms + 500
    )
    issue2, is_new2 = await intake_service.process_report(payload2)
    assert is_new2 is False
    assert issue2.id == issue1.id
    assert issue2.sightings_count == 2
    assert issue2.verified_confirm_count == 2

@pytest.mark.asyncio
async def test_verification_proximity_radius_enforcement():
    # Issue at Bengaluru (12.9716, 77.5946)
    issue_id = "CT-KA-BLR-000101"

    # Within 200m (e.g. ~30m away)
    valid_verification = VerificationRequest(
        action_type=ActionType.CONFIRM,
        nullifier_hash="99" * 32,
        timestamp=int(time.time() * 1000),
        lat=12.9718,
        lon=77.5947
    )
    updated = await intake_service.process_verification(issue_id, valid_verification)
    assert updated.id == issue_id

    # Outside 200m (e.g. 5km away)
    far_verification = VerificationRequest(
        action_type=ActionType.CONFIRM,
        nullifier_hash="88" * 32,
        timestamp=int(time.time() * 1000),
        lat=13.0200,
        lon=77.5946
    )
    with pytest.raises(HTTPException) as exc_info:
        await intake_service.process_verification(issue_id, far_verification)
    assert exc_info.value.status_code == 403
    assert "physical proximity" in exc_info.value.detail

@pytest.mark.asyncio
async def test_resolution_claim_lifecycle():
    issue_id = "CT-KA-BLR-000102"
    claim = ResolutionClaimRequest(
        claimant_id="Municipal Maintenance Crew #12",
        notes="Fixed ruptured pipe and repaved surface"
    )

    claimed_issue = await intake_service.process_resolution_claim(issue_id, claim)
    assert claimed_issue.status == IssueStatus.RESOLUTION_CLAIMED
    assert claimed_issue.resolution_window_expires_at is not None
    assert claimed_issue.verified_confirm_count == 0
    assert claimed_issue.verified_dispute_count == 0
