#!/bin/sh
set -e

# ==============================================================================
# CivicTrace Unified Health Monitor
# Checks both FastAPI Backend (:8000) and Next.js Frontend (:3000)
# ==============================================================================

# 1. Check API Liveness & Database Connectivity
API_HEALTH=$(curl -sf -m 3 http://127.0.0.1:8000/health 2>/dev/null || echo "FAILED")
if [ "$API_HEALTH" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] FastAPI /health endpoint unreachable" >&2
    exit 1
fi

# 2. Check API Readiness
API_READY=$(curl -sf -m 3 http://127.0.0.1:8000/ready 2>/dev/null || echo "FAILED")
if [ "$API_READY" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] FastAPI /ready endpoint returned non-200 status" >&2
    exit 1
fi

# 3. Check Next.js Frontend Server
WEB_STATUS=$(curl -sf -m 3 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ 2>/dev/null || echo "FAILED")
if [ "$WEB_STATUS" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] Next.js frontend on port 3000 unreachable" >&2
    exit 1
fi

echo "[HEALTHCHECK OK] FastAPI (:8000) and Next.js (:3000) healthy and ready"
exit 0
