-- ==============================================================================
-- CivicTrace Production PostgreSQL + PostGIS Schema
-- ==============================================================================

-- 1. Conditionally Enable PostGIS Spatial Extension if available
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PostGIS extension not available in environment; using standard spatial indexing.';
END $$;

-- 2. Civic Issues Primary Ledger
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

-- 3. Spatial & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_civic_issues_coords ON civic_issues(lat, lon);
CREATE INDEX IF NOT EXISTS idx_civic_issues_digipin ON civic_issues(digipin_code);
CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON civic_issues(status);
CREATE INDEX IF NOT EXISTS idx_civic_issues_category ON civic_issues(category);
CREATE INDEX IF NOT EXISTS idx_civic_issues_activity ON civic_issues(last_activity_at DESC);

-- 4. Hardware-Attested Anti-Sybil Nullifier Ledger
-- Enforces strictly one mutually exclusive action per device per issue
CREATE TABLE IF NOT EXISTS civic_nullifiers (
    issue_id VARCHAR(64) NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    nullifier_hash VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (issue_id, nullifier_hash)
);

-- 5. Anonymous Community Notes & Attestations Ledger
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
CREATE INDEX IF NOT EXISTS idx_notes_issue_created ON civic_community_notes(issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_nullifier ON civic_community_notes(issue_id, nullifier_hash);

-- 6. Real-Time Event Notification Trigger
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
