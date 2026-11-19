# Run it in Home Assistant

German UI names in brackets. Tested with Home Assistant OS 2026.11. You need an admin account.

## What works today and what comes later

| Part | Today | Planned |
|---|---|---|
| The **card** on a dashboard | works | – |
| Getting the **brews** to the card | a JSON file that you update with one command on your Mac (or data pasted into the card) | a Home Assistant integration that syncs the scale by itself (needs a Bluetooth adapter or proxy) |
| Settings for targets and rules | in the card config | in the integration's Configure screen |

So today the scale is read **by your Mac**, and Home Assistant only shows the result. Steps 1 to 4 below are all you need for that.

## Step 1: put the card file into Home Assistant

1. Get the file `dist/mavo-lumicurve-card.js` from this repository
   (https://github.com/Ayakashi97/hassos-mavo-lumicurve, folder `dist`, button "Download raw file").
2. Copy it to the folder `/config/www/mavo-lumicurve/` of Home Assistant (create the folders if they don't exist). Ways to do that:
   the **Studio Code Server** app (upload by drag and drop), the **Samba** share, or the **Terminal & SSH** app.
3. Check: opening `http://<your-home-assistant>:8123/local/mavo-lumicurve/mavo-lumicurve-card.js` in the browser shows the JavaScript text.

## Step 2: register it as a dashboard resource

1. Settings (Einstellungen) → Dashboards → three dots (⋮) top right → **Resources** (Ressourcen). If you don't see Resources, turn on Advanced mode in your user profile.
2. Add resource: URL `/local/mavo-lumicurve/mavo-lumicurve-card.js?v=0.8.0`, type **JavaScript module**.
3. Hard refresh the browser (Ctrl/Cmd + Shift + R). In the Companion app: Settings → Companion app → Troubleshooting → Reset frontend cache.

When you update the file later, change `?v=0.8.0` to the new version number. Home Assistant caches `/local` files for about a month, and a new URL forces a reload.

## Step 3: give the card its brews

**Option A: a file (recommended)**

1. On your Mac, in the repository: `./run.sh` (wake the scale first). It syncs the scale, parses the log, and writes `data/brews_ha.json`.
   (Or just `python3 tools/export.py` if you already have `data/brews.json`.)
2. Copy `data/brews_ha.json` to `/config/www/mavo-lumicurve/brews.json` in Home Assistant (same ways as in step 1).
3. Use `brews_url: /local/mavo-lumicurve/brews.json` in the card.
4. Repeat 1 and 2 whenever you want fresh brews. The card always loads the newest file, no cache clearing needed.
   The scale keeps only about 3 to 4 weeks in its log, so sync at least that often.

**Option B: data inside the card (static, for trying it out)**

Paste the list into the card config as `brews:`. It never updates. The test dashboard of this project works this way.

## Step 4: add the card to a dashboard

1. Open the dashboard → pencil (edit) → **Add card** → search for **Brew logbook (Mavo Lumicurve)**.
2. The visual editor opens. Pick the language, colours and targets, or switch to the code editor and paste:

```yaml
type: custom:mavo-lumicurve-card
brews_url: /local/mavo-lumicurve/brews.json
language: en            # de or en
targets:
  espresso: { time: [22, 30], yield: [34, 42] }
  pourover: { time: [150, 210], yield: [250, 310] }
```
3. In a sections view, give the card the full width: `grid_options: { columns: 12 }`.

Every option, the colours, theme variables and text overrides are in [CONFIG.md](CONFIG.md).

## What you should see

- The newest brew, with the real date and time, in four tiles and a weight graph. Brews from before the scale's last cold boot show "früher" (or "earlier") instead of a date, because the scale has no clock of its own.
- Arrows and a dropdown to move between brews, stars and a pencil for notes, and a history chart at the bottom.
- Stars and notes are stored per user in Home Assistant, so they stay when you open the dashboard on another device.

## Later: the integration (not built yet)

The plan is in [HA.md](HA.md): the scale is found automatically in Settings → Devices & services, syncs by itself, and all settings move into its Configure screen.
It needs Bluetooth in range of the scale:

1. A **USB Bluetooth adapter** in the Home Assistant machine (check that it really is a Bluetooth adapter; a TP-Link Wi-Fi stick looks similar), or an **ESP32 with the ESPHome Bluetooth proxy** next to the scale.
2. After plugging in an adapter, **reboot the whole system** (Settings → System → power icon → Reboot system). Restarting only Home Assistant did not pick up a hot-plugged adapter here.
3. Check it: Settings → System → Logs → pick **Host**, search for `Bluetooth`. A working adapter shows a `New USB device found` line with a Bluetooth product and then `hci0`. A TP-Link UB500 has the ID `2357:0604`.
4. The **Bluetooth** integration then appears under Devices & services (Discovered) or can be added there.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| The card is not in the "Add card" list | The resource isn't loaded: check step 2 (type must be JavaScript module, URL exact), then hard refresh. |
| "Custom element doesn't exist: mavo-lumicurve-card" | Same: wrong resource URL, or the file isn't in `/config/www/mavo-lumicurve/`. Open the URL from step 1 to check. |
| The card shows "Noch keine Brühungen" / "No brews yet" | The data file is missing or empty. Open `/local/mavo-lumicurve/brews.json` in the browser. Check `brews_url`. |
| An old version still shows | Cached file: change `?v=` in the resource URL and hard refresh. |
| Everything says "früher" | These brews come from before the scale's last cold boot, so their real time is unknown. New brews get real times after the next sync. |
| Newest brews are missing | The file wasn't refreshed. Run `./run.sh` again and copy the new `brews_ha.json`. Make sure the scale was awake and nothing else was connected to it. |
| Stars are gone after a browser reset | They live in Home Assistant user data under your user; signing in with another user shows other notes. |

## Updating and removing

- **Update:** replace the file, change `?v=` in the resource URL, hard refresh. Version changes are listed in the [CHANGELOG](../CHANGELOG.md). Version 0.8.0 renamed the card; dashboards that still use the old name must change the card `type` and the resource URL.
- **Remove:** delete the card from your dashboards, delete the resource (step 2), delete `/config/www/mavo-lumicurve/`.
