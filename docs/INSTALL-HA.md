# Run it in Home Assistant

German UI names in brackets. Written for Home Assistant OS 2026.11; you need an admin account.

## How it works

The **Mavo Lumicurve integration** runs inside Home Assistant. When the scale wakes up and Home Assistant sees it over Bluetooth, the integration connects, downloads the scale's brew log (about 25 seconds), adds the new brews to its own storage and updates its sensors. The **card** reads the brews from the integration. Your computer is not involved.

The scale only advertises while it is awake (after you put something on it or press the button), so a sync happens when you use it, and at most every 10 minutes (configurable). The scale's log holds about 3 to 4 weeks, so use it at least that often; older brews stay stored in Home Assistant.

## 1. Bluetooth in Home Assistant

You need one of:

1. A **USB Bluetooth adapter** in the Home Assistant machine (check that it really is Bluetooth; a TP-Link Wi-Fi stick looks similar), or
2. An **ESP32 with the ESPHome Bluetooth proxy** next to the scale.

After plugging in an adapter, **reboot the whole system** (Settings → System → power icon → Reboot system); restarting only Home Assistant did not pick up a hot-plugged adapter here.
Check: Settings → System → Logs → **Host**, search for `Bluetooth`: a working adapter shows `New USB device found` and `hci0`. A TP-Link UB500 has the ID `2357:0604`.
The **Bluetooth** integration then appears under Devices & services (Discovered) or can be added there.

## 2. Install the integration

From Home Assistant 2026.11 on, the **Marketplace** is built in (Settings → Marketplace) and replaces HACS. Older versions need HACS; "Custom repositories" works the same way.

[![Open your Home Assistant instance and open this repository in the store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Ayakashi97&repository=hassos-mavo-lumicurve&category=integration)

1. Click the button, or Settings → **Marketplace** → ⋮ → **Add from link**, enter `https://github.com/Ayakashi97/hassos-mavo-lumicurve`, category **Integration**.
2. Open its entry → **Download**.
3. **Restart Home Assistant** (Settings → System → Restart). Integrations are only loaded at start.

By hand instead: copy the folder `custom_components/mavo_lumicurve` of this repository to `/config/custom_components/mavo_lumicurve` and restart.

**Migrating from an earlier card-only install (0.8.x):** remove the old Marketplace entry (category Dashboard) and the dashboard resource `/local/community/hassos-mavo-lumicurve/...` (Settings → Dashboards → ⋮ → Resources), otherwise the card is loaded twice (harmless, but wasteful). The card type stays `custom:mavo-lumicurve-card`.

## 3. Add the scale

Wake the scale (put something on it). Settings → Devices & services: **Mavo Lumicurve** appears under *Discovered* → **Add**. If not, use **Add integration** → Mavo Lumicurve; the scale must be awake while the list loads.

The device has: last brew yield, time, flow and ratio, brew count, battery, last sync, and a **Sync now** button (wake the scale first).
The first sync takes about 25 seconds and imports everything in the scale's log. Check Settings → System → Logs for `Synced` lines (or errors) from `mavo_lumicurve`.

## 4. Add the card

Edit a dashboard → **Add card** → **Brew logbook (Mavo Lumicurve)**. No configuration is needed:

```yaml
type: custom:mavo-lumicurve-card
language: en            # de or en
grid_options: { columns: 12 }   # sections view: full width
```

The integration loads the card file itself, so there is no dashboard resource to add. Hard refresh the browser once after the first install (Companion app: Settings → Companion app → Troubleshooting → Reset frontend cache).

## 5. Settings

Settings → Devices & services → Mavo Lumicurve → **Configure**: when a brew counts as filter, which brews to ignore, dose range, the flow tile, how often to sync, and targets per espresso and filter. The card uses these as defaults; anything set in the card itself wins. All card options: [CONFIG.md](CONFIG.md).

## What you should see

- The newest brew with its real date and time, in four tiles and a weight graph. Brews from before the scale's last cold boot show "früher" ("earlier"), because the scale has no clock of its own.
- Arrows and a dropdown to move between brews, stars and notes (stored in Home Assistant, shared by all users), and a history chart.
- New brews appear on the card by themselves after a sync.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| The scale is not discovered | It is asleep or out of range. Wake it; check the Bluetooth integration works (Host log, `hci0`). With an ESPHome proxy, place it near the scale. |
| "Sync failed" in the log | Scale out of range, or something else (a phone app, the Mac tools) is connected: the scale accepts one connection. Press **Sync now** with the scale awake. |
| The card says "no brews" | No sync yet. Press **Sync now** with the scale awake and watch the log. |
| The card is not in the "Add card" list | Restart Home Assistant after installing, then hard refresh. |
| Everything says "früher" | The brews come from before the scale's last cold boot; new brews get real times. |
| Stars are gone | They are stored per scale in Home Assistant; check you use the same Mavo Lumicurve entry. |

## Updating and removing

- **Update:** Marketplace → Update, then restart Home Assistant. Changes: [CHANGELOG](../CHANGELOG.md).
- **Remove:** delete the integration entry (Devices & services), remove it in the Marketplace. Stored brews are deleted with the entry.

## Without the integration (card only)

The card still works with `entity`, `brews_url` or inline `brews` (see [CONFIG.md](CONFIG.md)), for example with a JSON file made by the Mac tools (`./run.sh`, then copy `data/brews_ha.json` to `/config/www/mavo-lumicurve/brews.json` and use `brews_url: /local/mavo-lumicurve/brews.json`). Then load the card file as a dashboard resource yourself.
