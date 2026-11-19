"""Make a small JSON file for Home Assistant from the parsed brews.

usage: python3 export.py [data/brews.json] [data/brews_ha.json]
Keeps only real brews, drops fields the card does not use, and keeps curves only for brews with a known real time and enough samples.
Copy the result to /config/www/mavo-lumicurve/brews.json and point the card at /local/mavo-lumicurve/brews.json (see docs/INSTALL-HA.md)."""
import json, os, sys

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, "data", "brews.json")
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, "data", "brews_ha.json")
out = []
for b in json.load(open(src)):
    if not b.get("valid", True):
        continue
    o = {k: b[k] for k in ("seq", "ts", "real_ts", "mode", "yield_g", "time_s", "flow_gs", "dose_g", "ratio")}
    if b.get("real_ts") and len(b.get("curve", [])) >= 5:
        o["curve"] = [[t, round(g, 1)] for t, g in b["curve"]]
    out.append(o)
json.dump(out, open(dst, "w"), separators=(",", ":"))
print(len(out), "brews ->", dst, f"({os.path.getsize(dst)} bytes)")
