# Plan: Lumicurve in Home Assistant

## Done (local)
Discovery, log sync, parser (+tests), card prototype with logbook, options, notes.

## Open questions (decide before building the HA part)
1. **What counts as a real brew?** The log is a ring buffer and starts in Feb 2022, so many entries may be
   factory tests. Make one espresso now, sync again, and check that it shows up as the newest entry.
2. **Timestamps.** Write the clock (`04 06` + Unix seconds LE + UTC offset + `01` to `fff1`, per the Beanconqueror notes)
   or stamp new brews with the sync time. Not done yet: it writes to the scale.
3. **Where does Bluetooth run?** HA host with Bluetooth, or an ESPHome Bluetooth proxy (supports active connections).

## HA integration (recommended: custom integration)
- `custom_components/mavo_lumicurve`: manifest `bluetooth` matcher on local name `MAVO*` gives real **auto-discovery**
  in HA; a config flow confirms the scale. Uses HA's bluetooth stack, so proxies work.
- Poll when the scale is seen advertising (it sleeps a lot): connect, run the sync above, parse (port of `parse.py`).
- Entities: `sensor.…_last_yield`, `_last_time`, `_last_ratio`, `_battery` (`0x2A19`), and an event `mavo_lumicurve_brew`.
- History: merge new brews into HA storage de-duplicated by (ts, yield, time); expose through a websocket command or a
  JSON file in `/config/www` (the card already accepts `brews_url`). Do not put 100+ brews in a state attribute (16 KB limit).

## Card
- Goes into the dashboard as its own resource (keeps the 128 KB card limit untouched), following `docs/STYLEGUIDE.md`
  of the dashboard repo (glass surface, icon buttons, German text).
- Later: visual editor (`getConfigElement`), month view, per-bean averages, export CSV.

## Fallback without a custom integration
Cron/launchd on any machine with Bluetooth near the scale runs `sync.py` + `parse.py` and POSTs the result
to an HA webhook or writes `/config/www/mavo_brews.json`.

## Flow rate
Average flow = yield ÷ time (g/s, ≈ ml/s) is in `brews.json` (`flow_gs`) and the card (hero chip, rows, chart toggle, `target_flow`).
A real flow *curve* might be possible later: the log has `[SW] restart=` / `lock=` samples during a shot, but they are sparse and not yet decoded.

## What the log's clock tells us (corrected 2026-11-19)
Earlier notes here said the entries were from 2022 / factory tests. **That was wrong.**
- The log file is chronological: it starts with a cut-off line (oldest data in the ring buffer) and ends with the
  Bluetooth connection of the sync itself (`[BLE] Connected Master`, `mtu len = 244`). The last line is "now".
- The scale has no real clock. After every cold boot (`[SYS] Build Jul 2 2026 … reboot reason = 0`) it restarts at
  **2022-02-02 02:30**, so every date reads 2022. The firmware build date (Jul 2026) shows the data is from 2026.
- The log contains 3 runs (boots): run 0 (older, before the battery ran flat), run 1 (short), run 2 (current, 20 days).
- For run 2 the real time follows from the final line: real = sync time - (last scale clock - brew scale clock).
  `parse.py` writes this as `real_ts` (checked: espresso in the morning, filter at midday, which matches usage).
  Runs 0/1 have `real_ts: null` (unknown gap between boots) and show as "früher" in the card.
- Re-sync often: the buffer is full (~500 KB, about 3-4 weeks), new lines overwrite the oldest.
- Next: set the scale clock with the documented command so future runs carry real time (not sent yet).
- Curves: pour-overs have 12-20 weight samples (real flow curve), espresso shots only 1-5 near the end.
