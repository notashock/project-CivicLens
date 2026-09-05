# CivicTrace

*An Anonymous, Community-Verified Civic Accountability Platform.*

> **"Report anonymously. Verify locally. Speak collectively. Track publicly."**

---

## 🏛️ Core Principles & Architecture

1. **The Issue is the Primary Entity:** Zero accounts, zero PII, no user profiles, phone numbers, or passwords. Citizens act strictly as anonymous, ephemeral witnesses.
2. **India's DIGIPIN Standard:** Primary spatial reference utilizing the 10-character alphanumeric **DIGIPIN** grid standard ($\approx 4\text{m} \times 4\text{m}$ resolution). Raw GPS coordinates are discarded immediately after ephemeral proximity verification.
3. **Hardware Anti-Sybil (WebAuthn PRF Nullifiers):** Enforces strictly **one net vote per issue per physical device** using deterministic device-bound nullifiers (`HMAC-SHA256(PRK, IssueID || Action)`) with zero cross-issue linkability.
4. **Unified Attestation Notes & Evidence Promotion (ADR 0014):**
   - Community notes and hardware attestations are unified into a single ledger stream.
   - **<500m Spatial Quorum:** Notes and photos uploaded by ground witnesses within 500 meters of the DIGIPIN centroid automatically increment consensus quorum scores and promote evidence photos to the official issue gallery.
   - **Anti-Flip-Flop Rate Limiting:** 15-minute cooldown between opinion changes on the same issue. Factual neutral updates and photos are permitted anytime.
5. **Dual-Tier Neutrality & PII Moderation:** Automated client-side and server-side filtering blocking political parties, named politicians, and personal contact details, ensuring neutral, objective public records.
6. **Zero Mock Pollution:** Storage adapters start clean with no sample mock data in development or production.

---

## 📦 Monorepo Architecture

```
project-CivicLens/
├── .github/
│   └── workflows/
│       └── ci.yml                             # Automated GitHub Actions CI (Node & Python tests)
├── docs/
│   ├── ARCHITECTURE_SPEC.md                   # Full system technical specification
│   └── adr/                                   # Architectural Decision Records (ADR 0001 - 0014)
│       ├── 0001-webauthn-prf-nullifiers.md
│       ├── 0002-ephemeral-proximity-verification.md
│       ├── 0003-dual-tier-media-sanitization.md
│       ├── 0004-quorum-resolution-verification.md
│       ├── 0005-postgis-mvt-vector-tiles.md
│       ├── 0006-modular-client-validation-and-neutrality-filter.md
│       ├── 0007-persistent-device-prk-and-issue-nullifier-mutual-exclusivity.md
│       ├── 0008-deterministic-spatial-categorical-issue-id.md
│       ├── 0009-unified-dev-mode-orchestration-and-seam-proxy.md
│       ├── 0010-consolidated-intake-pipeline-and-centroid-snapping.md
│       ├── 0011-consolidated-client-sanitization-pipeline.md
│       ├── 0012-dual-tier-political-neutrality-and-ocr-filter.md
│       ├── 0013-dedicated-community-notes-ledger-and-realtime-broadcast.md
│       └── 0014-unified-attestation-notes-and-quorum-evidence-promotion.md
├── packages/
│   ├── digipin/                               # Bidirectional GPS <-> 10-char DIGIPIN converter & proximity math
│   ├── crypto-nullifier/                      # WebAuthn PRF & HMAC-SHA256 anti-Sybil nullifier engine
│   └── sanitization-worker/                   # Canvas pre-blurring, EXIF stripping & neutrality worker
├── apps/
│   ├── api/                                   # FastAPI backend + PostGIS models + state machine + SSE streamer
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── database.py
│   │   │   ├── state_machine.py
│   │   │   └── services/
│   │   └── tests/                             # Pytest test suites (intake, attestation, neutrality, API)
│   └── web/                                   # Next.js 15 PWA Frontend (Leaflet + Tailwind + dynamic URL client)
│       ├── src/
│       └── tests/                             # Node unit tests for feed model, neutrality, and API resolution
├── scripts/
│   ├── dev.mjs                                # Dev orchestrator with port checking & supervisor
│   ├── orchestrator/                          # Port detection, readiness polling, and stream prefixing
│   └── tests/                                 # Orchestrator & network readiness tests
├── schema.sql                                 # PostgreSQL / PostGIS DDL schema
└── package.json
```

---

## 🚀 Getting Started Locally

### 1. Unified Dev Orchestrator (Recommended)

Boot both the FastAPI backend and Next.js frontend concurrently with port management, health polling, and prefixed logs in one command:

```bash
# Start both API (:8000) and Web (:3000)
npm run dev

# Or start individually
npm run dev:api     # Backend only
npm run dev:web     # Frontend only
```

- **Web Frontend**: `http://localhost:3000`
- **API Swagger Docs**: `http://localhost:8000/docs`
- **API Health Check**: `http://localhost:8000/health`

### 2. Manual Startup

#### Start Core API Backend
```bash
python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Start Next.js 15 Frontend
```bash
npm run dev --workspace=@civictrace/web
```

---

## 🧪 Testing & Verification

The codebase includes comprehensive unit, connection, and integration tests across all packages and services (56+ tests passing):

```bash
# 1. Run all Monorepo TypeScript & Web Unit Tests (28 tests)
npm test

# 2. Run Connection & Readiness Probing Tests (8 tests)
npm run test:orchestrator

# 3. Run Python Backend Pytest Suite (28 tests)
python -m pytest apps/api/tests -v

# 4. Production Build Verification
npm run build
```

---

## ⚙️ Continuous Integration (CI)

A GitHub Actions workflow is configured in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) to run on every commit and pull request to `main`:

- **Node.js Unit & Connection Tests**: Compiles TypeScript packages, validates Next.js production build, tests network readiness probing, and runs monorepo unit tests.
- **Python Backend API & Connection Tests**: Installs Python dependencies, executes full pytest suite, and performs live server boot with HTTP `/health` and `/ready` validation.
