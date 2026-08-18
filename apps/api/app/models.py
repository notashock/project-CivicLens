from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class IssueCategory(str, Enum):
    ROAD_HAZARD = "ROAD_HAZARD"
    DRAINAGE_WATER = "DRAINAGE_WATER"
    SOLID_WASTE = "SOLID_WASTE"
    ELECTRICAL_HAZARD = "ELECTRICAL_HAZARD"
    PUBLIC_INFRASTRUCTURE = "PUBLIC_INFRASTRUCTURE"
    ENVIRONMENTAL_VIOLATION = "ENVIRONMENTAL_VIOLATION"

class IssueStatus(str, Enum):
    REPORTED = "REPORTED"
    COMMUNITY_CORROBORATED = "COMMUNITY_CORROBORATED"
    ESCALATED = "ESCALATED"
    AUTHORITY_RESPONSE = "AUTHORITY_RESPONSE"
    ACTION_IN_PROGRESS = "ACTION_IN_PROGRESS"
    RESOLUTION_CLAIMED = "RESOLUTION_CLAIMED"
    COMMUNITY_VERIFIED = "COMMUNITY_VERIFIED"
    RESOLVED = "RESOLVED"
    DISPUTED = "DISPUTED"
    REOPENED = "REOPENED"

class ActionType(str, Enum):
    REPORT = "REPORT"
    CONFIRM = "CONFIRM"
    DISPUTE = "DISPUTE"
    RESOLUTION_VERIFY = "RESOLUTION_VERIFY"
    RESOLUTION_DISPUTE = "RESOLUTION_DISPUTE"

class EventType(str, Enum):
    CREATED = "CREATED"
    CORROBORATED = "CORROBORATED"
    DISPUTED = "DISPUTED"
    STATUS_TRANSITION = "STATUS_TRANSITION"
    EVIDENCE_ADDED = "EVIDENCE_ADDED"
    OFFICIAL_NOTICE_LOGGED = "OFFICIAL_NOTICE_LOGGED"
    RESOLUTION_PROPOSED = "RESOLUTION_PROPOSED"
    REOPENED_BY_COMMUNITY = "REOPENED_BY_COMMUNITY"

class IssueEvent(BaseModel):
    id: str
    issue_id: str
    event_type: EventType
    from_status: Optional[IssueStatus] = None
    to_status: Optional[IssueStatus] = None
    event_payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class EvidenceMedia(BaseModel):
    id: str
    issue_id: str
    media_url: str
    thumbnail_url: Optional[str] = None
    phash_value: Optional[str] = None
    detected_objects: List[str] = Field(default_factory=list)
    is_sanitized: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Issue(BaseModel):
    id: str # CT-STATE-DIST-SERIAL
    category: IssueCategory
    status: IssueStatus = IssueStatus.REPORTED
    digipin_code: str
    digipin_l8: str
    digipin_l6: str
    lat: float
    lon: float
    description_neutral: str
    severity_score: int = Field(ge=1, le=5, default=2)
    jurisdiction_authority: str
    assigned_department: str
    ward_name: Optional[str] = None
    
    verified_confirm_count: int = 1
    verified_dispute_count: int = 0
    sightings_count: int = 1
    consensus_score: float = 0.0
    
    first_reported_at: datetime = Field(default_factory=datetime.utcnow)
    last_activity_at: datetime = Field(default_factory=datetime.utcnow)
    escalation_deadline: datetime
    resolution_window_expires_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    
    evidence_list: List[EvidenceMedia] = Field(default_factory=list)
    timeline: List[IssueEvent] = Field(default_factory=list)

class IssueCreateRequest(BaseModel):
    category: IssueCategory
    observed_condition: str
    landmark: str
    impact_duration_days: Optional[int] = 0
    lat: float
    lon: float
    severity_score: int = 2
    nullifier_hash: str
    timestamp: int
    media_data_base64: Optional[str] = None

class VerificationRequest(BaseModel):
    action_type: ActionType
    nullifier_hash: str
    timestamp: int
    lat: float
    lon: float
    evidence_photo_base64: Optional[str] = None
