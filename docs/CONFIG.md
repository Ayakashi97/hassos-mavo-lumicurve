# Configuration: where everything is set

Short answer: **the card is configured in the dashboard** (visual editor or YAML), the **scale link** in `data/lumicurve.json`,
the **parsing rules** in `settings.json`. Details below.

## 1. Map: what lives where

| What | Where | How to change it |
|---|---|---|
| Card look, texts, what is shown, targets | the card's config in the dashboard | dashboard edit mode → card → pencil (visual editor), or "Show code editor" (YAML) |
| Colours via the HA theme | theme variables `--mlc-*` (section 3) | `frontend: themes:` in the HA theme file, or `card_mod` on one card |
| Brews shown by the card | `entity` (attribute `brews`), `brews_url` (JSON file) or `brews` (inline list) | card config |
| Ratings, bean, notes per brew | HA user data (`frontend/set_user_data`, key `mavo_lumicurve_notes`), browser `localStorage` as fallback | in the card (stars, pencil); per HA user, not shared |
| Which scale to sync | `data/lumicurve.json` (`address`, `name`) | `tools/discover.py` writes it; delete the file to search by name again |
| Raw logs and parsed brews | `data/scale_log_<time>.txt`, `data/brews.json` | `run.sh` or `tools/sync.py` + `tools/parse.py`; `data/` is not in git |
| Rules of the parser (what is a filter brew, what is noise, dose range, anchor delay) | `settings.json` in the repo root (optional) | copy `settings.json.example`, change values; defaults are at the top of `tools/parse.py` |
| Test page presets | `card/test.html` (`presets`) | edit the JS object |
| Card file in Home Assistant | a dashboard resource (see `INSTALL-HA.md`) | replace the file and change `?v=` in the resource URL |
| Rules, default targets, flow tile, sync interval (integration) | Settings → Devices & services → Mavo Lumicurve → Configure | the card uses them as defaults; card options win |
| Brews, ratings, notes (integration) | integration storage (`.storage/mavo_lumicurve.*`, included in backups) | stars/notes are saved from the card |

## 2. Card options

All keys are optional except one data source. A key set in the card config always wins.

**Data**

| key | default | meaning |
|---|---|---|
| `entity` | – | entity whose attribute `brews` holds the list |
| `brews_url` | – | URL of a JSON file with the list (test page, `/local/…`) |
| `brews` | – | the list inline in the config (static; for tests) |

**Texts**

| key | default | meaning |
|---|---|---|
| `language` | `de` | `de` or `en` (all texts and the date format: `19.11.2026` / `11/19/2026`) |
| `title` | text of the language | card title |
| `labels` | – | object that overrides single texts, e.g. `labels: { ratio: "Brew ratio", flow: "g/s" }` (keys in section 4) |

**Colours** (any CSS colour: `#e8b54a`, `rgb(…)`, `var(--primary-color)`)

