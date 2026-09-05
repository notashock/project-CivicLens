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

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_list_issues():
    response = client.get("/api/v1/issues")
    assert response.status_code == 200
    issues = response.json()
    assert len(issues) >= 5
    assert "CT-KA-BLR-000101" in [i["id"] for i in issues]

def test_report_issue_success():
    payload = {
        "category": "ROAD_HAZARD",
        "observed_condition": "Deep trench on road shoulder",
        "landmark": "Near Marathahalli Bridge",
        "impact_duration_days": 10,
        "lat": 12.9562,
        "lon": 77.7019,
        "severity_score": 3,
        "nullifier_hash": "a" * 64,
        "timestamp": int(time.time() * 1000)
    }

    response = client.post("/api/v1/issues/report", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"].startswith("CT-ROAD-")
    assert data["status"] == "REPORTED"
    assert len(data["digipin_code"]) == 10
    assert "Near Marathahalli Bridge" in data["description_neutral"]

def test_local_verification_proximity_enforcement():
    issue_id = "CT-KA-BLR-000101" # Lat 12.9716, Lon 77.5946

    # 1. Verification from 50m away (Success)
    valid_payload = {
        "action_type": "CONFIRM",
        "nullifier_hash": "1" * 64,
        "timestamp": int(time.time() * 1000),
        "lat": 12.9718,
        "lon": 77.5948
    }
    res_valid = client.post(f"/api/v1/issues/{issue_id}/verify", json=valid_payload)
    assert res_valid.status_code == 200
    assert res_valid.json()["verified_confirm_count"] == 15

    # 2. Verification from 5km away (403 Forbidden)
    far_payload = {
        "action_type": "CONFIRM",
        "nullifier_hash": "2" * 64,
        "timestamp": int(time.time() * 1000),
        "lat": 13.0500,
        "lon": 77.5946
    }
    res_far = client.post(f"/api/v1/issues/{issue_id}/verify", json=far_payload)
    assert res_far.status_code == 403
    assert "physical proximity" in res_far.json()["detail"]

def test_anti_sybil_duplicate_nullifier_rejection():
    issue_id = "CT-KA-BLR-000101"
    same_nullifier = "3" * 64

    payload = {
        "action_type": "CONFIRM",
        "nullifier_hash": same_nullifier,
        "timestamp": int(time.time() * 1000),
        "lat": 12.9716,
        "lon": 77.5946
    }

    # First action -> 200 OK
    res1 = client.post(f"/api/v1/issues/{issue_id}/verify", json=payload)
    assert res1.status_code == 200

    # Second action with identical nullifier on same issue -> 409 Conflict
    res2 = client.post(f"/api/v1/issues/{issue_id}/verify", json=payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"]

def test_anti_sybil_cross_action_rejection():
    issue_id = "CT-KA-BLR-000102"
    device_nullifier = "4" * 64

    # 1. Device confirms issue
    confirm_payload = {
        "action_type": "CONFIRM",
        "nullifier_hash": device_nullifier,
        "timestamp": int(time.time() * 1000),
        "lat": 12.9352,
        "lon": 77.6245
    }
    res1 = client.post(f"/api/v1/issues/{issue_id}/verify", json=confirm_payload)
    assert res1.status_code == 200

    # 2. Same device then tries to DISPUTE the same issue -> 409 Conflict
    dispute_payload = {
        "action_type": "DISPUTE",
        "nullifier_hash": device_nullifier,
        "timestamp": int(time.time() * 1000),
        "lat": 12.9352,
        "lon": 77.6245
    }
    res2 = client.post(f"/api/v1/issues/{issue_id}/verify", json=dispute_payload)
    assert res2.status_code == 409
    assert "already registered" in res2.json()["detail"]

def test_geojson_endpoint():
    response = client.get("/api/v1/geojson")
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) >= 5
    first_feat = data["features"][0]
    assert "geometry" in first_feat
    assert "properties" in first_feat
    assert "digipin" in first_feat["properties"]

def test_claim_resolution_and_quorum_flow():
    issue_id = "CT-KA-BLR-000101"
    
    # 1. Authority claims resolution
    claim_payload = {
        "claimant_id": "PWD Contractor #4402",
        "notes": "Pothole filled with asphalt and steamrolled"
    }
    res_claim = client.post(f"/api/v1/issues/{issue_id}/claim-resolution", json=claim_payload)
    assert res_claim.status_code == 200
    claimed_issue = res_claim.json()
    assert claimed_issue["status"] == "RESOLUTION_CLAIMED"
    assert claimed_issue["resolution_window_expires_at"] is not None

    # 2. Local community verification (Quorum confirmation)
    verify_payload = {
        "action_type": "RESOLUTION_VERIFY",
        "nullifier_hash": "e" * 64,
        "timestamp": int(time.time() * 1000),
        "lat": 12.9716,
        "lon": 77.5946
    }
    res_ver = client.post(f"/api/v1/issues/{issue_id}/verify", json=verify_payload)
    assert res_ver.status_code == 200
    data_ver = res_ver.json()
    assert data_ver["verified_confirm_count"] == 1
