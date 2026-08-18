# CivicTrace

*An Anonymous, Community-Verified Civic Accountability Platform.*

> **"Report anonymously. Verify locally. Speak collectively. Track publicly."**

---

## 🏛️ Core Principles & Directives

1. **The Issue is the Primary Entity:** Zero accounts, zero PII, no user profiles, phone numbers, or passwords. Citizens are strictly anonymous, ephemeral witnesses.
2. **India's DIGIPIN Standard:** Primary spatial reference using the 10-character alphanumeric **DIGIPIN** grid standard ($\approx 4\text{m} \times 4\text{m}$ resolution). Raw GPS coordinates are discarded immediately from memory after proximity verification.
3. **Hardware Anti-Sybil (WebAuthn PRF):** Enforces strictly **one action per issue per physical participant** using deterministic device-bound nullifiers (`HMAC-SHA256(PRK, IssueID || Action)`) with zero cross-issue linkability.
4. **Quorum-Based Lifecycle:** 72-hour community verification window where $\ge 3$ local confirmations finalize resolution, while $\ge 2$ photo-backed local disputes reopen and escalate the issue.

---

## 📦 Monorepo Architecture

```
project-CivicLens/
├── CONTEXT.md                                 # Canonical domain vocabulary & ubiquitous language
├── docs/
│   └── adr/                                   # Architectural Decision Records (0001 - 0006)
│       ├── 0001-webauthn-prf-nullifiers.md
│       ├── 0002-ephemeral-proximity-verification.md
│       ├── 0003-dual-tier-media-sanitization.md
│       ├── 0004-quorum-resolution-verification.md
│       ├── 0005-postgis-mvt-vector-tiles.md
│       └── 0006-modular-client-validation-and-neutrality-filter.md
├── packages/
│   ├── digipin/                               # Bidirectional GPS <-> 10-char DIGIPIN converter & proximity math
│   ├── crypto-nullifier/                      # WebAuthn PRF & HMAC-SHA256 anti-Sybil nullifier engine
│   └── sanitization-worker/                   # Client Web Worker for Canvas pre-blur & structured narrative moderation
├── apps/
│   ├── api/                                   # FastAPI backend + PostGIS models + state machine + MVT streamer
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── database.py
│   │   │   ├── state_machine.py
│   │   │   └── services/
│   │   └── tests/
│   └── web/                                   # Next.js 15 PWA Frontend (MapLibre GL / Leaflet + Tailwind)
└── package.json
```

---

## 🚀 Getting Started Locally

### 1. Run Automated Unit Tests

```bash
# Test Core DIGIPIN Spatial Engine
npm.cmd run test --workspace=@civictrace/digipin

# Test Hardware Anti-Sybil Nullifiers
npm.cmd run test --workspace=@civictrace/crypto-nullifier

# Test Client Sanitization & Neutrality Pipeline
npm.cmd run test --workspace=@civictrace/sanitization-worker

# Test FastAPI Core Backend Endpoints
python -m pytest apps/api/tests/test_api.py -v
```

### 2. Start Core API Backend

```bash
python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at `http://127.0.0.1:8000/docs`.

### 3. Start Next.js 15 PWA Frontend

```bash
npm.cmd run dev --workspace=@civictrace/web
```
Open `http://localhost:3000` to interact with the map, anonymous report flow, and community ledger.
