from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from apps.api.app.adapters.base import DatabaseAdapter, global_event_broadcaster
from apps.api.app.models import Issue, IssueStatus, IssueCategory, IssueEvent, EventType, EvidenceMedia

class AwaitableSyncResult:
    def __init__(self, value=None):
        self.value = value

    def __await__(self):
        async def _wrapper():
            return self.value
        return _wrapper().__await__()


class InMemoryDatabaseAdapter(DatabaseAdapter):
    """
    In-memory database adapter for test suites and zero-config local development.
    """
    def __init__(self, seed: bool = False):
        self._issues: Dict[str, Issue] = {}
        self._community_notes: Dict[str, List[Dict[str, Any]]] = {}
        if seed:
            self.seed_initial_data()

    def seed_initial_data(self):
        self._issues.clear()
        self._community_notes.clear()
        now = datetime.utcnow()

        seed_data = [
            Issue(
                id="CT-KA-BLR-000101",
                category=IssueCategory.ROAD_HAZARD,
                status=IssueStatus.COMMUNITY_CORROBORATED,
                digipin_code="39J485MP24",
                digipin_l8="39J485MP",
                digipin_l6="39J485",
                lat=12.9716,
                lon=77.5946,
                description_neutral="Condition observed: Unrepaired road depression 1.8m wide, 12cm depth. 47 days unresolved.",
                jurisdiction_authority="BBMP (Bruhat Bengaluru Mahanagara Palike)",
                assigned_department="Road Infrastructure & PWD",
                first_reported_at=now - timedelta(days=47),
                last_activity_at=now,
                escalation_deadline=now + timedelta(days=7),
                consensus_score=14.0,
                verified_confirm_count=14,
                verified_dispute_count=0,
                timeline=[
                    IssueEvent(
                        id="EVT-001",
                        issue_id="CT-KA-BLR-000101",
                        event_type=EventType.CREATED,
                        to_status=IssueStatus.REPORTED,
                        event_payload={"source": "anonymous_participant"},
                        created_at=now - timedelta(days=47)
                    ),
                    IssueEvent(
                        id="EVT-002",
                        issue_id="CT-KA-BLR-000101",
                        event_type=EventType.STATUS_TRANSITION,
                        from_status=IssueStatus.REPORTED,
                        to_status=IssueStatus.COMMUNITY_CORROBORATED,
                        event_payload={"threshold": ">=3 local confirmations"},
                        created_at=now - timedelta(days=45)
                    )
                ]
            ),
            Issue(
                id="CT-KA-BLR-000102",
                category=IssueCategory.DRAINAGE_WATER,
                status=IssueStatus.ESCALATED,
                digipin_code="39J485LN19",
                digipin_l8="39J485LN",
                digipin_l6="39J485",
                lat=12.9352,
                lon=77.6245,
                description_neutral="Condition observed: Continuous raw wastewater discharge on public pathway. 19 days unresolved.",
                jurisdiction_authority="BWSSB (Bangalore Water Supply & Sewerage Board)",
                assigned_department="Wastewater Management",
                first_reported_at=now - timedelta(days=19),
                last_activity_at=now,
                escalation_deadline=now - timedelta(days=5),
                consensus_score=28.0,
                verified_confirm_count=29,
                verified_dispute_count=1,
                timeline=[
                    IssueEvent(
                        id="EVT-003",
                        issue_id="CT-KA-BLR-000102",
                        event_type=EventType.CREATED,
                        to_status=IssueStatus.REPORTED,
                        event_payload={"source": "anonymous_participant"},
                        created_at=now - timedelta(days=19)
                    )
                ]
            ),
            Issue(
                id="CT-DL-ND-000201",
                category=IssueCategory.SOLID_WASTE,
                status=IssueStatus.REPORTED,
                digipin_code="29G391KM48",
                digipin_l8="29G391KM",
                digipin_l6="29G391",
                lat=28.6139,
                lon=77.2090,
                description_neutral="Condition observed: Accumulation of unsegregated solid municipal waste blocking sidewalk. 3 days observed.",
                jurisdiction_authority="NDMC (New Delhi Municipal Council)",
                assigned_department="Sanitation & Public Health",
                first_reported_at=now - timedelta(days=3),
                last_activity_at=now,
                escalation_deadline=now + timedelta(days=4),
                consensus_score=2.0,
                verified_confirm_count=2,
                verified_dispute_count=0,
                timeline=[
                    IssueEvent(
                        id="EVT-004",
                        issue_id="CT-DL-ND-000201",
                        event_type=EventType.CREATED,
                        to_status=IssueStatus.REPORTED,
                        event_payload={"source": "anonymous_participant"},
                        created_at=now - timedelta(days=3)
                    )
                ]
            ),
            Issue(
                id="CT-MH-MUM-000301",
                category=IssueCategory.ELECTRICAL_HAZARD,
                status=IssueStatus.RESOLUTION_CLAIMED,
                digipin_code="19F274PL82",
                digipin_l8="19F274PL",
                digipin_l6="19F274",
                lat=19.0760,
                lon=72.8777,
                description_neutral="Condition observed: Exposed live junction box at pedestrian level. Contractor claimed repaired.",
                jurisdiction_authority="BMC (Brihanmumbai Municipal Corporation)",
                assigned_department="Electrical Infrastructure",
                first_reported_at=now - timedelta(days=12),
                last_activity_at=now,
                escalation_deadline=now + timedelta(days=2),
                resolution_window_expires_at=now + timedelta(days=2),
                consensus_score=8.0,
                verified_confirm_count=8,
                verified_dispute_count=0,
                timeline=[
                    IssueEvent(
                        id="EVT-005",
                        issue_id="CT-MH-MUM-000301",
                        event_type=EventType.RESOLUTION_PROPOSED,
                        from_status=IssueStatus.COMMUNITY_CORROBORATED,
                        to_status=IssueStatus.RESOLUTION_CLAIMED,
                        event_payload={"claimant": "Contractor ID #9102", "window": "72-hour community verification"},
                        created_at=now - timedelta(days=1)
                    )
                ]
            ),
            Issue(
                id="CT-KA-BLR-000103",
                category=IssueCategory.PUBLIC_INFRASTRUCTURE,
                status=IssueStatus.RESOLVED,
                digipin_code="39J485MQ33",
                digipin_l8="39J485MQ",
                digipin_l6="39J485",
                lat=12.9780,
                lon=77.5990,
                description_neutral="Condition observed: Broken storm drain slab replaced with reinforced concrete cover. Verified by community.",
                jurisdiction_authority="BBMP (Bruhat Bengaluru Mahanagara Palike)",
                assigned_department="Stormwater Drains",
                first_reported_at=now - timedelta(days=25),
                last_activity_at=now,
                escalation_deadline=now,
                resolved_at=now - timedelta(days=2),
                consensus_score=19.0,
                verified_confirm_count=19,
                verified_dispute_count=0,
                timeline=[
                    IssueEvent(
                        id="EVT-006",
                        issue_id="CT-KA-BLR-000103",
                        event_type=EventType.STATUS_TRANSITION,
                        from_status=IssueStatus.RESOLUTION_CLAIMED,
                        to_status=IssueStatus.RESOLVED,
                        event_payload={"quorum_result": "Passed with 6 local confirmations, 0 disputes"},
                        created_at=now - timedelta(days=2)
                    )
                ]
            )
        ]

        for issue in seed_data:
            self._issues[issue.id] = issue
        return AwaitableSyncResult(None)

    async def get_by_id(self, issue_id: str) -> Optional[Issue]:
        return self._issues.get(issue_id)

    async def get_all(
        self,
        category: Optional[Any] = None,
        status: Optional[Any] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
    ) -> List[Issue]:
        results = list(self._issues.values())

        if category and category != "ALL":
            cat_val = category.value if hasattr(category, 'value') else category
            results = [i for i in results if (i.category.value if hasattr(i.category, 'value') else i.category) == cat_val]

        if status and status != "ALL":
            stat_val = status.value if hasattr(status, 'value') else status
            results = [i for i in results if (i.status.value if hasattr(i.status, 'value') else i.status) == stat_val]

        if min_lat is not None:
            results = [i for i in results if i.lat >= min_lat]
        if max_lat is not None:
            results = [i for i in results if i.lat <= max_lat]
        if min_lon is not None:
            results = [i for i in results if i.lon >= min_lon]
        if max_lon is not None:
            results = [i for i in results if i.lon <= max_lon]

        return results

    async def save(self, issue: Issue) -> Issue:
        self._issues[issue.id] = issue
        return issue

    async def get_community_notes(self, issue_id: str) -> List[Dict[str, Any]]:
        if not hasattr(self, "_community_notes"):
            self._community_notes = {}
        notes = self._community_notes.get(issue_id, [])
        return sorted(notes, key=lambda n: str(n.get("created_at", "")), reverse=True)

    async def save_community_note(self, note: Dict[str, Any]) -> Dict[str, Any]:
        if not hasattr(self, "_community_notes"):
            self._community_notes = {}
        issue_id = note["issue_id"]
        if issue_id not in self._community_notes:
            self._community_notes[issue_id] = []
        self._community_notes[issue_id].append(note)
        return note
