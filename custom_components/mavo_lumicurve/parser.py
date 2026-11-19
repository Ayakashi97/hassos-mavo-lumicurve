"""Parse the Mavo Lumicurve (Lefu CK850) debug log into brews. Pure Python, no Home Assistant imports.

The log is chronological: it starts at the oldest line still in the scale's ring buffer and ends with the Bluetooth connection of the sync itself.
A brew ends at `[MP] weight num N time T` (T = seconds); its yield is the last settled `[SW] lock=A-B-C` before it (B = 0.1 g, C=1 means negative).

The scale has no real clock: after every cold boot (`[SYS] reboot reason`) it restarts at 2022-02-02 02:30. So `ts` is only that internal clock.
For the LAST boot the real time of the final log line is the moment of the sync, so `real_ts` is set for the brews of that run; earlier runs get `real_ts: None`.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

DEFAULT_RULES = {
    "pourover_min_s": 90,  # a brew of at least this many seconds counts as filter/pour-over
    "min_time_s": 8,  # shorter brews are tare/noise events
    "min_yield_g": 5,  # lighter brews are tare/noise events
    "dose_g": [10, 20],  # a settled weight in this range before the brew is taken as the dose
}

LINE = re.compile(r"^\[\s*(\d+):\s*(\d+):\s*(\d+)\][IDE] \[(\w+)\] (.*)$")
LOCK = re.compile(r"lock=(\d+)-(\d+)-(\d)")
DATE = re.compile(r"Date:(\d+)-(\d+)-(\d+)")
NUM = re.compile(r"weight num (\d+) time (\d+)")
RESTART = re.compile(r"restart=(\d+),")


def curve(samples, end, secs, final):
    """[[t_s, grams], ...] from the weight lines logged during the shot.

    The scale only logs when the weight settles, so espresso shots usually have 1-5 points near the end; slow pours have many.
    """
    start, pts = end - secs, {}
    for tod, g in samples:
        t = (tod - start + 43200) % 86400 - 43200  # signed, survives midnight
        if 0 <= t <= secs and g <= final + 1:
            pts[t] = g
    out, top = [[0, 0.0]], 0.0
    for t in sorted(pts):
        top = max(top, pts[t])  # weight never falls during a shot (cup lifts are dropped)
        if t > out[-1][0]:
            out.append([t, top])
    if out[-1][0] < secs:
        out.append([secs, final])
    return out


def parse(text: str, synced_at: datetime | None = None, rules: dict | None = None) -> list[dict]:
    """Return the brews of one log, oldest first. `synced_at` is the real (naive local or UTC, caller's choice) time of the connection."""
    r = {**DEFAULT_RULES, **(rules or {})}
    brews, run, base, day_off, prev_tod, end_sdt = [], 0, None, 0, 0, None
    locks, last_lock, samples = [], None, []  # samples: (time of day in s, grams) of every weight line
    for raw in text.splitlines():
        m = LINE.match(raw)
        if not m:
            continue
        h, mi, s, tag, msg = int(m[1]), int(m[2]), int(m[3]), m[4], m[5]
        tod = h * 3600 + mi * 60 + s
        if tag == "SYS" and "reboot reason" in msg:
            run, base, day_off = run + 1, None, 0
        d = DATE.search(msg) if tag == "SYS" else None
        if d:
            base, day_off = datetime(2000 + int(d[1]), int(d[2]), int(d[3])), 0
        elif tod + 43200 < prev_tod:  # clock passed midnight inside a session
            day_off += 1
        prev_tod = tod
        sdt = base + timedelta(days=day_off, seconds=tod) if base else None
        end_sdt = sdt or end_sdt
        if tag == "SYS":
            if "wakeup" in msg:
                locks, last_lock, samples = [], None, []
            continue
        if tag == "SW":
            k = LOCK.search(msg)
            if k:
                b, neg = int(k[2]), k[3] == "1"
                last_lock = None if neg else b
                if not neg:
                    locks.append(b)
                    samples.append((tod, b / 10))
            rs = RESTART.search(msg)
            if rs:  # raw units of 0.05 g
                samples.append((tod, int(rs[1]) / 20))
        elif tag == "MP":
            n = NUM.search(msg)
            if n and last_lock is not None:
                secs = int(n[2])
                lo, hi = r["dose_g"]
                dose = next((b for b in reversed(locks[:-1]) if lo * 10 <= b <= hi * 10), None)
                brews.append({
                    "seq": len(brews),  # file order = chronological order
                    "run": run,
                    "ts": sdt.strftime("%Y-%m-%d %H:%M:%S") if sdt else f"? {h:02d}:{mi:02d}:{s:02d}",
                    "_sdt": sdt,
                    "real_ts": None,
                    "mode": "pourover" if secs >= r["pourover_min_s"] else "espresso",
                    "valid": secs >= r["min_time_s"] and last_lock >= r["min_yield_g"] * 10,
                    "yield_g": last_lock / 10,
                    "time_s": secs,
                    "flow_gs": round(last_lock / 10 / secs, 2),  # average flow, g/s (~ml/s)
                    "dose_g": dose / 10 if dose else None,
                    "ratio": round(last_lock / dose, 2) if dose else None,
                    "curve": curve(samples, tod, secs, last_lock / 10),
                })
                locks, last_lock, samples = [], None, []
    if synced_at and end_sdt:  # the last log line is the sync's own BLE connection = real "now"
        off = synced_at - end_sdt
        for b in brews:
            if b["run"] == run and b["_sdt"]:
                b["real_ts"] = (b["_sdt"] + off).strftime("%Y-%m-%d %H:%M:%S")
    for b in brews:
        del b["_sdt"]
    return brews
