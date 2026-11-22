/* mavo-lumicurve-card · v1.1.2 · Mavo Lumicurve brew logbook
   Everything is configurable: see docs/CONFIG.md (options, colours, CSS variables, labels, where each thing lives).
   Source of the brews: `entity` (attribute `brews`), `brews_url` (JSON file) or `brews` (inline list).
   Notes/stars live in HA user data (frontend/set_user_data), localStorage as fallback. */
const KEY = 'mavo_lumicurve_notes';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IC = { // 24x24 stroke icons
  cup: '<path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2"/>',
  down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', edit: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

// ---- texts: `language` picks a set, `labels: {key: 'text'}` overrides single entries
const LABELS = {
  de: { title: 'Logbuch', all: 'Alle', espresso: 'Espresso', pourover: 'Filter', ratio: 'Verhältnis (x)', flow: 'Fluss (g/s)', weight: 'Gewicht (g)', time: 'Zeit', target: 'Ziel', inTarget: 'im Ziel', older: 'Älterer Bezug', newer: 'Neuerer Bezug', pick: 'Bezug auswählen', bean: 'Bohne', note: 'Notiz', editNote: 'Notiz bearbeiten', stars: 'Sterne', chartTime: 'Bezugszeit (s)', chartFlow: 'Durchfluss (g/s)', last: 'letzte', btnTime: 'Zeit', btnFlow: 'Fluss', earlier: 'früher', earlierDate: 'Frühere Sitzung', earlierFull: 'frühere Sitzung (Datum unbekannt)', latest: 'spätestens (genaue Zeit unbekannt)', estimated: 'Kurve geschätzt', empty: 'Noch keine Brühungen.', demo: 'Beispieldaten: Noch keine Waage eingerichtet. Einstellungen → Geräte & Dienste → Mavo Lumicurve hinzufügen (Waage vorher aufwecken).', dose: 'Kaffee', pickHint: 'Balken antippen zum Auswählen', graphAria: 'Gewichtsverlauf über {s} Sekunden', avg: 'Ø' },
  en: { title: 'Logbook', all: 'All', espresso: 'Espresso', pourover: 'Filter', ratio: 'Ratio (x)', flow: 'Flow (g/s)', weight: 'Weight (g)', time: 'Time', target: 'Target', inTarget: 'on target', older: 'Older brew', newer: 'Newer brew', pick: 'Select brew', bean: 'Beans', note: 'Note', editNote: 'Edit note', stars: 'stars', chartTime: 'Brew time (s)', chartFlow: 'Flow (g/s)', last: 'last', btnTime: 'Time', btnFlow: 'Flow', earlier: 'earlier', earlierDate: 'Earlier session', earlierFull: 'earlier session (date unknown)', latest: 'no later than (exact time unknown)', estimated: 'curve estimated', empty: 'No brews yet.', demo: 'Example data: no scale set up yet. Settings → Devices & services → add Mavo Lumicurve (wake the scale first).', dose: 'coffee', pickHint: 'tap a bar to select', graphAria: 'Weight over {s} seconds', avg: 'Ø' },
};
// ---- defaults of every option (a key set in the card config always wins; a CSS variable --mlc-* wins over the built-in default)
function demoBrews() { // example brews for the empty state and `demo: true`: a week of espresso and a few pour-overs
  const pad = n => String(n).padStart(2, '0'), out = [], now = Date.now();
  for (let i = 0; i < 14; i++) {
    const po = i % 5 === 4, t = po ? 150 + (i * 7) % 40 : 22 + (i * 3) % 9, dose = po ? 15 : 18, y = po ? 250 + (i * 11) % 40 : +(34 + (i * 5) % 9 + .4).toFixed(1);
    const d = new Date(now - (13 - i) * 36e5 * 11), real = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    const n = po ? 15 : 3, curve = Array.from({ length: n + 1 }, (_, k) => [Math.round(t * k / n), +(y * Math.pow(k / n, po ? 1.1 : 1.6)).toFixed(1)]);
    out.push({ id: 'demo' + i, seq: i, ts: real, real_ts: real, mode: po ? 'pourover' : 'espresso', valid: true, yield_g: y, time_s: t, flow_gs: +(y / t).toFixed(2), dose_g: dose, ratio: +(y / dose).toFixed(2), curve, stars: i % 3 ? 0 : 4, bean: '', note: '' });
  }
  return out;
}
const DEF = { language: 'de', theme: 'auto', surface: 'card', layout: 'auto', chart_count: 30, chart_metric: 'time', default_mode: 'all', flow_value: 'auto', show_invalid: false, border_radius: 20, font_scale: 100,
  show_title: true, show_filter: true, show_tiles: true, show_graph: true, show_chart: true, show_stars: true, show_notes: true, show_menu: true, targets: {} };
const VARS = { // config key -> [css variable, theme variable name, built-in default]; accent, in, pill depend on `theme` (see _applyVars) // entries: [css variable, theme variable name, default for dark panels, darker default for theme ha]
  color_ratio: ['--c-r', 'ratio', '#f59a57', '#d9701f'], color_flow: ['--c-f', 'flow', '#7ddb79', '#2f9e44'], color_weight: ['--c-w', 'weight', '#a99cff', '#6b5ce0'], color_time: ['--c-t', 'time', '#ec7ab5', '#c2377f'], color_out: ['--out', 'out', '#f0a06a'],
};
const when = (ts, en) => { // "2026-11-19 13:53:56" -> parts; null when unknown
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)(:\d\d)?/.exec(ts || ''); if (!m) return null;
  const date = en ? `${m[2]}/${m[3]}/${m[1]}` : `${m[3]}.${m[2]}.${m[1]}`;
  return { short: en ? `${m[2]}/${m[3]}` : `${m[3]}.${m[2]}.`, date, time: m[4], full: `${date} ${m[4]}`, year: +m[1] };
};
const CSS = `
:host{display:block;container-type:inline-size;color:var(--tx);font:calc(14px*var(--fsc))/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;--s1:color-mix(in srgb,var(--tx) 7%,transparent);--s2:color-mix(in srgb,var(--tx) 12%,transparent);--bd:color-mix(in srgb,var(--tx) 18%,transparent);--bd2:color-mix(in srgb,var(--tx) 26%,transparent);--hl:inset 0 1px 0 color-mix(in srgb,var(--tx) 14%,transparent)}
*{box-sizing:border-box}
.card{--ph:clamp(120px,26cqw,200px);position:relative;padding:16px;border-radius:var(--r);background:linear-gradient(155deg,var(--bg1),var(--bg2));border:1px solid var(--bd);box-shadow:var(--hl),0 10px 30px rgba(0,0,0,.28)}
.card.s-none{padding:0;border:0;border-radius:0;background:none;box-shadow:none}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
button{font:inherit;color:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid var(--bd);background:var(--s1);cursor:pointer;transition:transform .12s,background .15s,border-color .15s}
button:hover{background:var(--s2)}button:active{transform:scale(.97)}button:disabled{opacity:.35;cursor:default}
button:focus-visible,.row:focus-visible{outline:2px solid var(--a);outline-offset:2px}
button.icon{width:40px;padding:0}button.ghost{background:none;border-color:transparent}button.ghost:hover{background:var(--s1)}
.seg{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--s1);border:1px solid var(--bd)}
.seg button{min-height:32px;padding:0 14px;background:none;border-color:transparent;font-size:.93em}.seg button:hover{background:var(--s2)}
.seg button.on{background:color-mix(in srgb,var(--a) 20%,transparent);color:var(--a);border-color:var(--a)}
.seg.sm button{min-height:26px;padding:0 10px;font-size:.86em}
header{position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;margin-bottom:16px}
header h2{margin:0;font-size:1.07em;font-weight:600;font-variant-caps:all-small-caps;letter-spacing:.16em;color:var(--a);white-space:nowrap}
.nav{display:flex;align-items:center;gap:6px;margin-left:auto;min-width:0}
.pill{min-width:0;padding:0 14px;font-size:.93em;white-space:nowrap}.pill[aria-expanded=true]{border-color:var(--a);color:var(--a)}
.pill span{overflow:hidden;text-overflow:ellipsis}.pill.static{cursor:default;background:var(--pill)}
.pill:not(.static){background:var(--pill)}
@container (max-width:559px){.nav{flex:1 0 100%}.pill{flex:1}}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@container (min-width:560px){.tiles{grid-template-columns:repeat(4,1fr)}}
.tile{min-width:0;padding:12px 14px;border-radius:calc(var(--r)*.8);border:1px solid var(--bd);background:color-mix(in srgb,var(--tx) 5%,transparent);box-shadow:var(--hl)}
.tl{display:flex;align-items:center;gap:7px;font-size:.82em;text-transform:uppercase;letter-spacing:.09em;color:var(--mut)}
.dot{width:6px;height:6px;border-radius:50%;background:var(--dc);flex:none}
.tile.r{--dc:var(--c-r)}.tile.f{--dc:var(--c-f)}.tile.w{--dc:var(--c-w)}.tile.t{--dc:var(--c-t)}
.tile b{display:block;margin:6px 0 2px;font-family:var(--mlc-display,inherit);font-size:2.143em;font-weight:600;letter-spacing:-.01em;line-height:1.1;font-variant-numeric:tabular-nums}
.tile b{color:var(--dc)}
.tile small{display:flex;align-items:center;gap:4px;min-height:1.3em;font-size:.893em;color:var(--mut)}.tile small.in{color:var(--in)}.tile small.out{color:var(--out)}
.chip{display:inline-flex;align-items:center;gap:4px;margin-top:10px;padding:3px 10px;border-radius:999px;background:color-mix(in srgb,var(--in) 18%,transparent);color:var(--in);font-size:.86em}.chip .ic,.ic.ok{width:14px;height:14px}
.sec{margin-top:16px;padding-top:14px;border-top:1px solid var(--bd);min-width:0}
.split{display:grid;gap:0 24px}
@container (min-width:720px){.l-auto .split.two{grid-template-columns:3fr 2fr}}
.l-wide .split.two{grid-template-columns:3fr 2fr}
.sh{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:30px;font-size:.86em;color:var(--mut)}
.plot{position:relative;height:var(--ph);margin:18px 12px 26px 34px}
.plot svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.gl{position:absolute;left:0;right:0;height:0;border-top:1px dotted var(--bd2)}.gl.z{border-top-style:solid}
.yl,.xl{position:absolute;font-size:.786em;line-height:1;white-space:nowrap;color:var(--mut);font-variant-numeric:tabular-nums}
.yl{right:calc(100% + 6px);transform:translateY(-50%)}.xl{top:calc(100% + 8px);transform:translateX(-50%)}
.wl{fill:none;stroke:var(--a);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.pt{position:absolute;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--a);box-shadow:0 0 0 3px color-mix(in srgb,var(--a) 25%,transparent)}
.bars{position:absolute;inset:0;display:flex;align-items:flex-end;gap:2px}
.bw{position:relative;flex:1 1 0;min-width:0;height:100%;display:flex;justify-content:center;align-items:flex-end;cursor:pointer}
.bar{width:max(3px,min(8px,75%));border-radius:4px 4px 1px 1px;background:color-mix(in srgb,var(--a) 35%,transparent);transition:background .15s}
.bw:hover .bar{background:color-mix(in srgb,var(--a) 60%,transparent)}.bw.cur .bar{background:var(--a)}
.vl{position:absolute;left:50%;transform:translateX(-50%);font-size:.786em;line-height:1;color:var(--tx);font-variant-numeric:tabular-nums;pointer-events:none}
.bw.cur .vl{color:var(--a);font-weight:700}.bw.f .vl{left:0;transform:none}.bw.l .vl{left:auto;right:0;transform:none}
.band{position:absolute;left:0;right:0;border-radius:4px;background:var(--in);opacity:.12}
.notes{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px}
.notes button{width:40px;padding:0;color:var(--mut)}.notes button.on{color:var(--a)}.notes .ic{width:24px;height:24px}.notes button.on .ic{fill:var(--a)}
.notes .nt{flex:1 1 140px;min-width:0;padding-left:8px;font-size:.93em;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ed{flex:1 0 100%;display:grid;gap:8px;margin-top:6px}
input,textarea{font:inherit;color:inherit;padding:9px 12px;border-radius:12px;border:1px solid var(--bd);background:var(--s1)}
input:focus-visible,textarea:focus-visible{outline:2px solid var(--a);outline-offset:1px}
.menu{position:absolute;z-index:5;top:calc(100% + 8px);right:0;width:min(460px,100%);max-height:min(380px,60vh);overflow:auto;padding:6px;border-radius:calc(var(--r)*.9);background:linear-gradient(var(--sheet),var(--sheet)),var(--base);border:1px solid var(--bd);box-shadow:0 16px 40px rgba(0,0,0,.5),var(--hl)}
@container (max-width:559px){.menu{left:0;width:auto}}
.day{margin:12px 0 2px 12px;font-size:.82em;text-transform:uppercase;letter-spacing:.09em;color:var(--mut)}.day:first-child{margin-top:6px}
.row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;min-height:52px;padding:8px 12px;border-radius:12px;cursor:pointer}
.row:hover{background:var(--s1)}.row.sel{background:color-mix(in srgb,var(--a) 16%,transparent)}
.row b{display:block;font-size:1.07em;font-weight:500}.row small{display:block;font-size:.893em;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .r{text-align:right;font-size:.893em;color:var(--mut)}.stars{color:var(--a)}
.hint{margin:0 0 12px;padding:8px 12px;border-radius:10px;font-size:.86em;background:color-mix(in srgb,var(--a) 18%,transparent)}
.empty{opacity:.7;padding:20px 0;text-align:center}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

class MavoLumicurveCard extends HTMLElement {
  static getConfigElement() { return document.createElement('mavo-lumicurve-card-editor'); }
  static getStubConfig() { return { targets: { espresso: { time: [22, 30], yield: [34, 42] }, pourover: { time: [150, 210], yield: [250, 310] } } }; }
  setConfig(c) {
    // targets: { espresso: {time:[min,max], yield:[..], flow:[..], ratio:[..]}, pourover: {...} }; flat target_time/yield/flow/ratio apply to both modes
    this._cfg = c; this._srv = this._srv || {}; this._c = { ...DEF, ...this._srv, ...c };
    this._int = !c.entity && !c.brews && !c.brews_url && !c.demo; this._demo = !!c.demo; // no other source given = read from the Mavo Lumicurve integration
    this._L = { ...LABELS[this._c.language] || LABELS.de, ...c.labels }; this._en = this._c.language === 'en';
    this._mode = this._c.default_mode; this._sel = null; this._menu = false; this._nopen = false; this._brews = null;
    this._applyVars();
    if (!this.shadowRoot) { const r = this.attachShadow({ mode: 'open' }); this._wire(r); }
    this._notes = this._int ? (this._notes || {}) : this._load(); if (c.demo) { this._brews = demoBrews(); this._draw(); } else if (c.brews) { this._brews = c.brews; this._draw(); } else if (this._int) this._ws(); else this._fetch();
  }
  _applyVars() { // explicit config wins; otherwise the theme variable --mlc-<name>; otherwise the host token (theme auto only) or the built-in default
    const c = this._c, ha = c.theme === 'ha', auto = c.theme === 'auto', set = (k, v) => this.style.setProperty(k, v);
    const pick = (key, name, def) => (c[key] !== undefined && c[key] !== '' ? c[key] : `var(--mlc-${name}, ${def})`);
    for (const [key, [v, name, def, haDef]] of Object.entries(VARS)) set(v, pick(key, name, ha && haDef || def));
    set('--a', pick('accent', 'accent', auto ? 'var(--gold, #e8b54a)' : '#e8b54a'));
    set('--in', pick('color_in', 'in', auto ? 'color-mix(in srgb, var(--a) 72%, #fff)' : '#7fdc8a'));
    set('--pill', pick('color_pill', 'pill', ha || auto ? 'var(--s1)' : 'color-mix(in srgb,var(--a) 20%,#7a5cff 20%)'));
    const haBg = 'var(--ha-card-background, var(--card-background-color, #2a2217))';
    set('--tx', ha ? 'var(--primary-text-color, #f4efe6)' : pick('text_color', 'text', auto ? 'var(--paper, #f4efe6)' : '#f4efe6'));
    set('--mut', auto ? 'var(--mlc-muted, var(--muted, color-mix(in srgb, var(--tx) 66%, transparent)))' : 'color-mix(in srgb, var(--tx) 62%, transparent)');
    const bg2 = c.background && c.background_end === undefined ? c.background : pick('background_end', 'bg2', auto ? '#141b2b' : '#2a2217');
    set('--bg1', ha ? haBg : pick('background', 'bg', auto ? '#1f2a3f' : '#4a3d2c'));
    set('--bg2', ha ? haBg : bg2);
    // the brew list must never be see-through: a solid sheet over a solid base, whatever the card background is
    set('--sheet', ha ? 'var(--card-background-color, #fff)' : `var(--mlc-sheet, ${auto && !c.background && !c.background_end ? '#1b2437' : bg2})`);
    set('--base', ha ? 'var(--primary-background-color, #fff)' : '#141b2b');
    set('--r', `${+c.border_radius}px`); set('--fsc', String((+c.font_scale || 100) / 100));
  }
  _wire(r) { // ShadowRoot has no onclick property, so use listeners (registered once)
    r.addEventListener('click', e => {
      const t = e.target.closest('[data-nav],[data-notes],[data-menu],[data-pick],[data-m],[data-c],[data-s]');
      if (!t) { if (this._menu && !e.target.closest('.menu')) { this._menu = false; this._draw(); } return; }
      if (t.disabled) return;
      let back = false; // a pick from the list returns focus to the pill
      if (t.dataset.nav) { const l = this._list(), i = Math.max(0, l.findIndex(b => b.id === this._selId)) + +t.dataset.nav; this._sel = l[Math.min(Math.max(i, 0), l.length - 1)]?.id; this._nopen = false; }
      else if ('menu' in t.dataset) this._menu = !this._menu;
      else if ('notes' in t.dataset) this._nopen = !this._nopen;
      else if (t.dataset.pick) { back = this._menu; this._sel = t.dataset.pick; this._menu = false; this._nopen = false; }
      else if (t.dataset.c) this._c.chart_metric = t.dataset.c;
      else if (t.dataset.m) { this._mode = t.dataset.m; this._sel = null; this._menu = false; }
      else if (t.dataset.s) { const o = this._notes[this._selId] ||= {}; o.stars = o.stars === +t.dataset.s ? 0 : +t.dataset.s; this._save(); }
      this._draw();
      if (back) this.shadowRoot.querySelector('[data-menu]')?.focus();
      if (this._menu) { const s = this.shadowRoot.querySelector('.menu .sel'); s?.scrollIntoView({ block: 'center' }); s?.focus(); }
    });
    r.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._menu) { this._menu = false; this._draw(); this.shadowRoot.querySelector('[data-menu]')?.focus(); }
      else if (e.key === 'Enter' && e.target.dataset?.pick) e.target.click();
      else if (this._menu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); const it = [...this.shadowRoot.querySelectorAll('.menu .row')], i = it.indexOf(this.shadowRoot.activeElement); it[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), it.length - 1)]?.focus(); }
    });
    r.addEventListener('change', e => { const f = e.target.dataset.f; if (f && this._selId) { (this._notes[this._selId] ||= {})[f] = e.target.value; this._save(); this._draw(); } });
  }
  set hass(h) { const first = !this._h; this._h = h; if (this._int && first) this._ws(); if (this._c?.entity) { const b = h.states[this._c.entity]?.attributes?.brews; if (b !== this._src) { this._src = b; this._brews = b || []; this._draw(); } } }
  async _ws() { // from the integration: brews, notes and its settings (targets, flow tile) as defaults; the card config wins
    if (!this._h) return;
    if (!this._unsub) { this._unsub = true; this._h.connection.subscribeEvents(() => this._ws(), 'mavo_lumicurve_synced').then(u => { this._unsub = u; }, () => { this._unsub = false; }); }
    try {
      const r = await this._h.callWS({ type: 'mavo_lumicurve/brews' });
      this._srv = { targets: r.settings.targets, flow_value: r.settings.flow_value };
      this._c = { ...DEF, ...this._srv, ...this._cfg };
      this._notes = Object.fromEntries(r.brews.filter(b => b.stars || b.bean || b.note).map(b => [b.id, { stars: b.stars, bean: b.bean, note: b.note }]));
      this._demo = !r.brews.length; this._brews = this._demo ? demoBrews() : r.brews; // nothing synced yet: show examples with a hint
    } catch { this._demo = true; this._brews = demoBrews(); } // integration not set up
    this._draw();
  }
  async _fetch() { if (!this._c.brews_url) return; try { this._brews = await (await fetch(this._c.brews_url, { cache: 'no-store' })).json(); } catch { this._brews = []; } this._draw(); }
  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  async _save() {
    if (this._demo) return; // example data: ratings stay in memory
    if (this._int) { const o = this._notes[this._selId] || {}; try { await this._h.callWS({ type: 'mavo_lumicurve/note', id: this._selId, stars: o.stars || 0, bean: o.bean || '', note: o.note || '' }); } catch {} return; }
    try { localStorage.setItem(KEY, JSON.stringify(this._notes)); } catch {}
    try { await this._h?.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._notes }); } catch {}
  }
  _disp(b) { // ts_src latest/seen = upper bound only: "≤" before the time, never hidden
    const w = when(b.real_ts, this._en), L = this._L; if (!w) return { short: L.earlier, date: L.earlierDate, time: '', full: L.earlierFull, year: 0 };
    return b.ts_src === 'latest' || b.ts_src === 'seen' ? { ...w, time: '≤ ' + w.time, full: `${L.latest}: ${w.full}`, est: 1 } : w;
  }
  _list() { // newest first; file order of the scale log = chronological
    return (this._brews || []).map((b, i) => ({ ...b, id: b.id || b.ts + '|' + b.time_s + '|' + b.yield_g, i }))
      .filter(b => (this._c.show_invalid || b.valid !== false) && (this._mode === 'all' || b.mode === this._mode))
      .sort((a, b) => (b.seq ?? b.i) - (a.seq ?? a.i));
  }
  _flow(b) { return b.flow_gs ?? (b.time_s ? b.yield_g / b.time_s : 0); }
  _tg(mode) { const k = this._c; return { time: k.target_time, yield: k.target_yield, flow: k.target_flow, ratio: k.target_ratio, ...(k.targets?.[mode] || {}) }; }
  _st(v, r) { return !r || v == null ? '' : v >= r[0] && v <= r[1] ? 'in' : 'out'; } // 'in' | 'out' | '' (no target)
  _states(b) { const t = this._tg(b.mode); return { time: this._st(b.time_s, t.time), yield: this._st(b.yield_g, t.yield), flow: this._st(this._flow(b), t.flow), ratio: this._st(b.ratio, t.ratio) }; }
  _ok(b) { const s = Object.values(this._states(b)); return s.includes('in') && !s.includes('out'); }
  _chart(list) {
    const L = this._L, fl = this._c.chart_metric === 'flow', val = b => fl ? this._flow(b) : b.time_s, mode = this._mode === 'pourover' ? 'pourover' : 'espresso', tt = this._tg(mode)[fl ? 'flow' : 'time'];
    const d = list.filter(b => b.mode === mode).slice(0, this._c.chart_count).reverse(); /* long pours would flatten the espresso bars */
    if (!d.length) return '';
    const vs = d.map(val).sort((p, q) => p - q), cap = Math.max(vs[Math.floor(0.9 * (vs.length - 1))] * 1.2, tt ? tt[1] * 1.2 : 0, fl ? 1 : 10); // an outlier must not flatten all other bars
    const max = Math.min(Math.max(fl ? 1 : 10, vs[vs.length - 1], tt ? tt[1] : 0), cap), y = v => 100 * Math.min(v, max) / max, fmt = v => fl ? v.toFixed(1) : String(v);
    const si = d.findIndex(b => b.id === this._selId), vi = d.map(val), hi = vi.indexOf(Math.max(...vi)), lo = vi.indexOf(Math.min(...vi)), shown = [];
    for (const i of [si, hi, lo]) if (i >= 0 && shown.every(j => Math.abs(i - j) > 2)) shown.push(i); // value labels: selected, max, min; never touching each other
    const title = `${fl ? L.chartFlow : L.chartTime} · ${L.last} ${d.length}${mode === 'pourover' ? ' ' + L.pourover : ''}`;
    return `<div class="sec chart"><div class="sh"><span>${esc(title)}</span><span class="seg sm">${[['time', L.btnTime], ['flow', L.btnFlow]].map(([k, t]) => `<button data-c="${k}" class="${(fl ? 'flow' : 'time') === k ? 'on' : ''}">${esc(t)}</button>`).join('')}</span></div>
      <div class="plot" role="group" aria-label="${esc(fl ? L.chartFlow : L.chartTime)}; ${esc(L.pickHint)}"><i class="gl z" style="top:100%"></i><i class="gl" style="top:0"></i><span class="yl" style="top:0">${fmt(max)}</span><span class="yl" style="top:100%">0</span>
      ${tt ? `<i class="band" style="bottom:${y(tt[0])}%;height:${Math.max(0, y(tt[1]) - y(tt[0]))}%"></i>` : ''}
      <div class="bars">${d.map((b, i) => `<div class="bw ${b.id === this._selId ? 'cur' : ''} ${i === 0 ? 'f' : i === d.length - 1 ? 'l' : ''}" data-pick="${esc(b.id)}" title="${esc(this._disp(b).full)}: ${fmt(val(b))}"><i class="bar" style="height:${y(val(b))}%"></i>${shown.includes(i) ? `<span class="vl" style="bottom:calc(${y(val(b))}% + 4px)">${fmt(val(b))}</span>` : ''}</div>`).join('')}</div></div></div>`;
  }
  _nice(v) { return [20, 40, 70, 100, 140, 200, 300, 400, 600].find(s => s >= v) || Math.ceil(v / 100) * 100; }
  _peak(b) { // peak flow between samples that are >= 3 s apart (same idea as the scale's number, to be confirmed)
    const p = b.curve || []; let best = 0, j = 0;
    for (let i = 1; i < p.length; i++) { while (p[i][0] - p[j][0] > 3 && j < i - 1) j++; const dt = p[i][0] - p[j][0]; if (dt >= 1) best = Math.max(best, (p[i][1] - p[j][1]) / dt); }
    return best;
  }
  _graph(b) { // look of the scale's own display: (g) axis, 4 s ticks, dotted grid, end marker. Plot in % of its box (stretched svg, 2 px line), labels are HTML so text keeps its size
    const L = this._L, pts = b.curve || [[0, 0], [b.time_s, b.yield_g]], T = b.time_s, real = pts.length >= 5;
    const ym = this._nice(b.yield_g * 1.05), step = T <= 22 ? 4 : T <= 70 ? 10 : 30, xm = Math.max(20, Math.ceil(T * 1.1 / step) * step);
    const x = t => +(100 * t / xm).toFixed(2), y = g => +(100 - 100 * g / ym).toFixed(2), xt = []; for (let t = 0; t <= xm; t += step) xt.push(t);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]) + ' ' + y(p[1])).join('');
    return `<div class="sec graph"><div class="sh"><span>${esc((real ? '' : L.estimated + ' · ') + L.weight + ' · ' + L.time + ' (s)')}</span></div>
      <div class="plot" role="img" aria-label="${esc(L.graphAria.replace('{s}', T))}">${[0, .5, 1].map(f => `<i class="gl ${f ? '' : 'z'}" style="top:${y(ym * f)}%"></i><span class="yl" style="top:${y(ym * f)}%">${Math.round(ym * f)}</span>`).join('')}
      ${xt.map(t => `<span class="xl" style="left:${x(t)}%">${t}</span>`).join('')}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="mlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--a)" stop-opacity=".32"/><stop offset="1" style="stop-color:var(--a)" stop-opacity=".02"/></linearGradient></defs>
      <path d="${path}L${x(T)} 100L0 100Z" fill="url(#mlg)"/><path class="wl" d="${path}"/></svg><i class="pt" style="left:${x(T)}%;top:${y(b.yield_g)}%"></i></div></div>`;
  }
  _nav(b, pos, n, l) { // brew navigator: prev, pill (date · time · type) with the dropdown, next
    const L = this._L, d = this._disp(b), txt = [d.short, d.time, b.mode === 'pourover' ? L.pourover : L.espresso].filter(Boolean).join(' · ');
    return `<div class="nav"><button class="icon" data-nav="1" aria-label="${esc(L.older)}" ${pos >= n - 1 ? 'disabled' : ''}>${ic('left')}</button>
      ${this._c.show_menu ? `<button class="pill" data-menu aria-haspopup="listbox" aria-expanded="${this._menu}" title="${n - pos}/${n}${d.est ? ' · ' + esc(d.full) : ''}"><span>${esc(txt)}</span>${ic(this._menu ? 'up' : 'down')}</button>` : `<div class="pill static"><span>${esc(txt)}</span></div>`}
      <button class="icon" data-nav="-1" aria-label="${esc(L.newer)}" ${pos <= 0 ? 'disabled' : ''}>${ic('right')}</button>
      ${this._menu ? `<div class="menu" role="listbox" aria-label="${esc(L.pick)}">${this._menuRows(l)}</div>` : ''}</div>`;
  }
  _tiles(b) {
    const c = this._c, L = this._L, real = (b.curve || []).length >= 5, pk = real ? this._peak(b) : 0, m = `${Math.floor(b.time_s / 60)}:${String(b.time_s % 60).padStart(2, '0')}`;
    const t = this._tg(b.mode), s = this._states(b), rng = (r, u = '') => r ? `${L.target} ${r[0]}–${r[1]}${u}` : '';
    const tile = (cls, label, val, st, sub) => `<div class="tile ${cls} ${st}"><span class="tl"><i class="dot"></i>${esc(label)}</span><b>${val}</b><small class="${st}">${st === 'in' ? ic('check', 'ok') : ''}${esc(sub)}</small></div>`, miss = (st, r, u = '') => st ? rng(r, u) : ''; // target line: range, coloured by inside/outside
    const fv = c.flow_value === 'avg' ? this._flow(b) : (pk || this._flow(b)), showAvg = pk && c.flow_value !== 'avg';
    return `<div class="tiles">${tile('r', L.ratio, b.ratio ? b.ratio.toFixed(1) : '--', s.ratio, (s.ratio === 'in' && b.dose_g ? '' : miss(s.ratio, t.ratio)) || (b.dose_g ? `${+b.dose_g.toFixed(1)} g ${L.dose}` : ''))}
      ${tile('f', L.flow, fv.toFixed(1), s.flow, (s.flow === 'in' && showAvg ? '' : miss(s.flow, t.flow)) || (showAvg ? `${L.avg} ${this._flow(b).toFixed(1)}` : ''))}
      ${tile('w', L.weight, b.yield_g.toFixed(1), s.yield, miss(s.yield, t.yield))}${tile('t', L.time, m, s.time, miss(s.time, t.time, ' s'))}</div>
      ${this._ok(b) ? `<div class="chip">${ic('check')} ${esc(L.inTarget)}</div>` : ''}`;
  }
  _notesRow(b) {
    const c = this._c, L = this._L, no = this._notes[b.id] || {}, txt = [no.bean, no.note].filter(Boolean).join(' · ');
    return `<div class="sec notes">${c.show_stars ? [1, 2, 3, 4, 5].map(k => `<button class="ghost ${(no.stars || 0) >= k ? 'on' : ''}" data-s="${k}" aria-label="${k} ${esc(L.stars)}">${ic('star')}</button>`).join('') : ''}${c.show_notes ? `<button class="ghost icon" data-notes aria-label="${esc(L.editNote)}" aria-expanded="${this._nopen}">${ic('edit')}</button>` : ''}${c.show_notes && txt && !this._nopen ? `<span class="nt">${esc(txt)}</span>` : ''}
      ${this._nopen ? `<div class="ed"><input data-f="bean" placeholder="${esc(L.bean)}" aria-label="${esc(L.bean)}" value="${esc(no.bean)}"><textarea data-f="note" rows="2" placeholder="${esc(L.note)}" aria-label="${esc(L.note)}">${esc(no.note)}</textarea></div>` : ''}</div>`;
  }
  _menuRows(l) { // the logbook: every brew, grouped by day, with notes and stars
    const L = this._L; let day = '', h = '';
    for (const b of l) {
      const d = this._disp(b), no = this._notes[b.id] || {};
      if (d.date !== day) { day = d.date; h += `<div class="day">${esc(d.date)}</div>`; }
      h += `<div class="row ${b.id === this._selId ? 'sel' : ''}" tabindex="0" role="option" aria-selected="${b.id === this._selId}" data-pick="${esc(b.id)}">
        <div style="min-width:0"><b>${b.yield_g.toFixed(1)} g in ${b.time_s} s · ${this._flow(b).toFixed(1)} g/s</b><small>${[d.time, no.bean || (b.mode === 'pourover' ? L.pourover : L.espresso), no.note].filter(Boolean).map(esc).join(' · ')}</small></div>
        <div class="r">${this._ok(b) ? ic('check', 'ok') + ' ' : ''}${b.ratio ? '1:' + b.ratio.toFixed(1) : ''}<div class="stars">${'★'.repeat(no.stars || 0)}</div></div></div>`;
    }
    return h;
  }
  _draw() {
    const r = this.shadowRoot; if (!r) return;
    const c = this._c, L = this._L, l = this._list(), selPos = Math.max(0, l.findIndex(b => b.id === this._sel)), sel = l[selPos]; this._selId = sel?.id;
    const keep = r.activeElement?.dataset?.f, v = keep && r.activeElement.value;
    const header = c.show_title || c.show_filter || sel ? `<header>${c.show_title ? `<h2>${esc(c.title ?? L.title)}</h2>` : ''}
        ${c.show_filter ? `<div class="seg">${['all', 'espresso', 'pourover'].map(k => `<button data-m="${k}" class="${this._mode === k ? 'on' : ''}">${esc(L[k])}</button>`).join('')}</div>` : ''}${sel ? this._nav(sel, selPos, l.length, l) : ''}</header>` : '';
    const g = sel && c.show_graph ? this._graph(sel) : '', h = sel && c.show_chart ? this._chart(l) : '';
    r.innerHTML = `<style>${CSS}</style><div class="card s-${c.surface === 'none' ? 'none' : 'card'} l-${c.layout === 'compact' || c.layout === 'wide' ? c.layout : 'auto'}">${header}${this._demo ? `<div class="hint" role="note">${esc(L.demo)}</div>` : ''}
      ${sel ? (c.show_tiles ? this._tiles(sel) : '') + (g || h ? `<div class="split ${g && h ? 'two' : ''}">${g}${h}</div>` : '') + (c.show_stars || c.show_notes ? this._notesRow(sel) : '') : `<div class="empty">${esc(L.empty)}</div>`}</div>`;
    if (keep) { const el = r.querySelector(`[data-f="${keep}"]`); if (el) { el.focus(); el.setSelectionRange?.(v.length, v.length); } }
  }
  getCardSize() { return 9; }
}

// ---- visual editor (dashboard -> card -> edit): a ha-form; colours are stored as hex strings, ranges as targets.<type>.<metric> = [min, max]
const HEX = /^#([0-9a-f]{6})$/i;
const toRgb = h => { const m = HEX.exec(h || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : undefined; };
const toHex = a => '#' + a.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
const COLOR_DEFAULTS = { accent: '#e8b54a', color_ratio: '#f59a57', color_flow: '#7ddb79', color_weight: '#a99cff', color_time: '#ec7ab5', color_in: '#7fdc8a', color_out: '#f0a06a', color_pill: '#735b5c', text_color: '#f4efe6', background: '#4a3d2c', background_end: '#2a2217' }; // what the picker shows while nothing is set
const COLORS = ['accent', 'color_ratio', 'color_flow', 'color_weight', 'color_time', 'color_in', 'color_out', 'color_pill', 'text_color', 'background', 'background_end'];
const METRICS = [['time', 'time', 0, 900, 1], ['yield', 'yield', 0, 700, 0.1], ['flow', 'flow', 0, 30, 0.1], ['ratio', 'ratio', 0, 40, 0.1]];
const sel = (o) => ({ select: { mode: 'dropdown', options: o } }), bool = { boolean: {} }, col = { color_rgb: {} };
const EDITOR_SCHEMA = [
  { name: 'entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'title', selector: { text: {} } },
  { type: 'grid', name: '', schema: [
    { name: 'language', selector: sel([{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]) },
    { name: 'theme', selector: sel([{ value: 'auto', label: 'Auto: glass look (dark, uses --mlc-* and host colours)' }, { value: 'dark', label: 'Dark: classic brown gradient' }, { value: 'ha', label: 'Home Assistant theme (light pages)' }]) }] },
  { type: 'grid', name: '', schema: [
    { name: 'surface', selector: sel([{ value: 'card', label: 'Card (own panel)' }, { value: 'none', label: 'None (no panel, for dialogs)' }]) },
    { name: 'layout', selector: sel([{ value: 'auto', label: 'Auto (wide from 720 px)' }, { value: 'compact', label: 'Compact (stacked)' }, { value: 'wide', label: 'Wide (graph and chart side by side)' }]) }] },
  { type: 'expandable', name: '', title: 'Colours', icon: 'mdi:palette', schema: COLORS.map(name => ({ name, selector: col })) },
  { type: 'expandable', name: '', title: 'Show', icon: 'mdi:eye', schema: ['show_title', 'show_filter', 'show_tiles', 'show_graph', 'show_chart', 'show_stars', 'show_notes', 'show_menu'].map(name => ({ name, selector: bool })) },
  { type: 'expandable', name: '', title: 'Behaviour and look', icon: 'mdi:tune', schema: [
    { name: 'default_mode', selector: sel([{ value: 'all', label: 'All' }, { value: 'espresso', label: 'Espresso' }, { value: 'pourover', label: 'Filter' }]) },
    { name: 'chart_metric', selector: sel([{ value: 'time', label: 'Time' }, { value: 'flow', label: 'Flow' }]) },
    { name: 'flow_value', selector: sel([{ value: 'auto', label: 'Auto (peak if known, else average)' }, { value: 'avg', label: 'Average' }, { value: 'peak', label: 'Peak' }]) },
    { name: 'chart_count', selector: { number: { min: 5, max: 100, mode: 'box' } } },
    { name: 'border_radius', selector: { number: { min: 0, max: 40, mode: 'slider' } } },
    { name: 'font_scale', selector: { number: { min: 70, max: 150, mode: 'slider', unit_of_measurement: '%' } } },
    { name: 'show_invalid', selector: bool }] },
  ...['espresso', 'pourover'].map(mode => ({ type: 'expandable', name: '', title: `Targets: ${mode === 'espresso' ? 'Espresso' : 'Filter'} (min / max, empty = no target)`, icon: 'mdi:target', schema: METRICS.flatMap(([m, , lo, hi, st]) => [
    { type: 'grid', name: '', schema: [{ name: `${mode}_${m}_min`, selector: { number: { min: lo, max: hi, step: st, mode: 'box' } } }, { name: `${mode}_${m}_max`, selector: { number: { min: lo, max: hi, step: st, mode: 'box' } } }] }]) })),
];
const EDITOR_LABELS = {
  entity: 'Other source (optional): entity with the attribute "brews". Empty = Mavo Lumicurve integration', title: 'Title', language: 'Language', theme: 'Theme', surface: 'Surface', layout: 'Layout', accent: 'Accent', color_ratio: 'Ratio colour', color_flow: 'Flow colour', color_weight: 'Weight colour', color_time: 'Time colour',
  color_in: 'On target colour', color_out: 'Off target colour', color_pill: 'Brew selector colour (default: neutral glass)', text_color: 'Text', background: 'Background', background_end: 'Background (gradient end)',
  show_title: 'Title', show_filter: 'Espresso/Filter buttons', show_tiles: 'Four tiles', show_graph: 'Weight graph', show_chart: 'History chart', show_stars: 'Stars', show_notes: 'Notes button', show_menu: 'Brew dropdown',
  default_mode: 'Start filter', chart_metric: 'Chart shows', flow_value: 'Flow tile shows', chart_count: 'Bars in the chart', border_radius: 'Corner radius (px)', font_scale: 'Text size', show_invalid: 'Show tare/noise events',
};
class MavoLumicurveCardEditor extends HTMLElement {
  setConfig(c) { this._config = c || {}; this._render(); }
  set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }
  _toData(c) {
    const d = { ...DEF, ...c };
    for (const k of COLORS) d[k] = toRgb(c[k]) || toRgb(COLOR_DEFAULTS[k]);
    for (const mode of ['espresso', 'pourover']) for (const [m] of METRICS) { const r = c.targets?.[mode]?.[m]; d[`${mode}_${m}_min`] = r?.[0]; d[`${mode}_${m}_max`] = r?.[1]; }
    return d;
  }
  _render() {
    if (!this._form) {
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', e => this._changed(e.detail.value));
      this.appendChild(this._form);
    }
    this._data = this._toData(this._config);
    Object.assign(this._form, { hass: this._hass, data: this._data, schema: EDITOR_SCHEMA, computeLabel: s => EDITOR_LABELS[s.name] || s.name.replace(/^(espresso|pourover)_/, '').replace('_', ' ') });
  }
  _changed(d) {
    const cfg = { ...this._config };
    for (const [k, v] of Object.entries(d)) {
      if (/^(espresso|pourover)_/.test(k) || JSON.stringify(v) === JSON.stringify(this._data[k])) continue; // targets and unchanged values are handled below
      if (COLORS.includes(k)) { if (Array.isArray(v)) cfg[k] = toHex(v); else delete cfg[k]; } else if (v === undefined || v === '' || v === DEF[k] && !(k in this._config)) delete cfg[k]; else cfg[k] = v;
    }
    for (const mode of ['espresso', 'pourover']) for (const [m] of METRICS) {
      const a = d[`${mode}_${m}_min`], b = d[`${mode}_${m}_max`];
      if (a === this._data[`${mode}_${m}_min`] && b === this._data[`${mode}_${m}_max`]) continue;
      const t = cfg.targets = { ...cfg.targets }; t[mode] = { ...t[mode] };
      if (a != null && b != null && a !== '' && b !== '') t[mode][m] = [+a, +b]; else delete t[mode][m];
      if (!Object.keys(t[mode]).length) delete t[mode];
      if (!Object.keys(t).length) delete cfg.targets;
    }
    this._config = cfg; this._data = this._toData(cfg);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: cfg }, bubbles: true, composed: true }));
  }
}
if (!customElements.get('mavo-lumicurve-card')) customElements.define('mavo-lumicurve-card', MavoLumicurveCard);
if (!customElements.get('mavo-lumicurve-card-editor')) customElements.define('mavo-lumicurve-card-editor', MavoLumicurveCardEditor);
(window.customCards = window.customCards || []).push({ type: 'mavo-lumicurve-card', name: 'Brew logbook (Mavo Lumicurve)', description: 'Last brew like on the scale, targets, flow graph, ratings and a brew dropdown. Fully customizable.', preview: false });
