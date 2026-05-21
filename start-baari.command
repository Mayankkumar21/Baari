#!/bin/bash
# Baari one-click launcher for macOS.
# Double-click this file in Finder. First run downloads images (~1 min);
# later runs start in a few seconds.

cd "$(dirname "$0")"

echo "==================================================="
echo "   Baari — starting up. Please keep this window open."
echo "==================================================="
echo ""

# 1. Make sure Docker Desktop is running
if ! docker info >/dev/null 2>&1; then
  echo "→ Launching Docker Desktop (first launch can take ~30 seconds)…"
  open -a Docker || {
    echo ""
    echo "❌ Docker Desktop isn't installed."
    echo "   Install it from https://www.docker.com/products/docker-desktop"
    echo "   then double-click this file again."
    echo ""
    read -n 1 -s -r -p "Press any key to close."
    exit 1
  }
  printf "   Waiting for Docker to be ready"
  until docker info >/dev/null 2>&1; do printf "."; sleep 2; done
  echo " ready."
fi

# 2. Open the browser automatically once the server responds
(
  until curl -s http://localhost:8000/healthz >/dev/null 2>&1; do sleep 2; done
  open "http://localhost:8000"
) &

# 3. Build + run. Ctrl+C (or closing this window) stops the app.
echo "→ Starting Baari…  the app will open in your browser automatically."
echo "   To stop Baari later: close this window."
echo ""
docker compose up --build
