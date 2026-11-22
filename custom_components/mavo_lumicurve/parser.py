"""Parse the Mavo Lumicurve (Lefu CK850) debug log into brews. Pure Python, no Home Assistant imports.

The log is chronological: it starts at the oldest line still in the scale's ring buffer and ends with the Bluetooth connection of the sync itself.
A brew ends at `[MP] weight num N time T` (T = seconds); its yield is the last settled `[SW] lock=A-B-C` before it (B = 0.1 g, C=1 means negative).

The scale has no real clock: after every cold boot (`[SYS] reboot reason`) it restarts at 2022-02-02 02:30. So `ts` is only that internal clock.
Inside one run (between two cold boots) the clock is continuous, also while the scale sleeps, so distances are exact. Every brew gets a `real_ts` and a `ts_src`:
- `exact`: the LAST run. The final log line is the sync's own connection, so real = synced_at - (last clock - brew clock).
- `latest`: an earlier run. The scale was off for an unknown time between two runs, so the real time is only an upper bound: the real start of the next run minus the clock distance.
Without `synced_at` (offline tools) `real_ts` stays None.
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


_EPOCH = datetime(2000, 1, 1)


def _secs(dt: datetime) -> float:
    return (dt - _EPOCH).total_seconds()


def _pos(run: dict, sdt: datetime | None, ela: int) -> float:
    """Position of a line on the run's clock in seconds. Lines before the run's first date line are placed relative to that line."""
    if sdt:
        return _secs(sdt)
    a = run.get("anchor")
    return a[0] - (a[1] - ela) if a else ela


def parse(text: str, synced_at: datetime | None = None, rules: dict | None = None) -> list[dict]:
    """Return the brews of one log, oldest first. `synced_at` is the real (naive local or UTC, caller's choice) time of the connection."""
    r = {**DEFAULT_RULES, **(rules or {})}
    brews, run, base, day_off, prev_tod = [], 0, None, 0, 0
    locks, last_lock, samples = [], None, []  # samples: (time of day in s, grams) of every weight line
    runs = [{}]  # per run: first/last line as (sdt, ela) and the first dated line as anchor
    for raw in text.splitlines():
        m = LINE.match(raw)
        if not m:
            continue
        h, mi, s, tag, msg = int(m[1]), int(m[2]), int(m[3]), m[4], m[5]
        tod = h * 3600 + mi * 60 + s
        if tag == "SYS" and "reboot reason" in msg:
            run, base, day_off = run + 1, None, 0
            runs.append({})
        d = DATE.search(msg) if tag == "SYS" else None
        pre = day_off * 86400 + tod  # clock before a date line resets the day counter
        if d:
            base, day_off = datetime(2000 + int(d[1]), int(d[2]), int(d[3])), 0
        elif tod + 43200 < prev_tod:  # clock passed midnight inside a session
            day_off += 1
        prev_tod = tod
        sdt = base + timedelta(days=day_off, seconds=tod) if base else None
        ela = day_off * 86400 + tod  # seconds on the scale's clock within this run (works without a date)
        R = runs[-1]
        if d:
            R.setdefault("anchor", (_secs(sdt), pre))
        R.setdefault("first", (sdt, ela))
        R["last"] = (sdt, ela)
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
                    "_ela": day_off * 86400 + tod,
                    "real_ts": None,
                    "ts_src": None,
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
    if synced_at:  # walk the runs backwards: `limit` = real time of the first line of the following run (the sync itself for the last run)
        limit = synced_at
        for k in range(len(runs) - 1, -1, -1):
            R = runs[k]
            if not R:
                continue
            end, first = _pos(R, *R["last"]), _pos(R, *R["first"])
            for b in brews:
                if b["run"] == k:
                    b["real_ts"] = (limit - timedelta(seconds=end - _pos(R, b["_sdt"], b["_ela"]))).strftime("%Y-%m-%d %H:%M:%S")
                    b["ts_src"] = "exact" if k == len(runs) - 1 else "latest"
            limit -= timedelta(seconds=end - first)
    for b in brews:
        del b["_sdt"], b["_ela"]
    return brews
