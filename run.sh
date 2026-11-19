#!/bin/sh
# One command: (first run: create venv) -> sync the scale -> parse -> open the card test page.
# Wake the scale first (tap it) and close other apps that may be connected to it.
set -e
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q bleak; }
.venv/bin/python tools/sync.py
LOG=$(ls -t data/scale_log_*.txt | head -1)
.venv/bin/python tools/parse.py "$LOG" data/brews.json
echo "open http://127.0.0.1:8766/card/test.html  (Ctrl+C stops the server)"
(sleep 1; open http://127.0.0.1:8766/card/test.html) &
python3 -m http.server 8766 --bind 127.0.0.1 >/dev/null
