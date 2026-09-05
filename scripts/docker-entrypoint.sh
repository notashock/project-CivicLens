#!/bin/sh
set -e

# ==============================================================================
# CivicTrace Unified Application Supervisor & Entrypoint
# Manages FastAPI Backend, Next.js Frontend, Lifecycle Signals & Health
# ==============================================================================

echo "================================================================="
echo "   CivicTrace All-In-One Unified Application Container          "
echo "   Public Civic Accountability Ledger & Spatial Verification   "
echo "================================================================="

API_PORT="${API_PORT:-8000}"
WEB_PORT="${PORT:-3000}"
API_WORKERS="${API_WORKERS:-2}"

# Graceful shutdown handler
cleanup() {
    echo ""
    echo "[SUPERVISOR] Received termination signal. Initiating graceful shutdown..."
    
    if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" 2>/dev/null; then
        echo "[SUPERVISOR] Stopping Next.js Frontend (PID $WEB_PID)..."
        kill -TERM "$WEB_PID" 2>/dev/null || true
    fi

    if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
        echo "[SUPERVISOR] Stopping FastAPI Backend (PID $API_PID)..."
        kill -TERM "$API_PID" 2>/dev/null || true
    fi

    wait "$WEB_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
    echo "[SUPERVISOR] All services stopped. Container shutdown complete."
    exit 0
}

trap cleanup SIGTERM SIGINT SIGHUP

# 1. Start FastAPI Backend in background
echo "[SUPERVISOR] Starting FastAPI Backend on 0.0.0.0:${API_PORT} (${API_WORKERS} workers)..."
python -m uvicorn apps.api.app.main:app \
    --host 0.0.0.0 \
    --port "$API_PORT" \
    --workers "$API_WORKERS" &
API_PID=$!

# Wait for backend readiness before starting web service
echo "[SUPERVISOR] Waiting for FastAPI API readiness..."
MAX_WAIT=20
COUNT=0
while [ $COUNT -lt $MAX_WAIT ]; do
    if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
        echo "[SUPERVISOR] FastAPI Backend is healthy and ready."
        break
    fi
    sleep 1
    COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_WAIT ]; then
    echo "[SUPERVISOR WARNING] FastAPI did not report healthy within ${MAX_WAIT}s. Proceeding with frontend launch..."
fi

# 2. Start Next.js 15 Web Application
echo "[SUPERVISOR] Starting Next.js Frontend on 0.0.0.0:${WEB_PORT}..."
npm run start --workspace=@civictrace/web &
WEB_PID=$!

echo "[SUPERVISOR] Both services active (API PID: $API_PID | Web PID: $WEB_PID)."
echo "[SUPERVISOR] Container health monitoring active."

# 3. Active Supervisor Maintenance Loop
while true; do
    # Check if API process died
    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo "[SUPERVISOR ERROR] FastAPI Backend (PID $API_PID) exited unexpectedly!"
        cleanup
        exit 1
    fi

    # Check if Web process died
    if ! kill -0 "$WEB_PID" 2>/dev/null; then
        echo "[SUPERVISOR ERROR] Next.js Frontend (PID $WEB_PID) exited unexpectedly!"
        cleanup
        exit 1
    fi

    sleep 5
done
