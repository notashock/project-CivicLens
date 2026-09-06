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
API_WORKERS="${API_WORKERS:-1}"

# Render Free Tier Memory Safeguards (512MB hard limit)
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"
export MALLOC_ARENA_MAX=2
export UV_THREADPOOL_SIZE=2
export PYTHONUNBUFFERED=1
export NEXT_TELEMETRY_DISABLED=1

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

trap cleanup TERM INT HUP

# 1. Start FastAPI Backend in background (constrained worker & concurrency for 512MB limit)
echo "[SUPERVISOR] Starting FastAPI Backend on 0.0.0.0:${API_PORT} (${API_WORKERS} worker, max 50 concurrent)..."
python -m uvicorn apps.api.app.main:app \
    --host 0.0.0.0 \
    --port "$API_PORT" \
    --workers "$API_WORKERS" \
    --limit-concurrency 50 \
    --backlog 128 \
    --timeout-keep-alive 15 &
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

# 2. Start Next.js 15 Web Application (direct process execution to eliminate npm wrapper RAM overhead)
echo "[SUPERVISOR] Starting Next.js Frontend on 0.0.0.0:${WEB_PORT} (V8 max heap: 192MB)..."
if [ -f "/app/apps/web/.next/standalone/apps/web/server.js" ]; then
    PORT="$WEB_PORT" node /app/apps/web/.next/standalone/apps/web/server.js &
elif [ -f "/app/apps/web/.next/standalone/server.js" ]; then
    PORT="$WEB_PORT" node /app/apps/web/.next/standalone/server.js &
elif [ -f "/app/.next/standalone/apps/web/server.js" ]; then
    PORT="$WEB_PORT" node /app/.next/standalone/apps/web/server.js &
elif [ -f "/app/node_modules/.bin/next" ]; then
    /app/node_modules/.bin/next start /app/apps/web -p "$WEB_PORT" &
else
    npm run start --workspace=@civictrace/web &
fi
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
