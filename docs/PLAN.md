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