| key | default | used for |
|---|---|---|
| `theme` | `auto` | `auto` = the glass look (dark; every colour from `--mlc-*`, then host tokens `--gold`, `--paper`, `--muted`, then built-in), `dark` = the classic look of 1.0.x (brown gradient, own colours below), `ha` = text and background come from the HA theme (use it on light themes). See section 3a |
| `accent` | `#e8b54a` | graph line, bars, selected items, stars, active buttons |
| `color_ratio` / `color_flow` / `color_weight` / `color_time` | orange / green / purple / pink | dot and big value of each tile (like the scale's screen); defaults are lighter on dark panels, darker with `theme: ha` |
| `color_in` / `color_out` | light accent (`auto`) or `#7fdc8a` / `#f0a06a` | the tile's "Target ..." line (with a check mark inside) and the target band in the chart; the value keeps its tile colour |
| `color_pill` | neutral glass (`dark`: accent mixed with purple) | brew selector pill; set it only if you want a coloured pill |
| `text_color` | `#f4efe6` | text (not with `theme: ha`) |
| `background`, `background_end` | `#1f2a3f`, `#141b2b` (`dark`: `#4a3d2c`, `#2a2217`) | gradient of the panel (not with `theme: ha`, not with `surface: none`); set only `background` for a flat colour |
| `border_radius` | `20` | corner radius in px |
| `font_scale` | `100` | percent; scales text and the big tile numbers |

**Surface and layout** (new in 1.1.0)

| key | default | meaning |
|---|---|---|
| `surface` | `card` | `card` = the card has its own panel (gradient, border, shadow, padding). `none` = no panel at all, so a host (a glass dialog, a dashboard card) provides the surface; the tiles and the brew list stay small glass cards |
| `layout` | `auto` | `auto` = graph and history chart side by side (about 60 / 40) when the card is at least 720 px wide, stacked below that. `compact` = always stacked, `wide` = always side by side. The four tiles are one row from 560 px, 2 x 2 below, independent of `layout` |

**Parts to show** (all `true` by default)

`show_title`, `show_filter` (All/Espresso/Filter buttons), `show_tiles` (the four tiles), `show_graph` (weight graph),
`show_chart` (history chart), `show_stars`, `show_notes` (pencil button), `show_menu` (brew dropdown; off = the pill is only a label).
If both `show_title` and `show_filter` are off, the header disappears.

**Behaviour**

| key | default | meaning |
|---|---|---|
| `default_mode` | `all` | start filter: `all`, `espresso`, `pourover` |
| `chart_count` | `30` | bars in the history chart |
| `chart_metric` | `time` | chart starts with `time` or `flow` (switchable in the card) |
| `flow_value` | `auto` | flow tile: `auto` (peak if the log has enough samples, else average), `avg`, `peak` |
| `show_invalid` | `false` | also show tare/noise events |

**Targets** per type, each `[min, max]`; a tile turns `color_in` inside and `color_out` outside, "on target" appears when every target you set is met:

```yaml
targets:
  espresso: { time: [22, 30], yield: [34, 42], flow: [1.3, 2.2], ratio: [1.8, 2.5] }
  pourover: { time: [150, 210], yield: [250, 310], flow: [1.3, 2.0], ratio: [15, 17] }
# or the same range for both types:
target_time: [20, 30]      # also target_yield, target_flow, target_ratio
```
`flow` compares with the average flow (yield ÷ time), not the peak shown on the tile.

## 3. Colours from the theme or card-mod

For every colour there is a CSS variable. Priority: **card config > theme variable > built-in default**.

| variable | same as |
|---|---|
| `--mlc-accent` | `accent` |
| `--mlc-ratio`, `--mlc-flow`, `--mlc-weight`, `--mlc-time` | the four tile colours |
| `--mlc-in`, `--mlc-out` | `color_in`, `color_out` |
| `--mlc-pill` | `color_pill` |
| `--mlc-text`, `--mlc-bg`, `--mlc-bg2` | `text_color`, `background`, `background_end` (not with `theme: ha`) |
| `--mlc-muted` | secondary text (labels, captions, axis numbers); no config key |
| `--mlc-sheet` | solid colour of the brew dropdown; no config key. The dropdown is never see-through |
| `--mlc-display` | font family of the big tile numbers (a serif or display font); default: the card font |

```yaml
# HA theme (frontend: themes:) – all brew cards change together
my_theme:
  mlc-accent: "#4cc9f0"
  mlc-in: "#80ed99"
```
```yaml
# one card, with card-mod
type: custom:mavo-lumicurve-card
entity: sensor.mavo_lumicurve_brews
card_mod:
  style: |
    :host { --mlc-accent: hotpink; }
```

## 3a. Theme, surface, layout and host tokens

`theme` picks the colour family, `surface` whether the card draws its own panel, `layout` how the charts are arranged. They are independent.

- **`theme: auto` (default since 1.1.0)**: dark glass look. For each colour the card takes the first that exists: card option, `--mlc-*`, then (accent, text, muted only) the generic host tokens `--gold`, `--paper`, `--muted` that a dashboard may define, then a built-in dark default. It never reads Home Assistant's light/dark colours, so on a light dashboard use `theme: ha`.
- **`theme: dark`**: the 1.0.x look with its brown gradient and `--mlc-*` colours (host tokens are ignored). Structure, tiles and charts are the new ones; only the colours are the old ones. Nothing to change if you set `theme: dark` explicitly.
- **`theme: ha`**: text, panel and dropdown colours from Home Assistant (`--primary-text-color`, `--ha-card-background`, `--card-background-color`).
- Embedding in a glass dashboard: `surface: none` and set `--gold`, `--paper`, `--muted` (or `--mlc-accent`, `--mlc-text`, `--mlc-muted`) on the dashboard. Optional: `--mlc-sheet` for the dropdown colour and `--mlc-display` for a display font.

## 4. Text keys for `labels`

`title all espresso pourover ratio flow weight time target inTarget older newer pick bean note editNote stars chartTime chartFlow last btnTime btnFlow earlier earlierDate earlierFull estimated empty dose pickHint graphAria avg`
(`graphAria` may contain `{s}` for the seconds). Example: `labels: { pourover: "V60", ratio: "Ratio" }`.

## 5. The visual editor

Dashboard → edit → card → pencil. It has Theme, Surface and Layout, Colours, Show, Behaviour and look, and Targets for both types (min/max; empty = no target).
It writes the same keys as YAML (colours as `#rrggbb`). Not in the editor, use YAML: `labels`, `brews_url`, `brews`, flat `target_*`.
The editor needs the Home Assistant frontend (it uses `ha-form`), so it can only be tried inside HA, not on the local test page.

## 6. Shape of a brew (`brews` list)

```json
{ "seq": 116, "ts": "2022-02-22 05:27:59", "real_ts": "2026-11-19 13:53:56", "mode": "pourover",
  "yield_g": 268.5, "time_s": 183, "flow_gs": 1.47, "dose_g": 15.0, "ratio": 17.9,
  "curve": [[0, 0], [14, 88.2], [183, 268.5]] }
```
`seq` is the order (newest = highest). `real_ts` is null for brews whose real time is unknown (card shows "früher"/"earlier").
`valid: false` marks noise (hidden unless `show_invalid`). `curve` is optional ([seconds, grams] points).

## 7. Parser settings (`settings.json`)

`pourover_min_s` (90) brews at least this long are filter, `min_time_s` (8) and `min_yield_g` (5) below which a brew is noise,
`dose_g` ([10, 20]) range that counts as the dose, `sync_delay_s` (10) seconds between the sync file's time stamp and the BLE connection.
After a change run `.venv/bin/python tools/parse.py data/scale_log_<time>.txt data/brews.json` again.


## Demo mode

Without a configured scale (or before the first sync) the card shows example brews and a hint. `demo: true` shows them always; ratings are then kept in memory only.
