# Configuration: where everything is set

Short answer: **the card is configured in the dashboard** (visual editor or YAML), the **scale link** in `data/lumicurve.json`,
the **parsing rules** in `settings.json`. Details below.

## 1. Map: what lives where

| What | Where | How to change it |
|---|---|---|
| Card look, texts, what is shown, targets | the card's config in the dashboard | dashboard edit mode → card → pencil (visual editor), or "Show code editor" (YAML) |
| Colours via the HA theme | theme variables `--nbc-*` (section 3) | `frontend: themes:` in the HA theme file, or `card_mod` on one card |
| Brews shown by the card | `entity` (attribute `brews`), `brews_url` (JSON file) or `brews` (inline list) | card config |
| Ratings, bean, notes per brew | HA user data (`frontend/set_user_data`, key `nofree_brew_notes`), browser `localStorage` as fallback | in the card (stars, pencil); per HA user, not shared |
| Which scale to sync | `data/lumicurve.json` (`address`, `name`) | `tools/discover.py` writes it; delete the file to search by name again |
| Raw logs and parsed brews | `data/scale_log_<time>.txt`, `data/brews.json` | `run.sh` or `tools/sync.py` + `tools/parse.py`; `data/` is not in git |
| Rules of the parser (what is a filter brew, what is noise, dose range, anchor delay) | `settings.json` in the repo root (optional) | copy `settings.json.example`, change values; defaults are at the top of `tools/parse.py` |
| Test page presets | `card/test.html` (`presets`) | edit the JS object |
| Card file in Home Assistant | dashboard resource `ab05e666d7ee435e9f9dbbe12f42709f` (inline) | `ha_config_set_dashboard_resource(resource_id=…, content=…)`; source is `dist/nofree-brew-card.js` |
| Test dashboard | `kaffee-log` (admin only), card config inside the dashboard | Settings → Dashboards, or the editor |
| Long-term data in HA (later) | integration store, see `docs/HA.md` | not built yet |

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
| `theme` | `dark` | `dark` = own colours below, `ha` = text and background come from the HA theme (works on light themes) |
| `accent` | `#e8b54a` | graph line, bars, selected items, stars, active buttons |
| `color_ratio` / `color_flow` / `color_weight` / `color_time` | orange / green / purple / pink | labels of the four tiles (like the scale's screen) |
| `color_in` / `color_out` | `#7fdc8a` / `#f0a06a` | value inside / outside its target; target band in the chart |
| `color_pill` | accent mixed with purple | brew selector pill |
| `text_color` | `#f4efe6` | text (only with `theme: dark`) |
| `background`, `background_end` | `#4a3d2c`, `#2a2217` | gradient of the card (only with `theme: dark`); set only `background` for a flat colour |
| `border_radius` | `20` | corner radius in px |
| `font_scale` | `100` | percent; scales text and the big tile numbers |

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
| `--nbc-accent` | `accent` |
| `--nbc-ratio`, `--nbc-flow`, `--nbc-weight`, `--nbc-time` | the four tile colours |
| `--nbc-in`, `--nbc-out` | `color_in`, `color_out` |
| `--nbc-pill` | `color_pill` |
| `--nbc-text`, `--nbc-bg`, `--nbc-bg2` | `text_color`, `background`, `background_end` (theme `dark` only) |

```yaml
# HA theme (frontend: themes:) – all brew cards change together
my_theme:
  nbc-accent: "#4cc9f0"
  nbc-in: "#80ed99"
```
```yaml
# one card, with card-mod
type: custom:nofree-brew-card
entity: sensor.mavo_lumicurve_brews
card_mod:
  style: |
    :host { --nbc-accent: hotpink; }
```

## 4. Text keys for `labels`

`title all espresso pourover ratio flow weight time target inTarget older newer pick bean note editNote stars chartTime chartFlow last btnTime btnFlow earlier earlierDate earlierFull estimated empty dose pickHint graphAria avg`
(`graphAria` may contain `{s}` for the seconds). Example: `labels: { pourover: "V60", ratio: "Ratio" }`.

## 5. The visual editor

Dashboard → edit → card → pencil. It has Colours, Show, Behaviour and look, and Targets for both types (min/max; empty = no target).
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
