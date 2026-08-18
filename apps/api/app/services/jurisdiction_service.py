from typing import Dict, Any, Tuple
from ..models import IssueCategory

# Administrative Region Bounding Boxes and Prefixes
REGION_BOUNDARIES = [
    {
        "state_code": "KA",
        "dist_code": "BLR",
        "authority": "Bruhat Bengaluru Mahanagara Palike (BBMP)",
        "min_lat": 12.75, "max_lat": 13.20,
        "min_lon": 77.40, "max_lon": 77.80,
    },
    {
        "state_code": "DL",
        "dist_code": "ND",
        "authority": "Municipal Corporation of Delhi (MCD)",
        "min_lat": 28.40, "max_lat": 28.90,
        "min_lon": 76.85, "max_lon": 77.40,
    },
    {
        "state_code": "MH",
        "dist_code": "MUM",
        "authority": "Brihanmumbai Municipal Corporation (BMC)",
        "min_lat": 18.85, "max_lat": 19.35,
        "min_lon": 72.75, "max_lon": 73.05,
    },
    {
        "state_code": "TN",
        "dist_code": "CHN",
        "authority": "Greater Chennai Corporation (GCC)",
        "min_lat": 12.90, "max_lat": 13.25,
        "min_lon": 80.10, "max_lon": 80.35,
    }
]

DEPARTMENT_MAP: Dict[IssueCategory, str] = {
    IssueCategory.ROAD_HAZARD: "Major Roads & Infrastructure Division (PWD / ULB)",
    IssueCategory.DRAINAGE_WATER: "Water Supply and Sewerage Board (BWSSB / DJB)",
    IssueCategory.SOLID_WASTE: "Solid Waste Management Cell (SWM)",
    IssueCategory.ELECTRICAL_HAZARD: "Electricity Supply & Distribution Company (BESCOM / BSES)",
    IssueCategory.PUBLIC_INFRASTRUCTURE: "Town Planning & Public Amenities Department",
    IssueCategory.ENVIRONMENTAL_VIOLATION: "State Pollution Control Board & Lake Development Cell",
}

_serial_counter = 100

def resolve_jurisdiction(lat: float, lon: float, category: IssueCategory) -> Dict[str, Any]:
    matched = None
    for region in REGION_BOUNDARIES:
        if (region["min_lat"] <= lat <= region["max_lat"] and
            region["min_lon"] <= lon <= region["max_lon"]):
            matched = region
            break

    if not matched:
        # Default fallback to National / State PWD
        matched = {
            "state_code": "IN",
            "dist_code": "GEN",
            "authority": "State Public Works Department (PWD)",
        }

    global _serial_counter
    _serial_counter += 1
    issue_id = f"CT-{matched['state_code']}-{matched['dist_code']}-{_serial_counter:06d}"

    department = DEPARTMENT_MAP.get(category, "General Grievance Cell")

    return {
        "issue_id": issue_id,
        "authority": matched["authority"],
        "department": department,
        "state_code": matched["state_code"],
        "dist_code": matched["dist_code"],
    }
