import math
from datetime import datetime, timedelta
from typing import Tuple, Optional
from .models import Issue, IssueStatus, ActionType, EventType, IssueEvent

def calculate_consensus_score(confirms: int, disputes: int, alpha: float = 2.0) -> float:
    """
    Computes Laplace-smoothed logarithmic consensus confidence score.
    """
    total = confirms + disputes
    if total == 0:
        return 0.0
    net_ratio = (confirms - disputes) / (total + alpha)
    volume_multiplier = math.log2(1.0 + total)
    return round(net_ratio * volume_multiplier, 3)

def transition_issue_state(
    issue: Issue,
    action: ActionType,
    has_photo_evidence: bool = False
) -> Tuple[Issue, Optional[IssueEvent]]:
    """
    Evaluates state machine transitions based on local nullifier actions and quorum thresholds.
    """
    now = datetime.utcnow()
    old_status = issue.status
    event: Optional[IssueEvent] = None

    if action == ActionType.CONFIRM:
        issue.verified_confirm_count += 1
        issue.sightings_count += 1
        issue.last_activity_at = now
        issue.consensus_score = calculate_consensus_score(
            issue.verified_confirm_count, issue.verified_dispute_count
        )

        # Transition: REPORTED -> COMMUNITY_CORROBORATED (>= 3 confirms and >= 80% positive)
        if issue.status == IssueStatus.REPORTED:
            total = issue.verified_confirm_count + issue.verified_dispute_count
            if issue.verified_confirm_count >= 3 and (issue.verified_confirm_count / total) >= 0.8:
                issue.status = IssueStatus.COMMUNITY_CORROBORATED
                event = IssueEvent(
                    id=f"EVT-{issue.id}-{int(now.timestamp())}",
                    issue_id=issue.id,
                    event_type=EventType.STATUS_TRANSITION,
                    from_status=old_status,
                    to_status=issue.status,
                    event_payload={"reason": "Community corroboration quorum reached (>=3 local confirmations)"},
                    created_at=now
                )

    elif action == ActionType.DISPUTE:
        issue.verified_dispute_count += 1
        issue.last_activity_at = now
        issue.consensus_score = calculate_consensus_score(
            issue.verified_confirm_count, issue.verified_dispute_count
        )

        # Transition: REPORTED -> DISPUTED (>= 3 disputes and >= 60% dispute ratio)
        if issue.status in [IssueStatus.REPORTED, IssueStatus.COMMUNITY_CORROBORATED]:
            total = issue.verified_confirm_count + issue.verified_dispute_count
            if issue.verified_dispute_count >= 3 and (issue.verified_dispute_count / total) >= 0.6:
                issue.status = IssueStatus.DISPUTED
                event = IssueEvent(
                    id=f"EVT-{issue.id}-{int(now.timestamp())}",
                    issue_id=issue.id,
                    event_type=EventType.STATUS_TRANSITION,
                    from_status=old_status,
                    to_status=issue.status,
                    event_payload={"reason": "Community dispute threshold exceeded"},
                    created_at=now
                )

    elif action == ActionType.RESOLUTION_VERIFY:
        issue.verified_confirm_count += 1
        issue.last_activity_at = now
        if issue.status == IssueStatus.RESOLUTION_CLAIMED:
            if issue.verified_confirm_count >= 3:
                issue.status = IssueStatus.COMMUNITY_VERIFIED
                issue.resolved_at = now
                event = IssueEvent(
                    id=f"EVT-{issue.id}-{int(now.timestamp())}",
                    issue_id=issue.id,
                    event_type=EventType.STATUS_TRANSITION,
                    from_status=old_status,
                    to_status=issue.status,
                    event_payload={"reason": "Resolution verified by on-ground community quorum"},
                    created_at=now
                )

    elif action == ActionType.RESOLUTION_DISPUTE:
        issue.verified_dispute_count += 1
        issue.last_activity_at = now
        if issue.status == IssueStatus.RESOLUTION_CLAIMED:
            if issue.verified_dispute_count >= 2 and has_photo_evidence:
                issue.status = IssueStatus.REOPENED
                issue.escalation_deadline = now + timedelta(days=2)
                event = IssueEvent(
                    id=f"EVT-{issue.id}-{int(now.timestamp())}",
                    issue_id=issue.id,
                    event_type=EventType.REOPENED_BY_COMMUNITY,
                    from_status=old_status,
                    to_status=IssueStatus.REOPENED,
                    event_payload={"reason": "Claimed resolution overturned by on-ground photographic proof"},
                    created_at=now
                )

    return issue, event
