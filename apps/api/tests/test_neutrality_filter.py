import time
import io
import base64
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from apps.api.app.main import app
from apps.api.app.database import db
from apps.api.app.services.neutrality_filter import NeutralityFilter
from apps.api.app.services.nullifier_service import global_nullifier_registry

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_state():
    db.seed_initial_data()
    global_nullifier_registry.clear()

def test_text_neutrality_permits_clean_physical_conditions():
    nf = NeutralityFilter()
    error = nf.validate_text("Pothole 2 feet deep causing traffic slowdown on outer ring road.")
    assert error is None

    error2 = nf.validate_text("Broken water pipe near bus terminal overflowing into pedestrian sidewalk.")
    assert error2 is None

def test_text_neutrality_blocks_political_parties():
    nf = NeutralityFilter()
    violation_samples = [
        "BJP office in front has broken road",
        "Congress party workers failed to repair this street",
        "AAP volunteer filed this complaint",
        "TMC flags blocking storm water drain",
        "CPI union rally left garbage on road",
        "DMK corporator did not inspect this",
    ]
    for text in violation_samples:
        error = nf.validate_text(text)
        assert error is not None, f"Expected '{text}' to fail text neutrality scan"
        assert "political entity" in error

def test_text_neutrality_blocks_political_office_holders_and_leaders():
    nf = NeutralityFilter()
    violation_samples = [
        "Local MLA promised to inspect this site",
        "Member of Parliament ignored our locality",
        "Ward Councillor took bribe and left road unfinished",
        "Chief Minister should see this water shortage",
        "Rahul Gandhi visited this area last week",
        "Narendra Modi poster fell into the open drain",
    ]
    for text in violation_samples:
        error = nf.validate_text(text)
        assert error is not None, f"Expected '{text}' to fail text neutrality scan"
        assert "Neutrality violation" in error

def test_text_neutrality_blocks_named_individuals_with_honorifics():
    nf = NeutralityFilter()
    violation_samples = [
        "Shri Rajesh Kumar dumped debris here",
        "Mr. Sharma contractor refuses to fix pipe",
        "Dr. Varma complained about the sewage",
    ]
    for text in violation_samples:
        error = nf.validate_text(text)
        assert error is not None, f"Expected '{text}' to fail text neutrality scan"
        assert "named individual" in error

def test_image_inspection_clean_blank_image():
    nf = NeutralityFilter()
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")

    valid, reason = nf.validate_submission("Clean narrative text", [b64_str])
    assert valid is True
    assert reason is None

def test_api_community_notes_lifecycle():
    issue_id = "CT-KA-BLR-000101"

    # 1. Post a valid factual community explanation
    payload = {
        "text": "Work crew was spotted offloading bags of aggregate this morning. Excavation guarded with cones.",
        "media_urls": [],
        "participant_badge": "Local Resident"
    }
    res = client.post(f"/api/v1/issues/{issue_id}/notes", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["issue_id"] == issue_id
    assert "Work crew" in data["text"]
    assert data["participant_badge"] == "Local Resident"

    # 2. Fetch community notes list
    res_list = client.get(f"/api/v1/issues/{issue_id}/notes")
    assert res_list.status_code == 200
    notes = res_list.json()
    assert any(n["id"] == data["id"] for n in notes)

def test_api_community_notes_neutrality_rejection():
    issue_id = "CT-KA-BLR-000101"

    # Try posting note with political defamation
    payload = {
        "text": "The local BJP MLA and corporator are corrupt and refuse to asphalt this road.",
        "media_urls": []
    }
    res = client.post(f"/api/v1/issues/{issue_id}/notes", json=payload)
    assert res.status_code == 400
    assert "Neutrality violation" in res.json()["detail"]

def test_api_report_issue_neutrality_rejection():
    payload = {
        "category": "ROAD_HAZARD",
        "observed_condition": "Huge crater outside Congress party headquarters",
        "landmark": "Near MLA office junction",
        "impact_duration_days": 5,
        "lat": 12.9716,
        "lon": 77.5946,
        "severity_score": 3,
        "nullifier_hash": "e" * 64,
        "timestamp": int(time.time() * 1000)
    }

    res = client.post("/api/v1/issues/report", json=payload)
    assert res.status_code == 400
    assert "Neutrality violation" in res.json()["detail"]
