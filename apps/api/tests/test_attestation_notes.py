import time
import pytest
from fastapi.testclient import TestClient
from apps.api.app.main import app
from apps.api.app.database import db
from apps.api.app.services.nullifier_service import global_nullifier_registry

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_state():
    db.seed_initial_data()
    global_nullifier_registry.clear()

def test_on_site_attestation_note_promotes_photo_and_increments_consensus():
    issue_id = "CT-KA-BLR-000101" # Lat 12.9716, Lon 77.5946
    initial_issue = client.get(f"/api/v1/issues/{issue_id}").json()
    initial_confirms = initial_issue["verified_confirm_count"]
    initial_evidence_count = len(initial_issue.get("evidence_list", []))

    # Participant within 50m of issue location
    payload = {
        "text": "Crew started gravel backfill on the open trench.",
        "stance": "CONFIRM",
        "nullifier_hash": "a" * 64,
        "lat": 12.9718,
        "lon": 77.5948,
        "media_urls": ["data:image/jpeg;base64,/9j/4AAQSkZJRg=="]
    }

    res = client.post(f"/api/v1/issues/{issue_id}/notes", json=payload)
    assert res.status_code == 201
    note_data = res.json()
    assert note_data["is_consensus_verified"] is True
    assert note_data["stance"] == "CONFIRM"
    assert len(note_data["media_urls"]) == 1

    # Verify issue state updated
    updated_issue = client.get(f"/api/v1/issues/{issue_id}").json()
    assert updated_issue["verified_confirm_count"] == initial_confirms + 1
    assert len(updated_issue["evidence_list"]) == initial_evidence_count + 1

    # Verify promoted evidence properties
    promoted_media = updated_issue["evidence_list"][-1]
    assert promoted_media["stance"] == "CONFIRM"
    assert promoted_media["is_verified"] is True
    assert promoted_media["media_url"] == "data:image/jpeg;base64,/9j/4AAQSkZJRg=="

def test_remote_attestation_note_accepted_without_quorum_promotion():
    issue_id = "CT-KA-BLR-000101" # Lat 12.9716, Lon 77.5946
    initial_issue = client.get(f"/api/v1/issues/{issue_id}").json()
    initial_confirms = initial_issue["verified_confirm_count"]
    initial_evidence_count = len(initial_issue.get("evidence_list", []))

    # Participant 5km away from issue location (>500m)
    payload = {
        "text": "Checking from home - seems this route is still congested on live maps.",
        "stance": "CONFIRM",
        "nullifier_hash": "b" * 64,
        "lat": 13.0500,
        "lon": 77.5946,
        "media_urls": ["data:image/jpeg;base64,/9j/4AAQSkZJRg=="]
    }

    res = client.post(f"/api/v1/issues/{issue_id}/notes", json=payload)
    assert res.status_code == 201
    note_data = res.json()
    # Note is accepted for transparency, but NOT marked as consensus verified
    assert note_data["is_consensus_verified"] is False
    assert note_data["stance"] == "CONFIRM"

    # Verify issue consensus counts and evidence gallery DID NOT promote remote submission
    updated_issue = client.get(f"/api/v1/issues/{issue_id}").json()
    assert updated_issue["verified_confirm_count"] == initial_confirms
    assert len(updated_issue["evidence_list"]) == initial_evidence_count

def test_stance_flip_cooldown_and_net_vote_update():
    issue_id = "CT-KA-BLR-000101"
    device_nullifier = "c" * 64
    initial_issue = client.get(f"/api/v1/issues/{issue_id}").json()
    initial_confirms = initial_issue["verified_confirm_count"]
    initial_disputes = initial_issue["verified_dispute_count"]

    # 1. Device first confirms on-site
    res1 = client.post(f"/api/v1/issues/{issue_id}/notes", json={
        "text": "Hazard is definitely present.",
        "stance": "CONFIRM",
        "nullifier_hash": device_nullifier,
        "lat": 12.9716,
        "lon": 77.5946
    })
    assert res1.status_code == 201
    assert res1.json()["is_consensus_verified"] is True

    updated_1 = client.get(f"/api/v1/issues/{issue_id}").json()
    assert updated_1["verified_confirm_count"] == initial_confirms + 1

    # 2. Immediate stance flip to DISPUTE within 15 mins -> 429 Too Many Requests
    res2 = client.post(f"/api/v1/issues/{issue_id}/notes", json={
        "text": "Wait actually it looks cleared now.",
        "stance": "DISPUTE",
        "nullifier_hash": device_nullifier,
        "lat": 12.9716,
        "lon": 77.5946
    })
    assert res2.status_code == 429
    assert "cooldown" in res2.json()["detail"].lower()

    # 3. Neutral progress note is allowed EVEN DURING cooldown
    res3 = client.post(f"/api/v1/issues/{issue_id}/notes", json={
        "text": "A bulldozer just drove past the site.",
        "stance": "NEUTRAL",
        "nullifier_hash": device_nullifier,
        "lat": 12.9716,
        "lon": 77.5946
    })
    assert res3.status_code == 201
    assert res3.json()["stance"] == "NEUTRAL"

    # 4. Simulate cooldown expiration by fast-forwarding the timestamp in nullifier registry
    # 16 minutes earlier:
    reg_key = f"{issue_id}:{device_nullifier}"
    global_nullifier_registry._records[reg_key].last_stance_time = time.time() - 960

    # Now flipping stance succeeds
    res4 = client.post(f"/api/v1/issues/{issue_id}/notes", json={
        "text": "Repairs finished now, hazard completely resolved.",
        "stance": "DISPUTE",
        "nullifier_hash": device_nullifier,
        "lat": 12.9716,
        "lon": 77.5946
    })
    assert res4.status_code == 201
    assert res4.json()["is_consensus_verified"] is True

    # Net quorum vote should atomically transfer: confirm count -1, dispute count +1
    updated_2 = client.get(f"/api/v1/issues/{issue_id}").json()
    assert updated_2["verified_confirm_count"] == initial_confirms
    assert updated_2["verified_dispute_count"] == initial_disputes + 1

def test_attestation_neutrality_rejection():
    issue_id = "CT-KA-BLR-000101"
    # Note containing non-neutral political blaming
    res = client.post(f"/api/v1/issues/{issue_id}/notes", json={
        "text": "This whole disaster is because of the corrupt BJP MLA.",
        "stance": "CONFIRM",
        "nullifier_hash": "d" * 64,
        "lat": 12.9716,
        "lon": 77.5946
    })
    assert res.status_code == 400
    assert "political" in res.json()["detail"].lower()
