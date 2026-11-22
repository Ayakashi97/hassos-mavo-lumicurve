# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) (while below 1.0, a breaking change raises the minor number).
How releases are made: [docs/RELEASING.md](docs/RELEASING.md).

## [Unreleased]

### Added
- Every brew now has a time and a source `ts_src`: `exact` (anchored to the sync through the scale's clock), `latest` (upper bound for brews from before a cold boot) or `seen` (the moment the brew was first seen; upper bound). The card shows "≤" before the time of the last two and a tooltip, and never "earlier" any more. Sensor attribute `brewed_src`.
- One-time migration at startup: the kept raw logs are read again with the new parser, brews that still have no time get the moment they were added (`seen`).

### Changed
- The parser sets `real_ts` for earlier runs too (upper bound: the real start of the next run minus the scale-clock distance, so the spacing between brews of one run is exact). Lines before the first date line of a run are placed relative to it.
- A stored time is replaced by a more trustworthy one (exact over latest over seen); an exact time never changes.

### Fixed
- The card no longer shows "earlier" for brews from before the scale's last cold boot.

## [1.1.2] - 2026-11-22

### Fixed
- The brews of the latest sync get their real time even when the scale's log has no date line (the pill showed "earlier" instead of the time).

## [1.1.1] - 2026-11-22

### Changed
- The big tile values use the tile's own colour (ratio orange, flow green, weight violet, time pink; options `color_ratio` etc. and `--mlc-ratio` etc. apply, slightly lighter defaults for contrast). Inside/outside the target is now shown by the colour of the "Target ..." line (check mark inside), not by the value.

## [1.1.0] - 2026-11-22

### Added
- Option `surface: card | none`: `none` removes the card's own panel, border and padding so a dashboard dialog can provide the glass.
- Option `layout: auto | compact | wide`: graph and history chart side by side from 720 px width (`auto`), always (`wide`) or never (`compact`). The four tiles form one row from 560 px.
- Theme `auto` (the new default) and the tokens `--mlc-muted`, `--mlc-sheet`, `--mlc-display`; `auto` also reads the host tokens `--gold`, `--paper` and `--muted`. Both options and the theme are in the visual editor.

### Changed
- New look: tiles, brew list and header as small glass cards, segmented filter, the brew selector pill in neutral glass instead of purple, tile colours reduced to a small dot, values in the text colour (accent inside a target, orange outside).
- Weight graph: solid 2 px line, soft fill, fixed-size axis labels, capped height; history chart: slim rounded bars, numbers only on the selected, highest and lowest bar; 24 px stars and a ghost pencil on one row; the brew list is a solid sheet under the pill.
- **Breaking (looks only):** the default `theme` is now `auto`. To keep the old brown look set `theme: dark`; `theme: ha` is unchanged. `--mlc-bg`/`--mlc-bg2` now default to a navy gradient unless `theme: dark`.

## [1.0.1] - 2026-11-20

### Changed
- The visual editor shows the colours that are in use (the built-in defaults) instead of black while nothing is set; only a colour you change is stored.
- The entity field of the editor says it is optional: empty means the Mavo Lumicurve integration is the source.

## [1.0.0] - 2026-11-20

### Changed
- First stable release: Home Assistant syncs the scale over its own Bluetooth, keeps the full brew history (with raw logs and history import), and the card shows it with logbook, graph, targets and ratings.

## [0.9.6] - 2026-11-20

### Fixed
- The newest brew is on top again after importing history: the card now gets its order from the list (oldest first), not from the stored counter.

## [0.9.5] - 2026-11-20

### Added
- The raw log of every sync is saved (`.storage/mavo_lumicurve.<entry>.raw`, newest 2 MB) before it is parsed, because reading erases the log on the scale.
- Service `mavo_lumicurve.import_brews` adds brews that were read elsewhere (e.g. with the Mac tools) in front of the stored history; duplicates are skipped.

### Added
- Integration icon (a coffee cup) in `custom_components/mavo_lumicurve/brand/`; Home Assistant shows it in Settings → Devices & Services. Source: `tools/icon.svg`.

## [0.9.4] - 2026-11-20

### Changed
- The sync log line shows how much log text arrived; debug logging also shows its start and end (to diagnose a download that yields no brews).

## [0.9.3] - 2026-11-20

### Changed
- Adding the integration asks for the scale's Bluetooth address (pre-filled when the scale is recognised). A passive Bluetooth scan has no device name, so the scale was not discovered automatically. Empty address still installs the card with example data.

## [0.9.2] - 2026-11-19

### Changed
- The ratio tile shows the dose as "18 g Kaffee" ("18 g coffee") instead of "18.0 g Mehl".
- The note "Kurve geschätzt" ("curve estimated") sits centred above the graph instead of next to the `(s)` axis label.

## [0.9.1] - 2026-11-19

### Fixed
- The integration now registers the card as a normal dashboard resource (Settings → Dashboards → Resources), like any other custom card. Version 0.9.0 only injected the file into the page, which did not make the card available.

## [0.9.0] - 2026-11-19

### Added
- **Home Assistant integration** `mavo_lumicurve`: finds the scale by Bluetooth discovery, syncs the brew log over Home Assistant's own Bluetooth adapter or ESPHome proxy whenever the scale wakes up, and stores the brews (survives log rotation and backups include it). Sensors (last yield, time, flow, ratio, brew count, battery, last sync), a Sync now button, and an options form for all rules and targets.
- The card reads brews, ratings and default targets from the integration (no configuration needed) and updates after each sync. The integration serves the card file itself.
- Adding the integration without a scale in range creates a placeholder entry, so the card is installed and shows demo data; a real scale replaces it.
- **Demo mode:** until the integration has brews (not set up, or nothing synced yet) the card shows example brews with a hint to add the scale. `demo: true` forces it, e.g. for screenshots.
- The brew sensors have a state class, so Home Assistant keeps hourly long-term statistics of them; the brews themselves live in the integration's storage.
- Unit tests with a simulated scale for the log download and the brew merge.

### Changed
- **Breaking for installs:** the repository is now an *integration* for the Marketplace (category Integration), not a dashboard plugin. The card moved to `custom_components/mavo_lumicurve/www/`. See the migration note in `docs/INSTALL-HA.md`.
- The Mac tools are developer tools only and use the same protocol and parser code as the integration.
- Install guide rewritten around the integration.

## [0.8.3] - 2026-11-19

### Added
- Install guide: Marketplace route (tested on Home Assistant 2026.11) with a My Home Assistant button next to the manual route.
- Release process: `docs/RELEASING.md`, `tools/release.py`, and a GitHub workflow that publishes a release with the card file attached.

## [0.8.2] - 2026-11-19

### Removed
- Unused tools `tools/scan.py` and `tools/watch.py`, the unused example `tools/lumicurve.json.example`, and the outdated plans.

### Changed
- Documentation is now `INSTALL-HA.md`, `CONFIG.md` and `ROADMAP.md`. No change to the card's behaviour.

## [0.8.1] - 2026-11-19

### Added
- `tools/export.py` writes a small `brews_ha.json` for Home Assistant; `run.sh` runs it.
- Step-by-step guide `docs/INSTALL-HA.md`.

### Changed
- The card loads the brews file without the HTTP cache.

## [0.8.0] - 2026-11-19

### Changed
- **Breaking:** the card is now `custom:mavo-lumicurve-card` (was `custom:nofree-brew-card`); file `dist/mavo-lumicurve-card.js`; editor element `mavo-lumicurve-card-editor`.
- **Breaking:** theme variables are `--mlc-*` (were `--nbc-*`). Ratings and notes are stored under `mavo_lumicurve_notes`, so notes entered under the old key are not carried over.
- To upgrade a dashboard: change the resource to the new file and the card `type` to `custom:mavo-lumicurve-card`.

## [0.7.0] - 2026-11-19

### Added
- Fully customizable card: colours, language (de/en), single texts, which parts are shown, targets per type, theme variables, visual editor. See `docs/CONFIG.md`.
- Parser rules in `settings.json`.

## [0.6.0] - 2026-11-19

### Added
- The card works inline in Home Assistant (`brews` in the card config) and registers in the card picker.

## [0.5.0] - 2026-11-19

### Added
- Numbers on the history chart bars and a value axis; tap a bar to select a brew.

### Changed
- Outliers are clipped in the chart.

## [0.4.0] - 2026-11-19

### Added
- Targets per type (espresso, filter) and a brew dropdown.

### Changed
- The "last 5" list is gone; compact layout that scales with the width.

## [0.3.0] - 2026-11-19

### Added
- Scale-style top section: four tiles, weight graph, brew selector with arrows.

## [0.1.0] - 2026-11-19

### Added
- First card: logbook, flow rate, notes and stars. Scale tools: log sync, parser with real timestamps, discovery.

[Unreleased]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.6...v1.0.0
[0.9.6]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.5...v0.9.6
[0.9.5]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.4...v0.9.5
[0.9.4]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.3...v0.9.4
[0.9.3]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.3...v0.9.0
[0.8.3]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/releases/tag/v0.7.0
