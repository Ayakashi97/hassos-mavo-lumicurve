# Mavo Lumicurve brew card

A Home Assistant dashboard card for the **Mavo Lumicurve** coffee scale (Lefu CK850 Bluetooth module): the last brew looks like the scale's own screen
(ratio, flow, weight, time and a weight graph), you flip through older brews or pick one from a dropdown, rate them, and see a history chart with numbers.
Everything is customizable (colours, texts, parts, targets, theme variables, visual editor).

Status: early. Card tested on one scale (firmware 008.06) and Home Assistant 2026.11.

## Run it in Home Assistant

Home Assistant itself reads the scale over **its own Bluetooth** (USB adapter or ESPHome Bluetooth proxy), stores the brews and shows them in the card. Nothing runs on your computer.

1. Have Bluetooth in Home Assistant in range of the scale (see [docs/INSTALL-HA.md](docs/INSTALL-HA.md)).
2. **Install the integration from the Marketplace:** [![Open your Home Assistant instance and open this repository in the store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ayakashi97&repository=hassos-mavo-lumicurve&category=integration)
   (or Settings → Marketplace → ⋮ → Add from link → this repository, category Integration → Download), then **restart Home Assistant**.
3. Wake the scale: Home Assistant discovers it (Settings → Devices & services → Discovered → Add).
4. Add the card **Brew logbook (Mavo Lumicurve)** to a dashboard. It needs no configuration; the integration serves the card file itself.

Details, what you should see and troubleshooting: **[docs/INSTALL-HA.md](docs/INSTALL-HA.md)**. Card options, colours, theme variables: **[docs/CONFIG.md](docs/CONFIG.md)**.

> The integration is new (0.9.0, written without a Bluetooth adapter in the test system): the sync is covered by tests with a simulated scale, but not yet by a live run in Home Assistant.

## The card

- Four tiles (ratio, flow, weight, time) in the scale's colours, targets per espresso and filter (green inside, orange outside).
- Weight graph with axes, end marker and, for pour-overs, the real curve. Espresso curves are estimated (the scale logs too few samples).
- Brew selector: arrows and a dropdown with every brew (the logbook), stars and notes per brew.
- History chart for time or flow, with the numbers on the bars; tap a bar to select it.
- German and English; works on phones and light themes.

### Install
See "Run it in Home Assistant" above and [docs/INSTALL-HA.md](docs/INSTALL-HA.md).

### Minimal configuration
```yaml
type: custom:mavo-lumicurve-card
```
With the integration that is all: brews, ratings and the default targets come from it (Settings → Devices & services → Mavo Lumicurve → Configure). Anything you set in the card wins.
Other sources (`entity`, `brews_url`, inline `brews`) still work. All options, colours, theme variables, texts and where each setting lives: **[docs/CONFIG.md](docs/CONFIG.md)**.

## The scale (what we found)

- BLE, no pairing. Name `MAVO LUMICURVE`, service `fff0` (`fff1`/`fff2` write+notify, `fff3` indicate).
- It does **not** stream live weight. It keeps an on-board debug log (~500 KB ring buffer) you can pull: write `01 01 01` to `fff2`, it announces the size
  (`01 09 01` + 8 bytes), acknowledge with `01 09 02` + the same 8 bytes, the log arrives as notifications on `fff2`.
  Protocol notes: [Beanconqueror#1198](https://github.com/graphefruit/Beanconqueror/issues/1198). Reading does not clear the log.
- The scale has no real clock: after every cold boot it restarts at 2022-02-02 02:30. The log ends with the sync's own BLE connection, so the parser computes
  real times for the latest run (`real_ts`); older runs show as "earlier".
- A brew ends at `[MP] weight num N time T`; its yield is the last settled `[SW] lock=A-B-C` before it (B = 0.1 g).

## Developer tools (Mac, Python)

Only for development and reverse engineering; **Home Assistant does not need them**.

```bash
./run.sh                                 # first run creates .venv and installs bleak; syncs, parses, opens the card test page
.venv/bin/python tools/discover.py       # find the scale, remember it in data/lumicurve.json
.venv/bin/python tools/sync.py           # pull the log into data/scale_log_<time>.txt (same protocol code as the integration)
.venv/bin/python tools/parse.py data/scale_log_<time>.txt data/brews.json
python3 -m unittest discover -s tests    # parser, merge, and a simulated scale for the download
```
macOS needs Bluetooth permission for the terminal; only one program can be connected to the scale at a time. `tools/explorer.html` (Chrome, Web Bluetooth) lists services and logs raw bytes.

## Repository layout

| Path | Content |
|---|---|
| `custom_components/mavo_lumicurve/` | the Home Assistant integration (`protocol.py`, `parser.py`, `brews.py` are pure Python; the rest is Home Assistant glue) |
| `custom_components/mavo_lumicurve/www/mavo-lumicurve-card.js` | the card (single file, no build step, served by the integration) |
| `card/test.html` | local test page with presets |
| `tools/`, `run.sh`, `settings.json.example` | developer tools for the Mac |
| `tests/` | unit tests (stdlib `unittest`) |
| `docs/` | `INSTALL-HA.md`, `CONFIG.md` (all settings), `ROADMAP.md`, `RELEASING.md` |
| `data/` | your logs and brews (not in git) |

No licence is set yet.
