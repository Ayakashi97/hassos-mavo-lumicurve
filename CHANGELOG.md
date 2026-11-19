# Changelog

## 0.8.0 (breaking: renamed)
- The card is now **`custom:mavo-lumicurve-card`** (was `custom:nofree-brew-card`); file `dist/mavo-lumicurve-card.js`; editor element `mavo-lumicurve-card-editor`.
- Theme variables are `--mlc-*` (were `--nbc-*`). Ratings and notes are stored under the key `mavo_lumicurve_notes`, so notes entered during tests under the old key are not carried over.
- To upgrade a dashboard: change the resource to the new file and the card `type` to `custom:mavo-lumicurve-card`.

## 0.7.0
- Card fully customizable: colours, language (de/en), single texts, which parts are shown, targets per type, theme variables `--mlc-*`, visual editor. See `docs/CONFIG.md`.
- Parser rules in `settings.json`.

## 0.6.0
- Works inline in Home Assistant (`brews` in the card config) and registers in the card picker.

## 0.5.0
- Chart numbers, value axis, tap a bar to select a brew; outliers are clipped.

## 0.4.0
- Targets per type (espresso, filter). Brew dropdown replaces the "last 5" list. Compact layout that scales with the width.

## 0.3.0
- Scale-style top section: four tiles, weight graph, brew selector with arrows.

## 0.1.0 - 0.2.0
- First card: logbook, flow rate, expandable list, notes, stars.

Scale tools: log sync, parser with real timestamps (the scale clock restarts at 2022-02-02 after a cold boot), discovery.
