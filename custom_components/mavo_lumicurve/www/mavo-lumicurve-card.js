/* mavo-lumicurve-card · v0.9.2 · Mavo Lumicurve brew logbook
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
  de: { title: 'Logbuch', all: 'Alle', espresso: 'Espresso', pourover: 'Filter', ratio: 'Verhältnis (x)', flow: 'Fluss (g/s)', weight: 'Gewicht (g)', time: 'Zeit', target: 'Ziel', inTarget: 'im Ziel', older: 'Älterer Bezug', newer: 'Neuerer Bezug', pick: 'Bezug auswählen', bean: 'Bohne', note: 'Notiz', editNote: 'Notiz bearbeiten', stars: 'Sterne', chartTime: 'Bezugszeit (s)', chartFlow: 'Durchfluss (g/s)', last: 'letzte', btnTime: 'Zeit', btnFlow: 'Fluss', earlier: 'früher', earlierDate: 'Frühere Sitzung', earlierFull: 'frühere Sitzung (Datum unbekannt)', estimated: 'Kurve geschätzt', empty: 'Noch keine Brühungen.', demo: 'Beispieldaten: Noch keine Waage eingerichtet. Einstellungen → Geräte & Dienste → Mavo Lumicurve hinzufügen (Waage vorher aufwecken).', dose: 'Kaffee', pickHint: 'Balken antippen zum Auswählen', graphAria: 'Gewichtsverlauf über {s} Sekunden', avg: 'Ø' },
  en: { title: 'Logbook', all: 'All', espresso: 'Espresso', pourover: 'Filter', ratio: 'Ratio (x)', flow: 'Flow (g/s)', weight: 'Weight (g)', time: 'Time', target: 'Target', inTarget: 'on target', older: 'Older brew', newer: 'Newer brew', pick: 'Select brew', bean: 'Beans', note: 'Note', editNote: 'Edit note', stars: 'stars', chartTime: 'Brew time (s)', chartFlow: 'Flow (g/s)', last: 'last', btnTime: 'Time', btnFlow: 'Flow', earlier: 'earlier', earlierDate: 'Earlier session', earlierFull: 'earlier session (date unknown)', estimated: 'curve estimated', empty: 'No brews yet.', demo: 'Example data: no scale set up yet. Settings → Devices & services → add Mavo Lumicurve (wake the scale first).', dose: 'coffee', pickHint: 'tap a bar to select', graphAria: 'Weight over {s} seconds', avg: 'Ø' },
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
const DEF = { language: 'de', theme: 'dark', chart_count: 30, chart_metric: 'time', default_mode: 'all', flow_value: 'auto', show_invalid: false, border_radius: 20, font_scale: 100,
  show_title: true, show_filter: true, show_tiles: true, show_graph: true, show_chart: true, show_stars: true, show_notes: true, show_menu: true, targets: {} };
const VARS = { // config key -> [css variable, theme variable name, built-in default]
  accent: ['--a', 'accent', '#e8b54a'], color_ratio: ['--c-r', 'ratio', '#f0883e'], color_flow: ['--c-f', 'flow', '#6fd26b'], color_weight: ['--c-w', 'weight', '#9b8cff'], color_time: ['--c-t', 'time', '#e266a8'],
  color_in: ['--in', 'in', '#7fdc8a'], color_out: ['--out', 'out', '#f0a06a'], color_pill: ['--pill', 'pill', 'color-mix(in srgb,var(--a) 20%,#7a5cff 20%)'],
};
const when = (ts, en) => { // "2026-11-19 13:53:56" -> parts; null when unknown
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)(:\d\d)?/.exec(ts || ''); if (!m) return null;
  const date = en ? `${m[2]}/${m[3]}/${m[1]}` : `${m[3]}.${m[2]}.${m[1]}`;
  return { short: en ? `${m[2]}/${m[3]}` : `${m[3]}.${m[2]}.`, date, time: m[4], full: `${date} ${m[4]}`, year: +m[1] };
};
const CSS = `
:host{display:block;color:var(--tx);font:calc(14px*var(--fsc))/1.35 system-ui,-apple-system,sans-serif;--mut:color-mix(in srgb,var(--tx) 62%,transparent);--s1:color-mix(in srgb,var(--tx) 8%,transparent);--s2:color-mix(in srgb,var(--tx) 13%,transparent);--bd:color-mix(in srgb,var(--tx) 18%,transparent);--bd2:color-mix(in srgb,var(--tx) 25%,transparent)}
*{box-sizing:border-box}
.card{container-type:inline-size;border-radius:var(--r);padding:14px;background:linear-gradient(155deg,var(--bg1),var(--bg2));border:1px solid var(--bd);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--tx) 20%,transparent),0 10px 30px rgba(0,0,0,.28)}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
header .logo{width:32px;height:32px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a)}
header h2{margin:0;font-size:1.07em;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seg{display:flex;gap:6px}header .seg button{min-height:34px;padding:0 11px;font-size:.93em}
button{font:inherit;color:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:999px;border:1px solid var(--bd);background:var(--s1);cursor:pointer;transition:transform .12s,background .15s}
button:hover{background:var(--s2)}button:active{transform:scale(.97)}
button.on{background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a);border-color:var(--a)}
button:focus-visible,.row:focus-visible{outline:2px solid var(--a);outline-offset:2px}
button.icon{min-width:40px;padding:0}button:disabled{opacity:.35;cursor:default}
.hero{display:block;padding:10px;border-radius:calc(var(--r) * .8);background:var(--hero);margin-bottom:12px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:var(--s1);font-size:.86em}.chip .ic{width:14px;height:14px}
.chip.ok{background:color-mix(in srgb,var(--in) 24%,transparent);color:var(--in)}
.lab{font-size:.79em;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-bottom:6px}
.pillrow{position:relative;display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:12px}
.pilltoggle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;min-height:40px;padding:5px 12px;border-radius:999px;background:var(--pill);font-size:.86em;font-weight:600;white-space:nowrap;border:1px solid var(--bd)}
.pilltoggle.static{cursor:default;justify-content:center}
.tiles{display:grid;grid-template-columns:1fr 1fr;margin-bottom:10px}
.tile{padding:8px 4px 6px;text-align:center}.tile.r,.tile.f{border-bottom:1px solid var(--bd2)}.tile.r,.tile.w{border-right:1px solid var(--bd2)}
.tile b{display:block;font-size:calc(clamp(24px,10cqw,34px)*var(--fsc));font-weight:700;letter-spacing:-.02em;line-height:1.1}.tile span{font-size:.86em}.tile small{display:block;font-size:.79em;color:var(--mut);min-height:13px}
.tile.r span{color:var(--c-r)}.tile.f span{color:var(--c-f)}.tile.w span{color:var(--c-w)}.tile.t span{color:var(--c-t)}
.tile small.in{color:var(--in)}.tile small.out{color:var(--out)}
.graph svg{width:100%;display:block}.graph text{fill:var(--mut);font-size:9px}
.graph .gr{stroke:var(--bd2);stroke-width:1;stroke-dasharray:2 3}.graph .area{fill:var(--a);opacity:.1}.graph .end{stroke:var(--mut);stroke-width:1;stroke-dasharray:3 3}
.graph .mk{fill:var(--tx)}.graph .wl{fill:none;stroke:var(--a);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.graph .wl.dash{stroke-dasharray:5 4;opacity:.85}.graph .wd{fill:var(--a)}
.chart{margin:4px 0 14px}.chart svg{width:100%;height:auto;display:block}.chart text{fill:var(--mut);font-size:6.5px}.chart .vl{fill:color-mix(in srgb,var(--tx) 85%,transparent)}.chart .vl.cur{fill:var(--a);font-weight:700}
.chart rect.b{fill:var(--a);opacity:.85;cursor:pointer}.chart rect.b.out{opacity:.3}.chart rect.b.cur{stroke:var(--tx);stroke-width:1}.chart rect.band{fill:var(--in);opacity:.14}.chart .ax{stroke:var(--bd2);stroke-width:1}
.row{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:10px;border-radius:14px;cursor:pointer}
.row:hover{background:var(--s1)}.row.sel{background:color-mix(in srgb,var(--a) 16%,transparent)}
.row .t{width:52px;height:44px;border-radius:14px;display:grid;place-items:center;text-align:center;background:var(--s1);font-size:.79em;line-height:1.25;font-weight:600}
.row .t.ok{background:color-mix(in srgb,var(--in) 24%,transparent);color:var(--in)}
.row b{font-weight:600}.row small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .r{text-align:right;font-size:.86em;color:var(--mut)}.stars{color:var(--a);letter-spacing:1px}
.menu{position:absolute;z-index:5;left:0;right:0;top:46px;max-height:340px;overflow:auto;padding:6px;border-radius:18px;background:linear-gradient(160deg,var(--bg1),var(--bg2));border:1px solid var(--bd);box-shadow:0 16px 40px rgba(0,0,0,.5),inset 0 1px 0 color-mix(in srgb,var(--tx) 20%,transparent)}
.day{margin:12px 0 2px 10px;font-size:.79em;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.notes{margin:6px 0 0;display:grid;gap:8px}.notes .st{display:flex;gap:6px;align-items:center}.notes .st button{min-width:40px;padding:0}.notes .st button.on .ic{fill:var(--a)}.notes .st .icon{margin-left:auto}.mut{font-size:.86em;color:var(--mut)}
input,textarea{font:inherit;color:inherit;padding:9px 12px;border-radius:12px;border:1px solid var(--bd);background:var(--s1)}
input:focus-visible,textarea:focus-visible{outline:2px solid var(--a);outline-offset:1px}
.hint{margin:0 0 10px;padding:8px 12px;border-radius:10px;font-size:.8em;background:color-mix(in srgb,var(--a) 18%,transparent)}
.empty{opacity:.7;padding:20px 0;text-align:center}
@media (max-width:360px){header .logo{display:none}}
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
  _applyVars() { // explicit config wins; otherwise the theme variable --mlc-<name>; otherwise the built-in default
    const c = this._c, ha = c.theme === 'ha', set = (k, v) => this.style.setProperty(k, v);
    const pick = (key, name, def) => (c[key] !== undefined && c[key] !== '' ? c[key] : `var(--mlc-${name}, ${def})`);
    for (const [key, [v, name, def]] of Object.entries(VARS)) set(v, pick(key, name, def));
    const haBg = 'var(--ha-card-background, var(--card-background-color, #2a2217))';
    set('--tx', ha ? 'var(--primary-text-color, #f4efe6)' : pick('text_color', 'text', '#f4efe6'));
    set('--bg1', ha ? haBg : pick('background', 'bg', '#4a3d2c'));
    set('--bg2', ha ? haBg : (c.background && c.background_end === undefined ? c.background : pick('background_end', 'bg2', '#2a2217')));
    set('--hero', ha ? 'color-mix(in srgb, var(--tx) 5%, transparent)' : 'rgba(0,0,0,.2)');
    set('--r', `${+c.border_radius}px`); set('--fsc', String((+c.font_scale || 100) / 100));
  }
  _wire(r) { // ShadowRoot has no onclick property, so use listeners (registered once)
    r.addEventListener('click', e => {
      const t = e.target.closest('[data-nav],[data-notes],[data-menu],[data-pick],[data-m],[data-c],[data-s]');
      if (!t) { if (this._menu && !e.target.closest('.menu')) { this._menu = false; this._draw(); } return; }
      if (t.disabled) return;
      if (t.dataset.nav) { const l = this._list(), i = Math.max(0, l.findIndex(b => b.id === this._selId)) + +t.dataset.nav; this._sel = l[Math.min(Math.max(i, 0), l.length - 1)]?.id; this._nopen = false; }
      else if ('menu' in t.dataset) this._menu = !this._menu;
      else if ('notes' in t.dataset) this._nopen = !this._nopen;
      else if (t.dataset.pick) { this._sel = t.dataset.pick; this._menu = false; this._nopen = false; }
      else if (t.dataset.c) this._c.chart_metric = t.dataset.c;
      else if (t.dataset.m) { this._mode = t.dataset.m; this._sel = null; this._menu = false; }
      else if (t.dataset.s) { const o = this._notes[this._selId] ||= {}; o.stars = o.stars === +t.dataset.s ? 0 : +t.dataset.s; this._save(); }
      this._draw();
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
  _disp(b) { const w = when(b.real_ts, this._en), L = this._L; return w || { short: L.earlier, date: L.earlierDate, time: '', full: L.earlierFull, year: 0 }; }
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
    const max = Math.min(Math.max(fl ? 1 : 10, vs[vs.length - 1], tt ? tt[1] : 0), cap), X0 = 22, w = (300 - X0) / d.length, y = v => 64 - 50 * Math.min(v, max) / max;
    const fmt = v => fl ? v.toFixed(1) : String(v), step = Math.ceil((fmt(max).length * 4 + 1) / w); // label every n-th bar so numbers never overlap
    return `<div class="chart"><div class="lab" style="display:flex;justify-content:space-between;align-items:center">${fl ? L.chartFlow : L.chartTime} · ${L.last} ${d.length}${mode === 'pourover' ? ' ' + L.pourover : ''}<span class="seg">${[['time', L.btnTime], ['flow', L.btnFlow]].map(([k, t]) => `<button data-c="${k}" class="${(fl ? 'flow' : 'time') === k ? 'on' : ''}" style="min-height:32px;padding:0 10px">${esc(t)}</button>`).join('')}</span></div><svg viewBox="0 0 300 72" role="img" aria-label="${fl ? L.chartFlow : L.chartTime}; ${L.pickHint}">
      ${tt ? `<rect class="band" x="${X0}" y="${y(tt[1])}" width="${300 - X0}" height="${Math.max(0, y(tt[0]) - y(tt[1]))}" rx="3"/>` : ''}
      <text x="${X0 - 3}" y="${y(max) + 3}" text-anchor="end">${fmt(max)}</text><text x="${X0 - 3}" y="67" text-anchor="end">0</text><line class="ax" x1="${X0}" x2="300" y1="64.5" y2="64.5"/>
      ${d.map((b, i) => `<rect class="b ${this._st(val(b), tt) === 'out' ? 'out' : ''} ${b.id === this._selId ? 'cur' : ''}" data-pick="${esc(b.id)}" x="${X0 + i * w + 1}" y="${y(val(b))}" width="${Math.max(w - 2, 1)}" height="${Math.max(0, 64 - y(val(b)))}" rx="2"><title>${esc(this._disp(b).full)}: ${fmt(val(b))}</title></rect>
        ${(d.length - 1 - i) % step === 0 ? `<text class="vl ${b.id === this._selId ? 'cur' : ''}" x="${X0 + i * w + w / 2}" y="${y(val(b)) - 2}" text-anchor="middle">${fmt(val(b))}</text>` : ''}`).join('')}</svg></div>`;
  }
  _nice(v) { return [20, 40, 70, 100, 140, 200, 300, 400, 600].find(s => s >= v) || Math.ceil(v / 100) * 100; }
  _peak(b) { // peak flow between samples that are >= 3 s apart (same idea as the scale's number, to be confirmed)
    const p = b.curve || []; let best = 0, j = 0;
    for (let i = 1; i < p.length; i++) { while (p[i][0] - p[j][0] > 3 && j < i - 1) j++; const dt = p[i][0] - p[j][0]; if (dt >= 1) best = Math.max(best, (p[i][1] - p[j][1]) / dt); }
    return best;
  }
  _graph(b) { // look of the scale's own display: (g) axis, 4 s ticks, dotted grid, end marker
    const pts = b.curve || [[0, 0], [b.time_s, b.yield_g]], T = b.time_s, real = pts.length >= 5;
    const ym = this._nice(b.yield_g * 1.05), step = T <= 22 ? 4 : T <= 70 ? 10 : 30, xm = Math.max(20, Math.ceil(T * 1.1 / step) * step);
    const L = 26, R = 292, Tp = 18, B = 90, x = t => L + (R - L) * t / xm, y = g => B - (B - Tp) * g / ym;
    const xt = []; for (let t = 0; t <= xm; t += step) xt.push(t);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
    return `<div class="graph"><svg viewBox="0 0 300 112" role="img" aria-label="${esc(this._L.graphAria.replace('{s}', T))}">
      <text x="2" y="9">(g)</text><text x="298" y="9" text-anchor="end">(s)</text>${real ? '' : `<text x="150" y="9" text-anchor="middle" opacity=".6">${esc(this._L.estimated)}</text>`}
      ${[0, .5, 1].map(f => `<line class="gr" x1="${L}" x2="${R}" y1="${y(ym * f)}" y2="${y(ym * f)}"/><text x="${L - 4}" y="${y(ym * f) + 3}" text-anchor="end">${Math.round(ym * f)}</text>`).join('')}
      ${xt.map(t => `<text x="${x(t)}" y="${B + 12}" text-anchor="middle">${t}</text>`).join('')}
      <path class="area" d="${path}L${x(T)} ${B}L${L} ${B}Z"/>
      <line class="end" x1="${x(T)}" x2="${x(T)}" y1="${Tp - 4}" y2="${B}"/><path class="mk" d="M${x(T) - 4} ${Tp - 10}L${x(T) + 4} ${Tp - 10}L${x(T)} ${Tp - 3}Z"/>
      <path class="wl ${real ? '' : 'dash'}" d="${path}"/>${real ? pts.slice(1, -1).map(p => `<circle class="wd" cx="${x(p[0])}" cy="${y(p[1])}" r="2.4"/>`).join('') : ''}</svg></div>`;
  }
  _hero(b, pos, n, l) {
    const c = this._c, L = this._L, real = (b.curve || []).length >= 5, pk = real ? this._peak(b) : 0, m = `${Math.floor(b.time_s / 60)}:${String(b.time_s % 60).padStart(2, '0')}`;
    const t = this._tg(b.mode), s = this._states(b), rng = (r, u = '') => r ? `${L.target} ${r[0]}–${r[1]}${u}` : '';
    const tile = (cls, label, val, st, sub) => `<div class="tile ${cls} ${st}"><b>${val}</b><span>${esc(label)}</span><small class="${st}">${esc(sub)}</small></div>`, miss = (st, r, u = '') => st === 'out' ? rng(r, u) : '';
    const no = this._notes[b.id] || {}, d = this._disp(b);
    const fv = c.flow_value === 'avg' ? this._flow(b) : c.flow_value === 'peak' ? (pk || this._flow(b)) : (pk || this._flow(b)), showAvg = pk && c.flow_value !== 'avg';
    const pill = `${n - pos}/${n} · ${esc(d.short)} ${esc(d.time)}`;
    return `<div class="hero"><div class="pillrow"><button class="icon" data-nav="1" aria-label="${esc(L.older)}" ${pos >= n - 1 ? 'disabled' : ''}>${ic('left')}</button>
      ${c.show_menu ? `<button class="pilltoggle" data-menu aria-haspopup="listbox" aria-expanded="${this._menu}">${pill} ${ic(this._menu ? 'up' : 'down')}</button>` : `<div class="pilltoggle static">${pill}</div>`}
      <button class="icon" data-nav="-1" aria-label="${esc(L.newer)}" ${pos <= 0 ? 'disabled' : ''}>${ic('right')}</button>
      ${this._menu ? `<div class="menu" role="listbox" aria-label="${esc(L.pick)}">${this._menuRows(l)}</div>` : ''}</div>
      ${c.show_tiles ? `<div class="tiles">${tile('r', L.ratio, b.ratio ? b.ratio.toFixed(1) : '--', s.ratio, miss(s.ratio, t.ratio) || (b.dose_g ? `${+b.dose_g.toFixed(1)} g ${L.dose}` : ''))}
      ${tile('f', L.flow, fv.toFixed(1), s.flow, miss(s.flow, t.flow) || (showAvg ? `${L.avg} ${this._flow(b).toFixed(1)}` : ''))}
      ${tile('w', L.weight, b.yield_g.toFixed(1), s.yield, miss(s.yield, t.yield))}${tile('t', L.time, m, s.time, miss(s.time, t.time, ' s'))}</div>
      ${this._ok(b) ? `<div class="chip ok" style="margin:0 0 8px">${ic('check')} ${esc(L.inTarget)}</div>` : ''}` : ''}
      ${c.show_graph ? this._graph(b) : ''}
      ${c.show_stars || c.show_notes ? `<div class="notes"><div class="st">${c.show_stars ? [1, 2, 3, 4, 5].map(k => `<button data-s="${k}" class="${(no.stars || 0) >= k ? 'on' : ''}" aria-label="${k} ${esc(L.stars)}">${ic('star')}</button>`).join('') : ''}${c.show_notes ? `<button class="icon" data-notes aria-label="${esc(L.editNote)}" aria-expanded="${this._nopen}">${ic('edit')}</button>` : ''}</div>
      ${this._nopen ? `<input data-f="bean" placeholder="${esc(L.bean)}" aria-label="${esc(L.bean)}" value="${esc(no.bean)}"><textarea data-f="note" rows="2" placeholder="${esc(L.note)}" aria-label="${esc(L.note)}">${esc(no.note)}</textarea>` : (no.bean || no.note) ? `<div class="mut">${esc([no.bean, no.note].filter(Boolean).join(' · '))}</div>` : ''}</div>` : ''}</div>`;
  }
  _menuRows(l) { // the logbook: every brew, grouped by day, with notes and stars
    const L = this._L; let day = '', h = '';
    for (const b of l) {
      const d = this._disp(b), no = this._notes[b.id] || {};
      if (d.date !== day) { day = d.date; h += `<div class="day">${esc(d.date)}</div>`; }
      h += `<div class="row ${b.id === this._selId ? 'sel' : ''}" tabindex="0" role="option" aria-selected="${b.id === this._selId}" data-pick="${esc(b.id)}"><div class="t ${this._ok(b) ? 'ok' : ''}"><span>${esc(d.short)}<br>${esc(d.time)}</span></div>
        <div style="min-width:0"><b>${b.yield_g.toFixed(1)} g</b> in ${b.time_s} s · ${this._flow(b).toFixed(1)} g/s<small>${esc(no.bean || (b.mode === 'pourover' ? L.pourover : L.espresso))}${no.note ? ' · ' + esc(no.note) : ''}</small></div>
        <div class="r">${b.ratio ? '1:' + b.ratio.toFixed(1) : ''}<div class="stars">${'★'.repeat(no.stars || 0)}</div></div></div>`;
    }
    return h;
  }
  _draw() {
    const r = this.shadowRoot; if (!r) return;
    const c = this._c, L = this._L, l = this._list(), selPos = Math.max(0, l.findIndex(b => b.id === this._sel)), sel = l[selPos]; this._selId = sel?.id;
    const keep = r.activeElement?.dataset?.f, v = keep && r.activeElement.value;
    const header = c.show_title || c.show_filter ? `<header>${c.show_title ? `<div class="logo">${ic('cup')}</div><h2>${esc(c.title ?? L.title)}</h2>` : '<h2></h2>'}
        ${c.show_filter ? `<div class="seg">${['all', 'espresso', 'pourover'].map(k => `<button data-m="${k}" class="${this._mode === k ? 'on' : ''}">${esc(L[k])}</button>`).join('')}</div>` : ''}</header>` : '';
    r.innerHTML = `<style>${CSS}</style><div class="card">${header}${this._demo ? `<div class="hint" role="note">${esc(L.demo)}</div>` : ''}
      ${sel ? this._hero(sel, selPos, l.length, l) + (c.show_chart ? this._chart(l) : '') : `<div class="empty">${esc(L.empty)}</div>`}</div>`;
    if (keep) { const el = r.querySelector(`[data-f="${keep}"]`); if (el) { el.focus(); el.setSelectionRange?.(v.length, v.length); } }
  }
  getCardSize() { return 9; }
}

// ---- visual editor (dashboard -> card -> edit): a ha-form; colours are stored as hex strings, ranges as targets.<type>.<metric> = [min, max]
const HEX = /^#([0-9a-f]{6})$/i;
const toRgb = h => { const m = HEX.exec(h || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : undefined; };
const toHex = a => '#' + a.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
const COLORS = ['accent', 'color_ratio', 'color_flow', 'color_weight', 'color_time', 'color_in', 'color_out', 'color_pill', 'text_color', 'background', 'background_end'];
const METRICS = [['time', 'time', 0, 900, 1], ['yield', 'yield', 0, 700, 0.1], ['flow', 'flow', 0, 30, 0.1], ['ratio', 'ratio', 0, 40, 0.1]];
const sel = (o) => ({ select: { mode: 'dropdown', options: o } }), bool = { boolean: {} }, col = { color_rgb: {} };
const EDITOR_SCHEMA = [
  { name: 'entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'title', selector: { text: {} } },
  { type: 'grid', name: '', schema: [
    { name: 'language', selector: sel([{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English' }]) },
    { name: 'theme', selector: sel([{ value: 'dark', label: 'Dark (own colours)' }, { value: 'ha', label: 'Home Assistant theme' }]) }] },
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
  entity: 'Entity with the brews (attribute "brews")', title: 'Title', language: 'Language', theme: 'Theme', accent: 'Accent', color_ratio: 'Ratio colour', color_flow: 'Flow colour', color_weight: 'Weight colour', color_time: 'Time colour',
  color_in: 'On target colour', color_out: 'Off target colour', color_pill: 'Brew selector colour', text_color: 'Text', background: 'Background', background_end: 'Background (gradient end)',
  show_title: 'Title', show_filter: 'Espresso/Filter buttons', show_tiles: 'Four tiles', show_graph: 'Weight graph', show_chart: 'History chart', show_stars: 'Stars', show_notes: 'Notes button', show_menu: 'Brew dropdown',
  default_mode: 'Start filter', chart_metric: 'Chart shows', flow_value: 'Flow tile shows', chart_count: 'Bars in the chart', border_radius: 'Corner radius (px)', font_scale: 'Text size', show_invalid: 'Show tare/noise events',
};
class MavoLumicurveCardEditor extends HTMLElement {
  setConfig(c) { this._config = c || {}; this._render(); }
  set hass(h) { this._hass = h; if (this._form) this._form.hass = h; }
  _toData(c) {
    const d = { ...DEF, ...c };
    for (const k of COLORS) d[k] = toRgb(c[k]);
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
