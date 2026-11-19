# mavo-lumicurve

Read the brew log of a **Mavo Lumicurve** coffee scale (Lefu CK850 Bluetooth module) and show it as a
Home Assistant card with a logbook. Work in progress, tested only on one scale (firmware 008.06).

## What the scale does (found by experiment)

- BLE, no pairing. Name `MAVO LUMICURVE`, service `fff0` (`fff1`/`fff2` write+notify, `fff3` indicate).
- It does **not** stream live weight. It keeps an on-board debug log (~500 KB) that you can pull:
  write `01 01 01` to `fff2` → it announces the size (`01 09 01` + 8 bytes) → write `01 09 02` + the same 8 bytes →
  log text arrives as notifications on `fff2` (2-byte sequence + ASCII), end `01 xx 03`.
  Protocol notes come from [Beanconqueror#1198](https://github.com/graphefruit/Beanconqueror/issues/1198).
- Reading the log did **not** clear it on our scale (it is a full ring buffer, ~500 KB, oldest lines get overwritten). `sync.py` saves the raw text first.
- The scale has no real clock: after every cold boot it restarts at 2022-02-02 02:30. The last log line is the sync's own
  BLE connection, so `parse.py` can compute real times (`real_ts`) for the current run; older runs show as "früher".
- Shots carry a `curve` (weight over time) when the log has enough samples: pour-overs yes, espresso mostly no.
- A brew ends at `[MP] weight num N time T`; its yield is the last settled `[SW] lock=A-B-C` before it (B in 0.1 g).

## Use

```bash
python3 -m venv .venv && .venv/bin/pip install bleak
.venv/bin/python tools/discover.py      # wake the scale; lists Lefu/Mavo devices, remembers one in data/lumicurve.json
.venv/bin/python tools/sync.py          # pulls the log into data/scale_log_<time>.txt
.venv/bin/python tools/parse.py data/scale_log_*.txt data/brews.json
python3 tests/test_parse.py
python3 -m http.server 8766 --bind 127.0.0.1   # then open /card/test.html
```

On macOS the terminal app needs Bluetooth permission. Only one program can be connected to the scale at a time
(close other apps/browser tabs first). `tools/explorer.html` (Chrome, Web Bluetooth) lists services and logs raw bytes;
`tools/watch.py` prints advertisement changes (the broadcast carries no weight).

## Card options (`card/nofree-brew-card.js`)

| key | default | meaning |
|---|---|---|
| `entity` or `brews_url` | – | where the brews list comes from (`brews` attribute, or a JSON file) |
| `title` | Espresso-Logbuch | card title |
| `accent` | `#e8b54a` | accent colour |
| `chart_count` | 30 | bars in the time chart |
| `targets` | – | targets per type: `{ espresso: { time:[min,max], yield:[..], flow:[..], ratio:[..] }, pourover: { … } }` (flow = average g/s) |
| `target_time` / `target_yield` / `target_flow` / `target_ratio` | – | same ranges for both types (overridden by `targets`) |
| `chart_metric` | `time` | history chart shows `time` or `flow` (also switchable in the card) |
| `show_invalid` | false | also show tare/noise events (< 8 s or < 5 g) |

Notes per brew (bean, text, stars) are stored in HA user data (`frontend/set_user_data`), `localStorage` as fallback.

See [docs/PLAN.md](docs/PLAN.md) for the road to Home Assistant.
