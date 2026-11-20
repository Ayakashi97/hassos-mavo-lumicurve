"""Brew storage logic: merge new log results into the stored history, derive the values the card needs, apply settings. Pure Python."""
from __future__ import annotations

import copy
from datetime import datetime

METRICS = ("time", "yield", "flow", "ratio")
MODES = ("espresso", "pourover")

DEFAULT_SETTINGS = {
    "pourover_min_s": 90,  # at least this long = filter, shorter = espresso
    "min_time_s": 8,  # shorter brews are tare/noise events
    "min_yield_g": 5,  # lighter brews are tare/noise events
    "dose_g": [10, 20],  # range of a settled weight before a brew that counts as the dose
    "flow_value": "auto",  # what the flow tile shows: auto, avg or peak
    "keep_curves": 200,  # espresso curves are kept for the newest N brews (pour-over curves always)
    "min_sync_interval_min": 10,  # minutes between two syncs
    "targets": {},  # {"espresso": {"time": [min, max], ...}, "pourover": {...}}
}
RAW_KEYS = ("ts", "real_ts", "yield_g", "time_s", "dose_g")


def _dt(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")


def _same(a: dict, b: dict) -> bool:
    """Same brew when yield and time agree and either the scale clock reading is identical or the real times are within 2 minutes."""
    if a["ts"] == b["ts"]:
        return True
    ra, rb = a.get("real_ts"), b.get("real_ts")
    return bool(ra and rb and abs((_dt(ra) - _dt(rb)).total_seconds()) <= 120)


def merge(stored: list[dict], parsed: list[dict], now_iso: str) -> tuple[list[dict], list[dict]]:
    """Add the brews of a fresh log that are not stored yet. Returns (all brews oldest first, the added ones).

    A brew keeps the real time it was given at its first sync; only a missing real time (None) is filled in later.
    """
    index: dict[tuple, list[dict]] = {}
    for s in stored:
        index.setdefault((s["yield_g"], s["time_s"]), []).append(s)
    nxt = max((s["seq"] for s in stored), default=-1) + 1
    merged, added = list(stored), []
    for p in parsed:
        key = (p["yield_g"], p["time_s"])
        match = next((s for s in index.get(key, []) if _same(s, p)), None)
        if match:
            if not match.get("real_ts") and p.get("real_ts"):
                match["real_ts"] = p["real_ts"]
            if not match.get("curve") and len(p.get("curve") or []) >= 5:
                match["curve"] = p["curve"]
            continue
        item = {k: p.get(k) for k in RAW_KEYS} | {"seq": nxt, "id": f"b{nxt}", "added": now_iso}
        if p.get("curve"):
            item["curve"] = p["curve"]
        nxt += 1
        merged.append(item)
        added.append(item)
        index.setdefault(key, []).append(item)
    return merged, added


def import_history(stored: list[dict], old: list[dict], now_iso: str) -> tuple[list[dict], list[dict]]:
    """Add brews that were read earlier elsewhere (e.g. with the Mac tools) in front of the stored ones; duplicates are skipped."""
    _, added = merge(stored, old, now_iso)
    return added + stored, added


def derive(b: dict, s: dict) -> dict:
    """Add the values that depend on the settings: type, noise flag, average flow, ratio."""
    t, y = b["time_s"], b["yield_g"]
    d = dict(b)
    d["mode"] = "pourover" if t >= s["pourover_min_s"] else "espresso"
    d["valid"] = t >= s["min_time_s"] and y >= s["min_yield_g"]
    d["flow_gs"] = round(y / t, 2) if t else 0
    d["ratio"] = round(y / b["dose_g"], 2) if b.get("dose_g") else None
    return d


def prune_curves(brews: list[dict], s: dict) -> None:
    """Drop espresso curves of old brews (they hold only a few points anyway), in place."""
    for i, b in enumerate(brews):
        if "curve" in b and b["time_s"] < s["pourover_min_s"] and i < len(brews) - s["keep_curves"]:
            del b["curve"]


def public(brews: list[dict], s: dict, notes: dict) -> list[dict]:
    """What the card receives: derived values plus ratings, bean and note of every brew."""
    out = []
    for i, b in enumerate(brews):
        d = derive(b, s)
        d["seq"] = i  # the card sorts by seq; the list is oldest first (imported history sits in front), stored seq is only an id counter
        n = notes.get(b["id"], {})
        d["stars"], d["bean"], d["note"] = n.get("stars", 0), n.get("bean", ""), n.get("note", "")
        out.append(d)
    return out


def settings_from_options(options: dict) -> dict:
    """Build the settings from the flat keys of the options flow (missing keys keep their defaults)."""
    s = copy.deepcopy(DEFAULT_SETTINGS)
    for k in ("pourover_min_s", "min_time_s", "min_yield_g", "keep_curves", "min_sync_interval_min", "flow_value"):
        if k in options:
            s[k] = options[k]
    if "dose_min_g" in options or "dose_max_g" in options:
        s["dose_g"] = [options.get("dose_min_g", s["dose_g"][0]), options.get("dose_max_g", s["dose_g"][1])]
    for mode in MODES:
        for m in METRICS:
            lo, hi = options.get(f"{mode}_{m}_min"), options.get(f"{mode}_{m}_max")
            if lo is not None and hi is not None:
                s["targets"].setdefault(mode, {})[m] = [lo, hi]
    return s


def options_from_settings(s: dict) -> dict:
    """Inverse of settings_from_options (used to pre-fill the options form)."""
    o = {k: s[k] for k in ("pourover_min_s", "min_time_s", "min_yield_g", "keep_curves", "min_sync_interval_min", "flow_value")}
    o["dose_min_g"], o["dose_max_g"] = s["dose_g"]
    for mode in MODES:
        for m in METRICS:
            r = s["targets"].get(mode, {}).get(m)
            if r:
                o[f"{mode}_{m}_min"], o[f"{mode}_{m}_max"] = r
    return o
