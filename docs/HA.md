# Home Assistant: test deployment and the long-term plan

## Test deployment (2026-11-19, HA 2026.11.1)
- Card hosted as an **inline dashboard resource** (module, 23,036 bytes, sha256 `06ce1fd0…23d8`, resource id `ab05e666d7ee435e9f9dbbe12f42709f`),
  same way as the floorplan card. Update with `ha_config_set_dashboard_resource(resource_id=…, edits=[…])` or recreate from `card/nofree-brew-card.js`.
- New **admin-only dashboard** `kaffee-log` (sidebar "Kaffee", view `kaffee`) with one `custom:nofree-brew-card`.
  Data is **inlined in the card config** (111 brews, about 19 KB: `data/brews_ha.json`). That is only for the test; nothing updates it.
- Brew notes and stars use `frontend/set_user_data`: they are stored per HA user, not shared.
- The existing dashboards and resources were not touched. Remove the test: delete dashboard `kaffee-log` and the resource id above.
- No Bluetooth integration and no ESPHome entry exist on this HA (checked), so HA cannot reach the scale yet.

## Where the data should live long-term
| Layer | What | Why |
|---|---|---|
| **Integration store** (`homeassistant.helpers.storage.Store`, file `.storage/mavo_lumicurve.brews`) | every brew once: absolute UTC time, mode, yield, time, flow, dose, ratio, curve (pour-overs and recent shots), bean/note/stars | survives restarts and updates, **is part of every HA backup**, is not purged by the recorder (default 10 days) |
| **Sensors** (`state_class: measurement`): last yield, time, flow, ratio, battery | latest values for automations and badges | recorder keeps hourly **long-term statistics forever** |
| **External statistics** (`async_add_external_statistics`, one series per metric) | each brew as a point in time | the standard "Statistics graph" card then shows years of trends without the recorder database growing |
| **Optional export** | nightly CSV/JSON to `/share` or `/media` | a copy outside `.storage` for spreadsheets or other tools |

Size: about 120 bytes per brew without a curve; 5 brews a day for 10 years is under 5 MB even with curves. Keep curves for pour-overs and the last ~200 shots.

Rules that keep the history clean:
- **Freeze the real time at the first sync.** The scale clock restarts at 2022-02-02 after every cold boot, so `real_ts` is computed from the sync time
  (±10 s). Store it once; never recompute old brews on a later sync.
- **De-duplicate** by (yield, time, real time within 2 min); the log is a ring buffer, so every sync repeats old brews.
- Sync **often** (every time the scale advertises, rate-limited): the buffer holds only about 3-4 weeks.
- Set the scale clock (documented write to `fff1`) once, then real times come straight from the log.

## Getting the data into HA
1. **Bluetooth in range of the scale.** HA has no Bluetooth integration here. Cheapest: an **ESP32 with the ESPHome Bluetooth proxy** (active connections) near the
   scale; or a USB Bluetooth adapter on the HA host if it is close enough.
2. **Custom integration `mavo_lumicurve`** (Python, uses HA's Bluetooth stack, so proxies work):
   manifest `bluetooth` matcher on the local name `MAVO*` gives real auto-discovery in Settings; config flow confirms the scale;
   on advertisement it connects, runs the log sync, parses (port of `tools/parse.py`), merges into the store and updates the sensors.
3. **Card:** reads the brews through a websocket command (`mavo_lumicurve/brews`) or the sensor attribute; the integration registers the card JS itself,
   so the card shows up in the card picker without a manual resource.

## Sharing it ("everybody could add it")
One public GitHub repo with `custom_components/mavo_lumicurve/` (integration + bundled card) and `hacs.json`; users add it as a custom repository in the HA
Marketplace/HACS, install, restart, and the scale is discovered. Needs: README with screenshots, licence, release tags, translations (de/en).
Publishing is outward-facing, so it waits for an explicit go.
