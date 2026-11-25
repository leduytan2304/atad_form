#!/usr/bin/env bash
# Chạy đồng thời backend (FastAPI :8000) và frontend (Next.js :3000).
set -e
cd "$(dirname "$0")"

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install)
fi

(cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT INT TERM
wait
