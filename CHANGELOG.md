# Changelog

All notable changes. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/) (while below 1.0, a breaking change raises the minor number).
How releases are made: [docs/RELEASING.md](docs/RELEASING.md).

## [Unreleased]

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

[Unreleased]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Ayakashi97/hassos-mavo-lumicurve/releases/tag/v0.7.0
