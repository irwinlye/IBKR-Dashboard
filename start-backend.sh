#!/bin/bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/backend"
venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
