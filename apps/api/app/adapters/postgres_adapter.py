import os
import json
import time
import asyncio
import logging
from urllib.parse import urlparse
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from apps.api.app.adapters.base import DatabaseAdapter, global_event_broadcaster
from apps.api.app.models import (
    Issue,
    IssueStatus,
    IssueCategory,
    IssueEvent,
    EventType,
    EvidenceMedia
)

logger = logging.getLogger("civictrace.postgres")


class PostgresDatabaseAdapter(DatabaseAdapter):
    """
    DEEP MODULE: Production PostgreSQL (+ optional PostGIS) database adapter.
    Encapsulates asyncpg connection pooling, automated database/table provisioning,
    spatial bounding-box queries, and real-time LISTEN/NOTIFY cluster sync.
    """
    def __init__(self, database_url: str):
        self.database_url = database_url
        self._pool = None
        self._listener_task = None
        self._listener_conn = None

    async def initialize(self):
        """Initializes connection pool, auto-provisions database & schema."""
        import asyncpg

        # 1. Ensure target database exists; if not, auto-create via maintenance DB
        await self._ensure_database_exists()

        # 2. Establish connection pool
        try:
            self._pool = await asyncpg.create_pool(
                self.database_url,
                min_size=1,
                max_size=10,
                command_timeout=30
            )
            logger.info("PostgreSQL connection pool established successfully.")
        except Exception as e:
            logger.error(f"Failed to create PostgreSQL pool: {e}")
            raise

        # 3. Run table migrations and indexes
        await self._run_migrations()

        # 4. Auto-seed if explicitly enabled
        if os.getenv("AUTO_SEED", "0").lower() in ("1", "true"):
            await self.seed_initial_data()

        # 5. Start background real-time LISTEN worker
        self._listener_task = asyncio.create_task(self._listen_worker())

    async def _ensure_database_exists(self):
        """Checks if the target database exists; if not, creates it using the default database."""
        import asyncpg

        parsed = urlparse(self.database_url)
        target_db = parsed.path.lstrip("/") or "civictrace"

        # Try connecting directly first
        try:
            conn = await asyncpg.connect(self.database_url, timeout=5)
            await conn.close()
            return
        except asyncpg.InvalidCatalogNameError:
            logger.info(f"Target database '{target_db}' does not exist. Auto-creating...")
        except Exception:
            # Let pool creation report any auth/network errors
            return

        # Connect to default maintenance database 'postgres' to create target db
        maintenance_url = self.database_url.replace(f"/{target_db}", "/postgres")
        try:
            mconn = await asyncpg.connect(maintenance_url, timeout=5)
            # Cannot use parameterized query for CREATE DATABASE
            safe_db_name = "".join(c for c in target_db if c.isalnum() or c == "_")
            await mconn.execute(f'CREATE DATABASE "{safe_db_name}";')
            await mconn.close()
            logger.info(f"Successfully created PostgreSQL database '{safe_db_name}'.")
        except Exception as e:
            logger.warning(f"Could not auto-create database '{target_db}': {e}")

    async def _run_migrations(self):
        """Creates tables, extensions, indexes, and triggers."""
        async with self._pool.acquire() as conn:
            # Try PostGIS extension gracefully
            try:
                await conn.execute("""
                    DO $$
                    BEGIN
                        CREATE EXTENSION IF NOT EXISTS postgis;
                    EXCEPTION WHEN OTHERS THEN
                        RAISE NOTICE 'PostGIS extension not available; using standard coordinate indexing.';
                    END $$;
                """)
            except Exception as e:
                logger.info(f"PostGIS extension skipped: {e}")

            # Create civic_issues table matching Issue model
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS civic_issues (
                    id VARCHAR(64) PRIMARY KEY,
                    category VARCHAR(64) NOT NULL,
                    status VARCHAR(64) NOT NULL DEFAULT 'REPORTED',
                    digipin_code VARCHAR(16) NOT NULL,
                    digipin_l8 VARCHAR(16) NOT NULL DEFAULT '',
                    digipin_l6 VARCHAR(16) NOT NULL DEFAULT '',
                    lat DOUBLE PRECISION NOT NULL,
                    lon DOUBLE PRECISION NOT NULL,
                    description_neutral TEXT NOT NULL,
                    severity_score INT NOT NULL DEFAULT 2,
                    jurisdiction_authority VARCHAR(255) NOT NULL,
                    assigned_department VARCHAR(255) NOT NULL,
                    ward_name VARCHAR(255),
                    verified_confirm_count INT NOT NULL DEFAULT 1,
                    verified_dispute_count INT NOT NULL DEFAULT 0,
                    sightings_count INT NOT NULL DEFAULT 1,
                    consensus_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                    first_reported_at TIMESTAMPTZ NOT NULL,
                    last_activity_at TIMESTAMPTZ NOT NULL,
                    escalation_deadline TIMESTAMPTZ NOT NULL,
                    resolution_window_expires_at TIMESTAMPTZ,
                    resolved_at TIMESTAMPTZ,
                    evidence_list JSONB DEFAULT '[]'::jsonb,
                    timeline JSONB DEFAULT '[]'::jsonb
                );

                CREATE INDEX IF NOT EXISTS idx_civic_issues_coords ON civic_issues(lat, lon);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_digipin ON civic_issues(digipin_code);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON civic_issues(status);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_category ON civic_issues(category);
                CREATE INDEX IF NOT EXISTS idx_civic_issues_activity ON civic_issues(last_activity_at DESC);

                CREATE TABLE IF NOT EXISTS civic_nullifiers (
                    issue_id VARCHAR(64) NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
                    nullifier_hash VARCHAR(64) NOT NULL,
                    created_at BIGINT NOT NULL,
                    PRIMARY KEY (issue_id, nullifier_hash)
                );

                CREATE TABLE IF NOT EXISTS civic_community_notes (
                    id VARCHAR(64) PRIMARY KEY,
                    issue_id VARCHAR(64) NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
                    participant_badge VARCHAR(64) NOT NULL,
                    stance VARCHAR(32) NOT NULL DEFAULT 'NEUTRAL',
                    is_consensus_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    nullifier_hash VARCHAR(64),
                    lat DOUBLE PRECISION,
                    lon DOUBLE PRECISION,
                    text TEXT NOT NULL DEFAULT '',
                    media_urls JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL
                );

                -- Dynamic schema migrations for existing database
                ALTER TABLE civic_community_notes ADD COLUMN IF NOT EXISTS stance VARCHAR(32) NOT NULL DEFAULT 'NEUTRAL';
                ALTER TABLE civic_community_notes ADD COLUMN IF NOT EXISTS is_consensus_verified BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE civic_community_notes ADD COLUMN IF NOT EXISTS nullifier_hash VARCHAR(64);
                ALTER TABLE civic_community_notes ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
                ALTER TABLE civic_community_notes ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;

                CREATE INDEX IF NOT EXISTS idx_notes_issue_created ON civic_community_notes(issue_id, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_notes_nullifier ON civic_community_notes(issue_id, nullifier_hash);
            """)

            # Event trigger for real-time pub/sub
            try:
                await conn.execute("""
                    CREATE OR REPLACE FUNCTION notify_civic_event() RETURNS trigger AS $$
                    BEGIN
                        PERFORM pg_notify('civic_events', json_build_object(
                            'event_type', TG_OP,
                            'id', NEW.id,
                            'category', NEW.category,
                            'status', NEW.status,
                            'digipin_code', NEW.digipin_code,
                            'lat', NEW.lat,
                            'lon', NEW.lon,
                            'consensus_score', NEW.consensus_score,
                            'verified_confirm_count', NEW.verified_confirm_count,
                            'verified_dispute_count', NEW.verified_dispute_count
                        )::text);
                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;

                    DROP TRIGGER IF EXISTS trigger_civic_issue_notify ON civic_issues;
                    CREATE TRIGGER trigger_civic_issue_notify
                        AFTER INSERT OR UPDATE ON civic_issues
                        FOR EACH ROW EXECUTE FUNCTION notify_civic_event();
                """)
            except Exception as e:
                logger.warning(f"Could not register PostgreSQL notify trigger: {e}")

    async def _listen_worker(self):
        """Listens on PostgreSQL channel for real-time cluster updates."""
        import asyncpg
        while True:
            try:
                self._listener_conn = await asyncpg.connect(self.database_url)
                await self._listener_conn.add_listener("civic_events", self._handle_pg_notify)
                logger.info("Subscribed to PostgreSQL 'civic_events' channel.")
                while True:
                    await asyncio.sleep(60)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"PostgreSQL LISTEN worker disconnected: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)

    def _handle_pg_notify(self, connection, pid, channel, payload):
        try:
            event = json.loads(payload)
            event_type = "ISSUE_CREATED" if event.get("event_type") == "INSERT" else "ISSUE_VERIFIED"
            asyncio.create_task(
                global_event_broadcaster.broadcast(event_type, event)
            )
        except Exception as e:
            logger.error(f"Error handling PostgreSQL notification: {e}")

    async def _ensure_pool(self):
        if self._pool is None:
            await self.initialize()

    async def get_by_id(self, issue_id: str) -> Optional[Issue]:
        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM civic_issues WHERE id = $1", issue_id)
            if not row:
                return None
            return self._row_to_issue(row)

    async def get_all(
        self,
        category: Optional[Any] = None,
        status: Optional[Any] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lon: Optional[float] = None,
        max_lon: Optional[float] = None,
    ) -> List[Issue]:
        query = "SELECT * FROM civic_issues WHERE 1=1"
        params = []

        if category and category != "ALL":
            cat_val = category.value if hasattr(category, 'value') else str(category)
            params.append(cat_val)
            query += f" AND category = ${len(params)}"

        if status and status != "ALL":
            stat_val = status.value if hasattr(status, 'value') else str(status)
            params.append(stat_val)
            query += f" AND status = ${len(params)}"

        if min_lat is not None:
            params.append(min_lat)
            query += f" AND lat >= ${len(params)}"

        if max_lat is not None:
            params.append(max_lat)
            query += f" AND lat <= ${len(params)}"

        if min_lon is not None:
            params.append(min_lon)
            query += f" AND lon >= ${len(params)}"

        if max_lon is not None:
            params.append(max_lon)
            query += f" AND lon <= ${len(params)}"

        query += " ORDER BY last_activity_at DESC"

        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [self._row_to_issue(r) for r in rows]

    async def save(self, issue: Issue) -> Issue:
        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            evidence_json = json.dumps([e.model_dump(mode="json") for e in issue.evidence_list])
            timeline_json = json.dumps([t.model_dump(mode="json") for t in issue.timeline])

            await conn.execute("""
                INSERT INTO civic_issues (
                    id, category, status, digipin_code, digipin_l8, digipin_l6,
                    lat, lon, description_neutral, severity_score, jurisdiction_authority,
                    assigned_department, ward_name, verified_confirm_count, verified_dispute_count,
                    sightings_count, consensus_score, first_reported_at, last_activity_at,
                    escalation_deadline, resolution_window_expires_at, resolved_at,
                    evidence_list, timeline
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11,
                    $12, $13, $14, $15,
                    $16, $17, $18, $19,
                    $20, $21, $22,
                    $23::jsonb, $24::jsonb
                )
                ON CONFLICT (id) DO UPDATE SET
                    category = EXCLUDED.category,
                    status = EXCLUDED.status,
                    digipin_code = EXCLUDED.digipin_code,
                    digipin_l8 = EXCLUDED.digipin_l8,
                    digipin_l6 = EXCLUDED.digipin_l6,
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    description_neutral = EXCLUDED.description_neutral,
                    severity_score = EXCLUDED.severity_score,
                    jurisdiction_authority = EXCLUDED.jurisdiction_authority,
                    assigned_department = EXCLUDED.assigned_department,
                    ward_name = EXCLUDED.ward_name,
                    verified_confirm_count = EXCLUDED.verified_confirm_count,
                    verified_dispute_count = EXCLUDED.verified_dispute_count,
                    sightings_count = EXCLUDED.sightings_count,
                    consensus_score = EXCLUDED.consensus_score,
                    last_activity_at = EXCLUDED.last_activity_at,
                    escalation_deadline = EXCLUDED.escalation_deadline,
                    resolution_window_expires_at = EXCLUDED.resolution_window_expires_at,
                    resolved_at = EXCLUDED.resolved_at,
                    evidence_list = EXCLUDED.evidence_list,
                    timeline = EXCLUDED.timeline
            """,
                issue.id,
                issue.category.value if hasattr(issue.category, 'value') else issue.category,
                issue.status.value if hasattr(issue.status, 'value') else issue.status,
                issue.digipin_code,
                issue.digipin_l8,
                issue.digipin_l6,
                issue.lat,
                issue.lon,
                issue.description_neutral,
                issue.severity_score,
                issue.jurisdiction_authority,
                issue.assigned_department,
                issue.ward_name,
                issue.verified_confirm_count,
                issue.verified_dispute_count,
                issue.sightings_count,
                issue.consensus_score,
                issue.first_reported_at,
                issue.last_activity_at,
                issue.escalation_deadline,
                issue.resolution_window_expires_at,
                issue.resolved_at,
                evidence_json,
                timeline_json
            )
            return issue

    async def seed_initial_data(self):
        """Seeds initial demo civic issues if the table is currently empty."""
        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM civic_issues")
            if count > 0:
                return

            logger.info("Seeding initial demo civic issues into PostgreSQL...")
            from apps.api.app.adapters.in_memory import InMemoryDatabaseAdapter
            dummy = InMemoryDatabaseAdapter()
            for issue in dummy._issues.values():
                await self.save(issue)
            logger.info(f"Seeded {len(dummy._issues)} initial issues successfully.")

    async def close(self):
        """Cleanly releases connections and shuts down background listeners."""
        if self._listener_task:
            self._listener_task.cancel()
        if self._listener_conn:
            try:
                await self._listener_conn.close()
            except Exception:
                pass
        if self._pool:
            await self._pool.close()
            logger.info("PostgreSQL connection pool closed.")

    def _row_to_issue(self, row) -> Issue:
        timeline_data = row["timeline"]
        if isinstance(timeline_data, str):
            timeline_data = json.loads(timeline_data)
        timeline = [IssueEvent(**t) for t in (timeline_data or [])]

        evidence_data = row["evidence_list"]
        if isinstance(evidence_data, str):
            evidence_data = json.loads(evidence_data)
        evidence = [EvidenceMedia(**e) for e in (evidence_data or [])]

        return Issue(
            id=row["id"],
            category=IssueCategory(row["category"]),
            status=IssueStatus(row["status"]),
            digipin_code=row["digipin_code"],
            digipin_l8=row["digipin_l8"] or "",
            digipin_l6=row["digipin_l6"] or "",
            lat=float(row["lat"]),
            lon=float(row["lon"]),
            description_neutral=row["description_neutral"],
            severity_score=row["severity_score"],
            jurisdiction_authority=row["jurisdiction_authority"],
            assigned_department=row["assigned_department"],
            ward_name=row["ward_name"],
            verified_confirm_count=row["verified_confirm_count"],
            verified_dispute_count=row["verified_dispute_count"],
            sightings_count=row["sightings_count"],
            consensus_score=float(row["consensus_score"]),
            first_reported_at=row["first_reported_at"],
            last_activity_at=row["last_activity_at"],
            escalation_deadline=row["escalation_deadline"],
            resolution_window_expires_at=row["resolution_window_expires_at"],
            resolved_at=row["resolved_at"],
            evidence_list=evidence,
            timeline=timeline
        )

    async def get_community_notes(self, issue_id: str) -> List[Dict[str, Any]]:
        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, issue_id, participant_badge, stance, is_consensus_verified, text, media_urls, created_at 
                   FROM civic_community_notes 
                   WHERE issue_id = $1 
                   ORDER BY created_at DESC""",
                issue_id
            )
            notes = []
            for r in rows:
                media_urls = r["media_urls"]
                if isinstance(media_urls, str):
                    media_urls = json.loads(media_urls)
                created_at = r["created_at"].isoformat() if hasattr(r["created_at"], "isoformat") else str(r["created_at"])
                notes.append({
                    "id": r["id"],
                    "issue_id": r["issue_id"],
                    "participant_badge": r["participant_badge"],
                    "stance": r.get("stance", "NEUTRAL") if "stance" in r else "NEUTRAL",
                    "is_consensus_verified": bool(r.get("is_consensus_verified", False)) if "is_consensus_verified" in r else False,
                    "text": r["text"],
                    "media_urls": media_urls or [],
                    "created_at": created_at
                })
            return notes

    async def save_community_note(self, note: Dict[str, Any]) -> Dict[str, Any]:
        await self._ensure_pool()
        async with self._pool.acquire() as conn:
            media_json = json.dumps(note.get("media_urls", []))
            created_at = note.get("created_at")
            if isinstance(created_at, str):
                try:
                    created_at = datetime.fromisoformat(created_at)
                except Exception:
                    created_at = datetime.utcnow()
            elif not isinstance(created_at, datetime):
                created_at = datetime.utcnow()

            await conn.execute("""
                INSERT INTO civic_community_notes (
                    id, issue_id, participant_badge, stance, is_consensus_verified, nullifier_hash, lat, lon, text, media_urls, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
            """,
                note["id"],
                note["issue_id"],
                note["participant_badge"],
                note.get("stance", "NEUTRAL"),
                bool(note.get("is_consensus_verified", False)),
                note.get("nullifier_hash"),
                None, # Ephemeral proximity: raw lat is never persisted (ADR 0002, 0015)
                None, # Ephemeral proximity: raw lon is never persisted (ADR 0002, 0015)
                note.get("text", ""),
                media_json,
                created_at
            )
            return note
