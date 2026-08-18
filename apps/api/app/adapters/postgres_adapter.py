import os
import json
import time
import asyncio
import logging
from typing import List, Optional, Dict, Any
from apps.api.app.adapters.base import DatabaseAdapter, global_event_broadcaster
from apps.api.app.models.issue import Issue, IssueStatus, IssueCategory, TimelineEvent

logger = logging.getLogger("civictrace.postgres")

class PostgresDatabaseAdapter(DatabaseAdapter):
    """
    DEEP MODULE: Production PostgreSQL + PostGIS adapter.
    Encapsulates asyncpg connection pooling, PostGIS spatial queries,
    and PostgreSQL LISTEN/NOTIFY real-time broadcast.
    """
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool = None

    async def initialize(self):
        try:
            import asyncpg
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10,
                command_timeout=30
            )
            await self._run_migrations()
            # Start background LISTEN worker
            asyncio.create_task(self._listen_worker())
            logger.info("Connected to PostgreSQL + PostGIS successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize PostgreSQL pool: {e}")
            raise

    async def _run_migrations(self):
        async with self._pool.acquire() as conn:
            # Ensure PostGIS extension
            await conn.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            # Create issues table with PostGIS geometry
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS civic_issues (
                    id VARCHAR(64) PRIMARY KEY,
                    category VARCHAR(64) NOT NULL,
                    status VARCHAR(64) NOT NULL,
                    digipin_code VARCHAR(16) NOT NULL,
                    lat DOUBLE PRECISION NOT NULL,
                    lon DOUBLE PRECISION NOT NULL,
                    geom GEOMETRY(Point, 4326),
                    description_neutral TEXT NOT NULL,
                    jurisdiction_authority VARCHAR(255) NOT NULL,
                    assigned_department VARCHAR(255) NOT NULL,
                    first_reported_at BIGINT NOT NULL,
                    last_updated_at BIGINT NOT NULL,
                    resolution_claimed_at BIGINT,
                    resolved_at BIGINT,
                    consensus_score INT DEFAULT 0,
                    verified_confirm_count INT DEFAULT 0,
                    verified_dispute_count INT DEFAULT 0,
                    timeline JSONB DEFAULT '[]'::jsonb
                );

                CREATE INDEX IF NOT EXISTS idx_civic_issues_geom ON civic_issues USING GIST(geom);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_digipin ON civic_issues(digipin_code);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON civic_issues(status);

                CREATE TABLE IF NOT EXISTS civic_nullifiers (
                    issue_id VARCHAR(64) NOT NULL,
                    nullifier_hash VARCHAR(64) NOT NULL,
                    created_at BIGINT NOT NULL,
                    PRIMARY KEY (issue_id, nullifier_hash)
                );
            """)

    async def _listen_worker(self):
        """Listens on the PostgreSQL notification channel for real-time cluster sync."""
        try:
            import asyncpg
            conn = await asyncpg.connect(self.database_url)
            await conn.add_listener("civic_events", self._handle_pg_notify)
            while True:
                await asyncio.sleep(60)
        except Exception as e:
            logger.warning(f"Postgres LISTEN channel disconnected: {e}")

    def _handle_pg_notify(self, connection, pid, channel, payload):
        try:
            event = json.loads(payload)
            asyncio.create_task(
                global_event_broadcaster.broadcast(event.get("event_type", "UPDATE"), event.get("data", {}))
            )
        except Exception as e:
            logger.error(f"Error handling PostgreSQL notification: {e}")

    async def get_issue(self, issue_id: str) -> Optional[Issue]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM civic_issues WHERE id = $1", issue_id)
            if not row:
                return None
            return self._row_to_issue(row)

    async def list_issues(self, category: Optional[str] = None, status: Optional[str] = None) -> List[Issue]:
        query = "SELECT * FROM civic_issues WHERE 1=1"
        params = []
        if category and category != "ALL":
            params.append(category)
            query += f" AND category = ${len(params)}"
        if status and status != "ALL":
            params.append(status)
            query += f" AND status = ${len(params)}"
        query += " ORDER BY last_updated_at DESC"

        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [self._row_to_issue(r) for r in rows]

    async def create_issue(self, issue: Issue) -> Issue:
        async with self._pool.acquire() as conn:
            timeline_json = json.dumps([t.model_dump() for t in issue.timeline])
            await conn.execute("""
                INSERT INTO civic_issues (
                    id, category, status, digipin_code, lat, lon, geom,
                    description_neutral, jurisdiction_authority, assigned_department,
                    first_reported_at, last_updated_at, resolution_claimed_at, resolved_at,
                    consensus_score, verified_confirm_count, verified_dispute_count, timeline
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($6, $5), 4326),
                    $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
                )
            """,
                issue.id,
                issue.category.value if hasattr(issue.category, 'value') else issue.category,
                issue.status.value if hasattr(issue.status, 'value') else issue.status,
                issue.digipin_code,
                issue.lat,
                issue.lon,
                issue.description_neutral,
                issue.jurisdiction_authority,
                issue.assigned_department,
                issue.first_reported_at,
                issue.last_updated_at,
                issue.resolution_claimed_at,
                issue.resolved_at,
                issue.consensus_score,
                issue.verified_confirm_count,
                issue.verified_dispute_count,
                timeline_json
            )

            # Broadcast event
            await global_event_broadcaster.broadcast("ISSUE_CREATED", issue.model_dump())
            return issue

    async def record_verification(
        self,
        issue_id: str,
        action: str,
        nullifier: str,
        lat: float,
        lon: float
    ) -> Issue:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                # 1. Check & Insert nullifier
                try:
                    await conn.execute(
                        "INSERT INTO civic_nullifiers (issue_id, nullifier_hash, created_at) VALUES ($1, $2, $3)",
                        issue_id, nullifier, int(time.time() * 1000)
                    )
                except Exception:
                    raise ValueError("Nullifier already registered for this issue")

                # 2. Fetch current issue
                row = await conn.fetchrow("SELECT * FROM civic_issues WHERE id = $1 FOR UPDATE", issue_id)
                if not row:
                    raise KeyError(f"Issue {issue_id} not found")

                issue = self._row_to_issue(row)

                # 3. Update scores
                if action in ("CONFIRM", "RESOLUTION_VERIFY"):
                    issue.verified_confirm_count += 1
                    issue.consensus_score += 1
                elif action in ("DISPUTE", "RESOLUTION_DISPUTE"):
                    issue.verified_dispute_count += 1
                    issue.consensus_score = max(0, issue.consensus_score - 1)

                now = int(time.time() * 1000)
                old_status = issue.status

                if issue.status == IssueStatus.REPORTED and issue.verified_confirm_count >= 3:
                    issue.status = IssueStatus.COMMUNITY_CORROBORATED
                    issue.timeline.append(TimelineEvent(
                        id=f"EVT-{now}",
                        event_type="STATUS_CHANGE",
                        created_at=now,
                        from_status=old_status,
                        to_status=IssueStatus.COMMUNITY_CORROBORATED,
                        event_payload={"trigger": "community_corroboration", "confirmations": issue.verified_confirm_count}
                    ))
                elif issue.status == IssueStatus.RESOLUTION_CLAIMED:
                    if action == "RESOLUTION_DISPUTE" and issue.verified_dispute_count >= 2:
                        issue.status = IssueStatus.ESCALATED
                        issue.timeline.append(TimelineEvent(
                            id=f"EVT-{now}",
                            event_type="RESOLUTION_DISPUTED",
                            created_at=now,
                            from_status=old_status,
                            to_status=IssueStatus.ESCALATED,
                            event_payload={"reason": "Community photo-backed disputes exceeded threshold (>=2)"}
                        ))
                    elif action == "RESOLUTION_VERIFY" and issue.verified_confirm_count >= 3:
                        issue.status = IssueStatus.RESOLVED
                        issue.resolved_at = now
                        issue.timeline.append(TimelineEvent(
                            id=f"EVT-{now}",
                            event_type="COMMUNITY_VERIFIED_SOLVED",
                            created_at=now,
                            from_status=old_status,
                            to_status=IssueStatus.RESOLVED,
                            event_payload={"reason": "Community consensus confirmed resolution (>=3)"}
                        ))

                issue.last_updated_at = now
                timeline_json = json.dumps([t.model_dump() for t in issue.timeline])

                await conn.execute("""
                    UPDATE civic_issues SET
                        status = $2,
                        consensus_score = $3,
                        verified_confirm_count = $4,
                        verified_dispute_count = $5,
                        last_updated_at = $6,
                        resolved_at = $7,
                        timeline = $8::jsonb
                    WHERE id = $1
                """,
                    issue.id,
                    issue.status.value if hasattr(issue.status, 'value') else issue.status,
                    issue.consensus_score,
                    issue.verified_confirm_count,
                    issue.verified_dispute_count,
                    issue.last_updated_at,
                    issue.resolved_at,
                    timeline_json
                )

                # Broadcast live event
                await global_event_broadcaster.broadcast("ISSUE_VERIFIED", issue.model_dump())
                return issue

    async def get_stats(self) -> Dict[str, Any]:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT
                    COUNT(*) as total_issues,
                    COUNT(*) FILTER (WHERE status = 'COMMUNITY_CORROBORATED') as corroborated_issues,
                    COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_issues,
                    COUNT(*) FILTER (WHERE status = 'ESCALATED') as escalated_issues,
                    COALESCE(SUM(verified_confirm_count + verified_dispute_count), 0) as total_local_verifications
                FROM civic_issues
            """)
            return {
                "total_issues": row["total_issues"],
                "corroborated_issues": row["corroborated_issues"],
                "resolved_issues": row["resolved_issues"],
                "escalated_issues": row["escalated_issues"],
                "total_local_verifications": int(row["total_local_verifications"]),
            }

    def _row_to_issue(self, row) -> Issue:
        timeline_data = row["timeline"]
        if isinstance(timeline_data, str):
            timeline_data = json.loads(timeline_data)
        timeline = [TimelineEvent(**t) for t in (timeline_data or [])]

        return Issue(
            id=row["id"],
            category=IssueCategory(row["category"]),
            status=IssueStatus(row["status"]),
            digipin_code=row["digipin_code"],
            lat=row["lat"],
            lon=row["lon"],
            description_neutral=row["description_neutral"],
            jurisdiction_authority=row["jurisdiction_authority"],
            assigned_department=row["assigned_department"],
            first_reported_at=row["first_reported_at"],
            last_updated_at=row["last_updated_at"],
            resolution_claimed_at=row.get("resolution_claimed_at"),
            resolved_at=row.get("resolved_at"),
            consensus_score=row["consensus_score"],
            verified_confirm_count=row["verified_confirm_count"],
            verified_dispute_count=row["verified_dispute_count"],
            timeline=timeline
        )
