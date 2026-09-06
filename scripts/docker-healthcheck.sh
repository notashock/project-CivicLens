#!/bin/sh
set -e

# ==============================================================================
# CivicTrace Unified Health Monitor
# Checks both FastAPI Backend (:8000) and Next.js Frontend (:3000)
# ==============================================================================

API_PORT="${API_PORT:-8000}"
WEB_PORT="${PORT:-3000}"

# 1. Check API Liveness & Database Connectivity
API_HEALTH=$(curl -sf -m 3 "http://127.0.0.1:${API_PORT}/health" 2>/dev/null || echo "FAILED")
if [ "$API_HEALTH" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] FastAPI /health endpoint unreachable on port ${API_PORT}" >&2
    exit 1
fi

# 2. Check API Readiness
API_READY=$(curl -sf -m 3 "http://127.0.0.1:${API_PORT}/ready" 2>/dev/null || echo "FAILED")
if [ "$API_READY" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] FastAPI /ready endpoint returned non-200 status on port ${API_PORT}" >&2
    exit 1
fi

# 3. Check Next.js Frontend Server
WEB_STATUS=$(curl -sf -m 3 -o /dev/null -w "%{http_code}" "http://127.0.0.1:${WEB_PORT}/" 2>/dev/null || echo "FAILED")
if [ "$WEB_STATUS" = "FAILED" ]; then
    echo "[HEALTHCHECK FAILED] Next.js frontend unreachable on port ${WEB_PORT}" >&2
    exit 1
fi

echo "[HEALTHCHECK OK] FastAPI (:${API_PORT}) and Next.js (:${WEB_PORT}) healthy and ready"
exit 0
