-- ==============================================================================
-- CivicTrace Production PostgreSQL + PostGIS Schema
-- ==============================================================================

-- 1. Enable PostGIS Spatial Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Civic Issues Primary Ledger
CREATE TABLE IF NOT EXISTS civic_issues (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'REPORTED',
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

-- 3. High-Performance Spatial & Filter Indexes
CREATE INDEX IF NOT EXISTS idx_civic_issues_geom ON civic_issues USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_civic_issues_digipin ON civic_issues(digipin_code);
CREATE INDEX IF NOT EXISTS idx_civic_issues_status ON civic_issues(status);
CREATE INDEX IF NOT EXISTS idx_civic_issues_category ON civic_issues(category);
CREATE INDEX IF NOT EXISTS idx_civic_issues_updated ON civic_issues(last_updated_at DESC);

-- 4. Hardware-Attested Anti-Sybil Nullifier Ledger
-- Enforces strictly one mutually exclusive action per device per issue
CREATE TABLE IF NOT EXISTS civic_nullifiers (
    issue_id VARCHAR(64) NOT NULL REFERENCES civic_issues(id) ON DELETE CASCADE,
    nullifier_hash VARCHAR(64) NOT NULL,
    created_at BIGINT NOT NULL,
    PRIMARY KEY (issue_id, nullifier_hash)
);

-- 5. Real-Time Event Notification Trigger
CREATE OR REPLACE FUNCTION notify_civic_event() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('civic_events', json_build_object(
        'event_type', TG_OP,
        'data', row_to_json(NEW)
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_civic_issue_notify ON civic_issues;
CREATE TRIGGER trigger_civic_issue_notify
    AFTER INSERT OR UPDATE ON civic_issues
    FOR EACH ROW EXECUTE FUNCTION notify_civic_event();
