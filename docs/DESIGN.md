# Design: the card should look like the scale's own display

Reference: photo of the scale's "Record 3" screen (round display): a purple **Record N** pill, a 2×2 grid
(**Ratio (x)** orange, **Flow (g/s)** green, **Weight (g)** purple, **Time m:ss** pink) separated by a thin cross,
and under it a **Weight Graph** (y: 0 / 70 / 140 g, x: 0–20 s in 4 s steps, dotted grid, line with a marker where the shot ended).
Example on the scale: Ratio `--`, Flow 13.6 g/s, Weight 109.1 g, Time 0:11.

## Layout (implemented in card v0.3 as a first pass)
1. **Selector pill** `‹ Bezug 3/111 · 19.11.2026 16:06 ›`: shows the selected brew, arrows go to older/newer. Default = newest.
2. **Four tiles** in the scale's colours, big white numbers, labels under them (German: Verhältnis, Fluss, Gewicht, Zeit).
   Ratio shows `--` when no dose was weighed (same as the scale). Time as `m:ss`.
3. **Weight graph** like the scale: `(g)` axis with nice maximum (20/40/70/100/140/200…), `(s)` axis with 4 s ticks
   (10 s / 30 s for long pours), dotted grid, end marker ▼ with a dashed line, subtle area under the line.
4. **Brew dropdown** = the logbook: the pill is a button that opens a glass list of all brews, grouped by day, with
   yield, time, flow, bean/note and stars; arrow keys + Enter, Esc closes, the selected brew is centred. The old
   "Letzte 5" list is gone (arrows on top zap through the brews).
   Bean, note and stars of the shown brew sit under the graph. History chart (time or flow) below.
5. Glass look, icon buttons, 40 px targets, German text (see the dashboard's STYLEGUIDE).

## Data we still need (decisions / experiments)
| Topic | Problem | Plan |
|---|---|---|
| **Graph accuracy** | The scale has a per-second weight curve (`weight num N` in the log is the number of graph points, about 1 per second), but the log only prints a few samples. Espresso graphs are therefore a straight estimate (dashed). | Try the scale's own **record/history download** (Beanconqueror notes mention command `02 01 03` on `fff2`; its author got an empty list on another firmware). Read-only experiment: send it, log every reply. If it returns the stored curves, use them. |
| **Flow number** | The scale shows 13.6 g/s for 109.1 g in 11 s (average would be 9.9), so it is a peak or phase flow, not Ø. | The next sync should contain this record. Compare candidates (max over 1 s / 2 s windows, mean during the pour) with 13.6 and copy the one that matches. Until then the card shows the peak of the logged samples (real curves) or Ø, with the Ø value under it. |
| **Record numbers** | "Record 3" is the scale's own list. | Check after the next sync whether the log or the history command carries the record index; until then we number by position. |
| **Dose / ratio** | Only brews where grounds were weighed first have a ratio. | Keep `--`; optional config `default_dose` to estimate ratio. |
| **Dates** | Clock restarts at 2022-02-02 after every cold boot. | Real times are derived from the sync time (confirmed correct by you). Setting the scale clock (documented write to `fff1`) would make future runs exact. |

## Customization (card config)
`title`, `accent`, `recent`, `chart_count`, `chart_metric`, `target_time|yield|flow`, `show_invalid`; planned: tile colours,
language (de/en), which tiles to show, graph y-max, units (g/oz).

## Phases
1. (done) Parser with runs, real timestamps, curves; card with logbook, flow, expandable list, notes.
2. (done, prototype) Scale-style hero with selector, tiles and graph.
3. Experiments after the next sync: record download command, match the flow number, check record numbering.
4. Home Assistant side (see PLAN.md): auto-discovery, sync on advertisement, sensors, JSON/history storage.
5. Polish: swipe left/right for brews, visual config editor, dark/light.

## Targets per type (implemented)
`targets.espresso` and `targets.pourover` each take `time`, `yield`, `flow` (average g/s) and `ratio` as `[min, max]`.
Each tile shows its range ("Ziel 22–30 s"), turns green inside and orange outside; "im Ziel" appears when every defined
target is met. The history chart draws the band for the current type. The values in `card/test.html` are placeholders
(espresso 34–42 g in 22–30 s, ratio 1.8–2.5; filter 250–310 g in 150–210 s, ratio 15–17): replace them with your own.
