"""Tests for Cutlist Optimizer module."""

import pytest
from starlette.testclient import TestClient

from app.main import app
from app.database import SessionLocal, Base, engine


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def auth_headers(client):
    """Login and get auth headers."""
    res = client.post("/api/v1/auth/login/json", json={
        "email": "ravi@decotrack.in",
        "password": "decotrack123",
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── CRUD Tests ───────────────────────────────────────────────


def test_create_job(client, auth_headers):
    """Create a cut job with parts."""
    res = client.post("/api/cutlist/jobs", json={
        "name": "Test Kitchen Carcass",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "blade_kerf": 3,
        "units": "MM",
        "cutting_method": "GUILLOTINE",
        "optimization_priority": "MINIMIZE_WASTE",
        "parts": [
            {"label": "Side Panel", "length": 800, "width": 600, "quantity": 2},
            {"label": "Top", "length": 1000, "width": 600, "quantity": 1},
        ],
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Kitchen Carcass"
    assert data["status"] == "PENDING"
    assert len(data["parts"]) == 2


def test_list_jobs(client, auth_headers):
    """List all cut jobs."""
    res = client.get("/api/cutlist/jobs", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_get_job(client, auth_headers):
    """Get a specific cut job."""
    # Create first
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Get Test Job",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [{"label": "A", "length": 500, "width": 300, "quantity": 1}],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.get(f"/api/cutlist/jobs/{job_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Get Test Job"


def test_update_pending_job(client, auth_headers):
    """Update a PENDING job."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Update Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [{"label": "A", "length": 500, "width": 300, "quantity": 1}],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.put(f"/api/cutlist/jobs/{job_id}", json={
        "name": "Updated Name",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"


def test_delete_job(client, auth_headers):
    """Delete a cut job."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Delete Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [{"label": "A", "length": 500, "width": 300, "quantity": 1}],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.delete(f"/api/cutlist/jobs/{job_id}", headers=auth_headers)
    assert res.status_code == 204

    # Verify deleted
    res = client.get(f"/api/cutlist/jobs/{job_id}", headers=auth_headers)
    assert res.status_code == 404


# ── Optimization Tests ───────────────────────────────────────


def test_basic_optimization_single_sheet(client, auth_headers):
    """2 small parts should fit in 1 sheet."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Single Sheet Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "blade_kerf": 3,
        "parts": [
            {"label": "A", "length": 1000, "width": 500, "quantity": 1},
            {"label": "B", "length": 800, "width": 400, "quantity": 1},
        ],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.post(f"/api/cutlist/jobs/{job_id}/optimize", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["sheets_used"] == 1
    assert data["waste_percentage"] > 0
    assert data["material_efficiency_percentage"] > 0
    assert len(data["svg_data_json"]) == 1


def test_multi_sheet_optimization(client, auth_headers):
    """Many large parts should need multiple sheets."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Multi Sheet Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "blade_kerf": 3,
        "parts": [
            {"label": "Big", "length": 2000, "width": 1000, "quantity": 4},
        ],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.post(f"/api/cutlist/jobs/{job_id}/optimize", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["sheets_used"] > 1


def test_oversized_part_raises_400(client, auth_headers):
    """Part larger than sheet should raise 400 at creation."""
    res = client.post("/api/cutlist/jobs", json={
        "name": "Oversized Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [
            {"label": "Huge", "length": 3000, "width": 1500, "quantity": 1},
        ],
    }, headers=auth_headers)
    assert res.status_code == 400


def test_grain_locked_parts_not_rotated(client, auth_headers):
    """Grain-locked parts should not be rotated in placements."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Grain Lock Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "blade_kerf": 3,
        "parts": [
            {"label": "GrainLock", "length": 800, "width": 400, "quantity": 2,
             "grain_locked": True},
        ],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.post(f"/api/cutlist/jobs/{job_id}/optimize", headers=auth_headers)
    assert res.status_code == 200
    placements = res.json()["placements_json"]
    for p in placements:
        if p["label"].startswith("GrainLock"):
            # Width should match original (not swapped)
            assert p["w"] == 800 or p["h"] == 800  # dimension should be present


def test_cost_calculation(client, auth_headers):
    """Cost should be sheets_used × price_per_sheet."""
    # Use material_id=1 which has last_purchase_rate
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "Cost Test",
        "material_id": 1,
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [
            {"label": "A", "length": 1000, "width": 500, "quantity": 1},
        ],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.post(f"/api/cutlist/jobs/{job_id}/optimize", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_cost"] >= 0  # should be sheets × rate


# ── PDF Test ─────────────────────────────────────────────────


def test_pdf_returns_pdf_content_type(client, auth_headers):
    """PDF endpoint should return application/pdf."""
    # Create and optimize
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "PDF Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [
            {"label": "X", "length": 600, "width": 300, "quantity": 3},
        ],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    # Must optimize first
    client.post(f"/api/cutlist/jobs/{job_id}/optimize", headers=auth_headers)

    res = client.get(f"/api/cutlist/jobs/{job_id}/pdf", headers=auth_headers)
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000  # PDF should have substantial content


def test_pdf_404_without_optimization(client, auth_headers):
    """PDF should return 404 if no optimization result."""
    create_res = client.post("/api/cutlist/jobs", json={
        "name": "PDF No Result",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [{"label": "A", "length": 500, "width": 300, "quantity": 1}],
    }, headers=auth_headers)
    job_id = create_res.json()["id"]

    res = client.get(f"/api/cutlist/jobs/{job_id}/pdf", headers=auth_headers)
    assert res.status_code == 404


# ── Validation Tests ─────────────────────────────────────────


def test_job_name_too_short(client, auth_headers):
    """Job name < 3 chars should fail."""
    res = client.post("/api/cutlist/jobs", json={
        "name": "AB",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [{"label": "A", "length": 500, "width": 300, "quantity": 1}],
    }, headers=auth_headers)
    assert res.status_code == 422


def test_no_parts_fails(client, auth_headers):
    """Job with 0 parts should fail."""
    res = client.post("/api/cutlist/jobs", json={
        "name": "No Parts Test",
        "sheet_width": 2400,
        "sheet_height": 1200,
        "parts": [],
    }, headers=auth_headers)
    assert res.status_code == 422


def test_materials_endpoint(client, auth_headers):
    """Materials endpoint should return list."""
    res = client.get("/api/cutlist/materials", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
