# Roadmap: from card to a Home Assistant integration

Status (0.9.0): the integration is built (discovery, sync over Home Assistant's Bluetooth, storage, sensors, Sync now, options, card integration) and tested with a simulated scale. **Not yet run live** (waiting for a Bluetooth adapter). Still open: long-term statistics, an event entity per brew, diagnostics, repairs, export, the scale's record download `02 01 03` and setting its clock. The text below is the original plan.

## Open experiments (need the scale and a new sync)

| Topic | Problem | Plan |
|---|---|---|
| **Graph accuracy** | The scale stores about one weight point per second (`weight num N` in the log is the number of graph points), but the log prints only a few. Espresso graphs are an estimate (dashed). | Try the scale's own record download (Beanconqueror notes mention command `02 01 03` on `fff2`; there it returned an empty list on another firmware). Read-only: send it and log every reply. |
| **Flow number** | The scale shows 13.6 g/s for 109.1 g in 11 s (the average would be 9.9), so it is a peak or phase flow. | Sync after such a record, compare candidates (max over 1 s or 2 s windows, mean during the pour) with the scale's number and copy the one that matches. Until then the card shows the peak of the logged samples or the average. |
| **Record numbers** | The scale numbers its own records ("Record 3"). | Check whether the log or the record download carries the index; until then the card numbers by position. |
| **Scale clock** | The clock restarts at 2022-02-02 after every cold boot. | Write the current time (`04 06` + Unix seconds LE + UTC offset + `01` to `fff1`, per the Beanconqueror notes). Not sent yet, because it writes to the scale. |
| **Dose and ratio** | Only brews where the grounds were weighed first have a ratio. | Keep `--`; maybe an optional default dose. |

## What we know about the scale's clock

- The log file is chronological: it starts with a cut-off line (oldest data in the ring buffer) and ends with the Bluetooth connection of the sync itself
  (`[BLE] Connected Master`, `mtu len = 244`). The last line is "now".
- After every cold boot (`[SYS] … reboot reason = 0`) the clock restarts at 2022-02-02 02:30, so every date reads 2022. The firmware build date in the log shows the data is recent.
- The log holds several runs between boots. For the **last** run the real time follows from the final line: real = sync time - (last scale clock - brew scale clock).
  `tools/parse.py` writes this as `real_ts`; older runs have `real_ts: null` and show as "earlier".
- The log is a full ring buffer (about 500 KB, 3 to 4 weeks): sync often.
- Pour-overs have 12 to 20 weight samples (a real curve), espresso shots only 1 to 5 near the end. The scale's broadcast carries no weight.

## The integration (planned)

`custom_components/mavo_lumicurve`, Python, using Home Assistant's Bluetooth stack (so Bluetooth proxies work):

- A manifest `bluetooth` matcher on the local name `MAVO*` gives auto-discovery under Settings → Devices & services; a config flow confirms the scale.
- When the scale advertises (it sleeps a lot), the integration connects, runs the log sync, parses it (a port of `tools/parse.py`), merges the brews into its store, and disconnects. Rate-limited.
- Sensors: last yield, time, flow, ratio and battery (`0x2A19`), and an event per new brew.
- The card reads the brews through a websocket command; the integration registers the card file itself, so the card shows up in the card picker without a manual resource.
- Needs Bluetooth in range of the scale: a USB adapter on the Home Assistant machine, or an ESP32 with the ESPHome Bluetooth proxy next to the scale.

## Long-term storage in Home Assistant

| Layer | What | Why |
|---|---|---|
| **Integration store** (`homeassistant.helpers.storage.Store`, file `.storage/mavo_lumicurve.brews`) | every brew once: absolute UTC time, type, yield, time, flow, dose, ratio, curve (pour-overs and recent shots), bean/note/stars | survives restarts and updates, is part of every Home Assistant backup, is not purged by the recorder (default 10 days) |
| **Sensors** (`state_class: measurement`) | latest values for automations and badges | the recorder keeps hourly long-term statistics forever |
| **External statistics** (`async_add_external_statistics`, one series per metric) | each brew as a point in time | the standard statistics graph shows years of trends without growing the recorder database |
| **Optional export** | nightly CSV/JSON to `/share` or `/media` | a copy outside `.storage` for spreadsheets |

Size: about 120 bytes per brew without a curve; 5 brews a day for 10 years is under 5 MB even with curves.

Rules that keep the history clean:
- Freeze the real time at the first sync (±10 s); never recompute old brews on a later sync.
- De-duplicate by (yield, time, real time within 2 minutes): every sync repeats old brews.
- Keep curves for pour-overs and the last ~200 shots.

## Settings: one place per kind

The integration decides what the data means, the card decides how it looks.

| Kind | Where | Examples |
|---|---|---|
| Scale and data | integration: Settings → Devices & services → Mavo Lumicurve → Configure | targets per type, filter threshold, noise limits, dose range, flow definition, how long to keep curves, export |
| Look of one card | the card (visual editor or YAML) | colours, language, texts, shown parts |
| Look of all cards | Home Assistant theme variables `--mlc-*` | accent and tile colours |
| Ratings, bean, notes | stored with the brew in the integration store (shared by all users) | stars, bean, text |

The card gets the integration's settings next to the brews; a card option overrides them for that card. Changing a rule re-evaluates stored brews, because the store keeps raw seconds and grams and the type, noise flag and ratio are computed when read.
Today the settings live in the card config, `settings.json` and `data/lumicurve.json`; the last two stay only for the Mac tools.

## Sharing

One repository with `custom_components/mavo_lumicurve/` (integration plus bundled card) and `hacs.json`; users add it as a custom repository in the Marketplace or HACS, install, restart, and the scale is discovered.
Open: repository description and topics (for the HACS check), a licence, screenshots, translations (de/en).

## Card ideas for later

Month view, per-bean averages, CSV export, swipe between brews, units (g/oz).


## Next steps and long-term statistics

**Does Home Assistant keep long-term data by itself?** Partly.

| Data | Where it lives | Kept |
|---|---|---|
| All brews, curves, ratings, notes | the integration's storage (`.storage/mavo_lumicurve.<entry>`), included in backups | forever (espresso curves for the newest N brews, see `keep_curves`) |
| Sensor states (last yield, time, flow, ratio) | recorder database | 10 days by default |
| Hourly mean/min/max of those sensors | long-term statistics, created automatically for sensors with a `state_class` (set since 0.9.0) | forever |
| Brew count | long-term statistics (`total_increasing`) | forever |

So the logbook never depends on the recorder. The automatic statistics only describe "the last brew" per hour and are timed by the sync, not by the brew, so they are a rough trend, not a record.
Exact per-brew statistics would need `async_add_external_statistics` with the brews' real times. Statistics are hourly buckets, so several brews in one hour must be combined, and brews without a real time cannot be placed. Worth it only if you want Statistics-graph cards or the Energy-style compare views for coffee; the card's own history chart already covers the logbook.

Planned, in order:
1. **First live run** with the Bluetooth adapter (UB500, 2026-11-20): discovery, first sync, reconnect behaviour, the sync interval. Fix what the real system shows.
2. **Diagnostics** download (counts, last error, settings, no personal data) and a **Repair** when no Bluetooth adapter exists.
3. **Event entity** per new brew, so automations can react ("brew finished").
4. **Export** of the brews as CSV/JSON from the card or a service.
5. Optional: external statistics (above), scale record download `02 01 03`, setting the scale clock so new brews always get real times.
6. Before 1.0: licence, brand icon, Home Assistant integration quality checks (`hassfest`, type hints), tests with `pytest-homeassistant-custom-component`.
