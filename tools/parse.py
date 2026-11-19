"""Parse a Mavo Lumicurve (Lefu CK850) debug log into brews.

usage: python3 parse.py scale_log_*.txt [out.json]
A brew ends at `[MP] weight num N time T` (T = seconds). Its yield is the last settled
`[SW] lock=A-B-C` before `weight stable stop` (B = 0.1 g, C=1 means negative).
The scale clock is not set (dates read 2022), so `ts` is the scale's own time, only good for ordering.
"""
import json, re, sys

LINE = re.compile(r"^\[\s*(\d+):\s*(\d+):\s*(\d+)\][IDE] \[(\w+)\] (.*)$")
LOCK = re.compile(r"lock=(\d+)-(\d+)-(\d)")
DATE = re.compile(r"Date:(\d+)-(\d+)-(\d+)")
NUM = re.compile(r"weight num (\d+) time (\d+)")


def parse(text):
    brews, date = [], None
    locks, last_lock, brew_start_idx = [], None, 0
    for raw in text.splitlines():
        m = LINE.match(raw)
        if not m:
            continue
        h, mi, s, tag, msg = int(m[1]), int(m[2]), int(m[3]), m[4], m[5]
        if tag == "SYS":
            d = DATE.search(msg)
            if d:
                date = "20%02d-%02d-%02d" % tuple(map(int, d.groups()))
            if "wakeup" in msg:
                locks, last_lock = [], None
            continue
        if tag == "SW":
            k = LOCK.search(msg)
            if k:
                b, neg = int(k[2]), k[3] == "1"
                last_lock = None if neg else b
                if not neg:
                    locks.append(b)
        elif tag == "MP":
            n = NUM.search(msg)
            if n and last_lock is not None:
                secs = int(n[2])
                dose = next((b for b in reversed(locks[:-1]) if 100 <= b <= 200), None)
                brews.append({
                    "ts": f"{date or '?'} {h:02d}:{mi:02d}:{s:02d}",
                    # the scale labels long pours "espresso" too, so classify by duration
                    "mode": "pourover" if secs >= 90 else "espresso",
                    # shots under 8 s or 5 g are tare/noise events, not drinks
                    "valid": secs >= 8 and last_lock >= 50,
                    "yield_g": last_lock / 10,
                    "time_s": secs,
                    "flow_gs": round(last_lock / 10 / secs, 2),  # average flow, g/s (~ml/s)
                    "dose_g": dose / 10 if dose else None,
                    "ratio": round(last_lock / dose, 2) if dose else None,
                })
                locks, last_lock = [], None
    return brews


if __name__ == "__main__":
    out = parse(open(sys.argv[1], errors="replace").read())
    json.dump(out, open(sys.argv[2], "w") if len(sys.argv) > 2 else sys.stdout, indent=1)
    print(len(out), "brews", file=sys.stderr)
