# Mavo Lumicurve brew card

A Home Assistant dashboard card for the **Mavo Lumicurve** coffee scale (Lefu CK850 Bluetooth module): the last brew looks like the scale's own screen
(ratio, flow, weight, time and a weight graph), you flip through older brews or pick one from a dropdown, rate them, and see a history chart with numbers.
Everything is customizable (colours, texts, parts, targets, theme variables, visual editor).

Status: early and private. Tested on one scale (firmware 008.06) and Home Assistant 2026.11.

## Run it in Home Assistant

The card works in Home Assistant today. The scale is read by your Mac, and Home Assistant shows the result. A Home Assistant integration that syncs by itself is planned.

1. Copy `dist/mavo-lumicurve-card.js` to `/config/www/mavo-lumicurve/` and add it under Settings → Dashboards → ⋮ → Resources
   (`/local/mavo-lumicurve/mavo-lumicurve-card.js?v=0.8.0`, type JavaScript module).
2. On your Mac run `./run.sh`, then copy `data/brews_ha.json` to `/config/www/mavo-lumicurve/brews.json`.
3. Add the card "Brew logbook (Mavo Lumicurve)" with `brews_url: /local/mavo-lumicurve/brews.json`.

Full step-by-step guide, what you should see, troubleshooting and the Bluetooth requirements for the integration: **[docs/INSTALL-HA.md](docs/INSTALL-HA.md)**.
All card options, colours and theme variables: **[docs/CONFIG.md](docs/CONFIG.md)**.

## The card

- Four tiles (ratio, flow, weight, time) in the scale's colours, targets per espresso and filter (green inside, orange outside).
- Weight graph with axes, end marker and, for pour-overs, the real curve. Espresso curves are estimated (the scale logs too few samples).
- Brew selector: arrows and a dropdown with every brew (the logbook), stars and notes per brew.
- History chart for time or flow, with the numbers on the bars; tap a bar to select it.
- German and English; works on phones and light themes.

### Install
See "Run it in Home Assistant" above and [docs/INSTALL-HA.md](docs/INSTALL-HA.md).

HACS: the repository is ready for HACS (category "Dashboard", file `dist/mavo-lumicurve-card.js`). HACS needs access to the repository, so adding it as a custom
repository will most likely only work once it is public.

### Minimal configuration
```yaml
type: custom:mavo-lumicurve-card
entity: sensor.mavo_lumicurve_brews     # attribute "brews"; or brews_url / brews (inline list)
targets:
  espresso: { time: [22, 30], yield: [34, 42] }
  pourover: { time: [150, 210], yield: [250, 310] }
```
All options, colours, theme variables, texts and where each setting lives: **[docs/CONFIG.md](docs/CONFIG.md)**.
The card gets its data from an entity, a JSON file or an inline list; the integration that fills an entity automatically is planned (`docs/HA.md`).

## The scale (what we found)

- BLE, no pairing. Name `MAVO LUMICURVE`, service `fff0` (`fff1`/`fff2` write+notify, `fff3` indicate).
- It does **not** stream live weight. It keeps an on-board debug log (~500 KB ring buffer) you can pull: write `01 01 01` to `fff2`, it announces the size
  (`01 09 01` + 8 bytes), acknowledge with `01 09 02` + the same 8 bytes, the log arrives as notifications on `fff2`.
  Protocol notes: [Beanconqueror#1198](https://github.com/graphefruit/Beanconqueror/issues/1198). Reading does not clear the log.
- The scale has no real clock: after every cold boot it restarts at 2022-02-02 02:30. The log ends with the sync's own BLE connection, so the parser computes
  real times for the latest run (`real_ts`); older runs show as "earlier".
- A brew ends at `[MP] weight num N time T`; its yield is the last settled `[SW] lock=A-B-C` before it (B = 0.1 g).

## Tools (Mac, Python)

```bash
./run.sh                                 # first run creates .venv and installs bleak; syncs, parses, opens the card test page
.venv/bin/python tools/discover.py       # find the scale, remember it in data/lumicurve.json
.venv/bin/python tools/sync.py           # pull the log into data/scale_log_<time>.txt
.venv/bin/python tools/parse.py data/scale_log_<time>.txt data/brews.json
python3 tests/test_parse.py
```
macOS needs Bluetooth permission for the terminal; only one program can be connected to the scale at a time. Parser rules can be changed in `settings.json`
(copy `settings.json.example`). `tools/explorer.html` (Chrome, Web Bluetooth) lists services and logs raw bytes.

## Repository layout

| Path | Content |
|---|---|
| `dist/mavo-lumicurve-card.js` | the card (single file, no build step) |
| `card/test.html` | local test page with presets |
| `tools/`, `run.sh`, `settings.json.example` | scale discovery, sync, parser |
| `tests/` | parser tests with a real log excerpt |
| `docs/` | `INSTALL-HA.md` (run it in Home Assistant), `CONFIG.md` (all settings), `HA.md` (Home Assistant and long-term storage), `DESIGN.md`, `PLAN.md` |
| `data/` | your logs and brews (not in git) |

No licence is set yet; decide before making the repository public.
