/* nofree-brew-card · prototype v0.2 · Mavo Lumicurve brew logbook
   config: { type: 'custom:nofree-brew-card', entity: 'sensor.mavo_brews' }  (attribute `brews` = list from parse.py)
           or { brews_url: 'brews.json' } for the local test page.  All options: README.
   Notes (bean, rating, text) live in HA user data (frontend/set_user_data), localStorage as fallback. */
const KEY = 'nofree_brew_notes';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const IC = { // 24x24 stroke icons
  cup: '<path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M12 3v2"/>',
  down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M6 15l6-6 6 6"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', edit: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 7l3 3"/>',
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const when = ts => { // "2022-03-18 04:40:28" -> parts (the scale's own clock); "? 03:22:14" = date unknown
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)(:\d\d)?/.exec(ts); const hm = (ts.split(' ')[1] || '').slice(0, 5);
  return m ? { short: `${m[3]}.${m[2]}.`, date: `${m[3]}.${m[2]}.${m[1]}`, time: m[4], full: `${m[3]}.${m[2]}.${m[1]} ${m[4]}`, year: +m[1] } : { short: '?', date: 'Datum unbekannt', time: hm, full: 'Datum unbekannt ' + hm, year: 0 };
};
const disp = b => b.real_ts ? when(b.real_ts) : { short: 'früher', date: 'Frühere Sitzung', time: '', full: 'frühere Sitzung (Datum unbekannt)', year: 0 };
const CSS = a => `
:host{--a:${a};--mut:rgba(244,239,230,.62);display:block;color:var(--primary-text-color,#f4efe6);font:14px/1.35 system-ui,-apple-system,sans-serif}
*{box-sizing:border-box}
.card{container-type:inline-size;border-radius:20px;padding:14px;background:linear-gradient(155deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 30px rgba(0,0,0,.28)}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
header .logo{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a)}
header h2{margin:0;font-size:15px;font-weight:650;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}header .seg button{min-height:34px;padding:0 11px;font-size:13px}header .logo{width:32px;height:32px}header h2 small{display:block;font-weight:400;font-size:12px;color:var(--mut)}
.seg{display:flex;gap:6px}
button{font:inherit;color:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);cursor:pointer;transition:transform .12s,background .15s}
button:hover{background:rgba(255,255,255,.12)}button:active{transform:scale(.97)}
button.on{background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a);border-color:var(--a)}
button:focus-visible,.row:focus-visible{outline:2px solid var(--a);outline-offset:2px}
  .hero{display:block;padding:10px;border-radius:16px;background:rgba(0,0,0,.2);margin-bottom:12px}
.hero .big{font-size:44px;font-weight:700;letter-spacing:-.02em;line-height:1}.hero .big small{font-size:16px;font-weight:500;color:var(--mut);margin-left:4px}
.hero .sub{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.09);font-size:12px}.chip .ic{width:14px;height:14px}
.chip.warn{background:rgba(230,120,90,.22);color:#f0a08c}.chip.ok{background:color-mix(in srgb,var(--a) 24%,transparent);color:var(--a)}
.lab{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-bottom:6px}
.ring{position:relative;width:104px;height:104px}.ring svg{width:104px;height:104px;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-width:9;stroke-linecap:round}.ring .bg{stroke:rgba(255,255,255,.1)}.ring .fg{stroke:var(--a);transition:stroke-dashoffset .6s}
.ring div{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-size:22px;font-weight:700}.ring small{display:block;font-size:11px;font-weight:400;color:var(--mut)}
.chart{margin:4px 0 14px}.chart svg{width:100%;height:auto;display:block}.chart text{fill:var(--mut);font-size:6.5px}.chart .vl{fill:rgba(244,239,230,.85)}.chart .vl.cur{fill:var(--a);font-weight:700}.chart rect.b{cursor:pointer}.chart rect.b.cur{stroke:#fff;stroke-width:1}
.chart rect.b{fill:var(--a);opacity:.85}.chart rect.b.out{opacity:.3}.chart rect.band{fill:var(--a);opacity:.1}
.row{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:10px;border-radius:14px;cursor:pointer}
.row:hover{background:rgba(255,255,255,.07)}
.row .t{width:52px;height:44px;border-radius:14px;display:grid;place-items:center;text-align:center;background:rgba(255,255,255,.08);font-size:11px;line-height:1.25;font-weight:600}
.row .t.ok{background:color-mix(in srgb,var(--a) 24%,transparent);color:var(--a)}
.row b{font-weight:600}.row small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .r{text-align:right;font-size:12px;color:var(--mut)}.stars{color:var(--a);letter-spacing:1px}
.bar{height:3px;border-radius:2px;background:rgba(255,255,255,.1);margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--a);border-radius:2px}
.pillrow{display:flex;justify-content:center;align-items:center;gap:8px;margin-bottom:12px}
.pill{padding:5px 14px;border-radius:999px;background:color-mix(in srgb,var(--a) 20%,#7a5cff 20%);font-size:12px;font-weight:600;white-space:nowrap}
button.icon{min-width:40px;padding:0}button:disabled{opacity:.35;cursor:default}
.tiles{display:grid;grid-template-columns:1fr 1fr;border-radius:16px;margin-bottom:10px}
.tile{padding:8px 4px 6px;text-align:center}.tile.r,.tile.f{border-bottom:1px solid rgba(255,255,255,.25)}.tile.r,.tile.w{border-right:1px solid rgba(255,255,255,.25)}
.tile b{display:block;font-size:clamp(24px,10cqw,34px);font-weight:700;letter-spacing:-.02em;line-height:1.1}.tile span{font-size:12px}.tile small{display:block;font-size:11px;color:var(--mut);min-height:13px}
.tile.r span{color:#f0883e}.tile.f span{color:#6fd26b}.tile.w span{color:#9b8cff}.tile.t span{color:#e266a8}
.graph svg{width:100%;display:block}.graph text{fill:var(--mut);font-size:9px}.graph .cap{fill:#9b8cff;font-size:10px}
.graph .gr{stroke:rgba(255,255,255,.25);stroke-width:1;stroke-dasharray:2 3}.graph .area{fill:var(--a);opacity:.1}.graph .end{stroke:rgba(255,255,255,.55);stroke-width:1;stroke-dasharray:3 3}
.graph .mk{fill:#fff}.graph .wl{fill:none;stroke:var(--a);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.graph .wl.dash{stroke-dasharray:5 4;opacity:.85}.graph .wd{fill:var(--a)}.graph .note{font-size:11px;color:var(--mut)}
.row.sel{background:color-mix(in srgb,var(--a) 16%,transparent)}
.pilltoggle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;min-height:40px;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--a) 20%,#7a5cff 20%);font-size:12px;font-weight:600;white-space:nowrap;border:1px solid rgba(255,255,255,.2)}
.pillrow{position:relative}
.menu{position:absolute;z-index:5;left:0;right:0;top:46px;max-height:340px;overflow:auto;padding:6px;border-radius:18px;background:linear-gradient(160deg,rgba(60,48,34,.96),rgba(30,24,17,.97));border:1px solid rgba(255,255,255,.2);box-shadow:0 16px 40px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(18px) saturate(1.25)}
.tile small.in{color:#7fdc8a}.tile small.out{color:#f0a06a}.tile.in b{color:#fff}
.notes{margin:6px 0 0;display:grid;gap:8px}.notes .st{display:flex;gap:6px;align-items:center}.notes .st button{min-width:40px;padding:0}.notes .st button.on .ic{fill:var(--a)}.notes .st .icon{margin-left:auto}.mut{font-size:12px;color:var(--mut)}
.curve{margin:0 0 12px}.edit .curve{margin:0}.curve svg{width:100%;display:block}.curve text{fill:var(--mut);font-size:9px}
.curve .wl{fill:none;stroke:var(--a);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.curve .wl.dash{stroke-dasharray:5 4;opacity:.7}
.curve .wd{fill:var(--a)}.curve .fb{fill:var(--a);opacity:.28}.curve .ax{stroke:rgba(255,255,255,.2);stroke-width:1}.curve .note{font-size:11px;color:var(--mut)}
.day{margin:12px 0 2px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.edit{padding:12px;margin:2px 0 8px;border-radius:14px;background:rgba(0,0,0,.22);display:grid;gap:8px}
input,textarea{font:inherit;color:inherit;padding:9px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07)}
input:focus-visible,textarea:focus-visible{outline:2px solid var(--a);outline-offset:1px}
.edit .st{display:flex;gap:6px}.edit .st button{min-width:40px;padding:0}.edit .st button.on .ic{fill:var(--a)}
.empty{opacity:.7;padding:20px 0;text-align:center}
@media (max-width:360px){header .logo{display:none}}

@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

class NofreeBrewCard extends HTMLElement {
  setConfig(c) {
    // targets: { espresso: {time:[min,max], yield:[..], flow:[..], ratio:[..]}, pourover: {...} }; flat target_time/yield/flow/ratio apply to both modes
    this._c = { chart_count: 30, chart_metric: 'time', show_invalid: false, targets: {}, ...c };
    this._mode = 'all'; this._sel = null; this._menu = false; this._nopen = false; this._brews = null;
    if (!this.shadowRoot) { const r = this.attachShadow({ mode: 'open' }); this._wire(r); }
    this._notes = this._load(); this._fetch();
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
  set hass(h) { this._h = h; if (this._c?.entity) { const b = h.states[this._c.entity]?.attributes?.brews; if (b !== this._src) { this._src = b; this._brews = b || []; this._draw(); } } }
  async _fetch() { if (!this._c.brews_url) return; try { this._brews = await (await fetch(this._c.brews_url)).json(); } catch { this._brews = []; } this._draw(); }
  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  async _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this._notes)); } catch {}
    try { await this._h?.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._notes }); } catch {}
  }
  _list() { // newest first; file order of the scale log = chronological
    return (this._brews || []).map((b, i) => ({ ...b, id: b.ts + '|' + b.time_s + '|' + b.yield_g, i }))
      .filter(b => (this._c.show_invalid || b.valid !== false) && (this._mode === 'all' || b.mode === this._mode))
      .sort((a, b) => (b.seq ?? b.i) - (a.seq ?? a.i));
  }
  _flow(b) { return b.flow_gs ?? (b.time_s ? b.yield_g / b.time_s : 0); }
  _tg(mode) { const k = this._c; return { time: k.target_time, yield: k.target_yield, flow: k.target_flow, ratio: k.target_ratio, ...(k.targets?.[mode] || {}) }; }
  _st(v, r) { return !r || v == null ? '' : v >= r[0] && v <= r[1] ? 'in' : 'out'; } // 'in' | 'out' | '' (no target)
  _states(b) { const t = this._tg(b.mode); return { time: this._st(b.time_s, t.time), yield: this._st(b.yield_g, t.yield), flow: this._st(this._flow(b), t.flow), ratio: this._st(b.ratio, t.ratio) }; }
  _ok(b) { const s = Object.values(this._states(b)); return s.includes('in') && !s.includes('out'); }
  _chart(list) {
    const fl = this._c.chart_metric === 'flow', val = b => fl ? this._flow(b) : b.time_s, mode = this._mode === 'pourover' ? 'pourover' : 'espresso', tt = this._tg(mode)[fl ? 'flow' : 'time'];
    const d = list.filter(b => b.mode === mode).slice(0, this._c.chart_count).reverse(); /* long pours would flatten the espresso bars */
    if (!d.length) return '';
    const vs = d.map(val).sort((p, q) => p - q), cap = Math.max(vs[Math.floor(0.9 * (vs.length - 1))] * 1.2, tt ? tt[1] * 1.2 : 0, fl ? 1 : 10); // an outlier must not flatten all other bars
    const max = Math.min(Math.max(fl ? 1 : 10, vs[vs.length - 1], tt ? tt[1] : 0), cap), X0 = 22, w = (300 - X0) / d.length, y = v => 64 - 50 * Math.min(v, max) / max;
    const fmt = v => fl ? v.toFixed(1) : String(v), step = Math.ceil((fmt(max).length * 4 + 1) / w); // label every n-th bar so numbers never overlap
        return `<div class="chart"><div class="lab" style="display:flex;justify-content:space-between;align-items:center">${fl ? 'Durchfluss (g/s)' : 'Bezugszeit (s)'} · letzte ${d.length}${mode === 'pourover' ? ' Filter' : ''}<span class="seg">${[['time', 'Zeit'], ['flow', 'Fluss']].map(([k, t]) => `<button data-c="${k}" class="${(fl ? 'flow' : 'time') === k ? 'on' : ''}" style="min-height:32px;padding:0 10px">${t}</button>`).join('')}</span></div><svg viewBox="0 0 300 72" role="img" aria-label="${fl ? 'Durchfluss' : 'Bezugszeit'} der letzten ${d.length} Brühungen; Balken antippen zum Auswählen">
      ${tt ? `<rect class="band" x="${X0}" y="${y(tt[1])}" width="${300 - X0}" height="${y(tt[0]) - y(tt[1])}" rx="3"/>` : ''}
      <text class="ya" x="${X0 - 3}" y="${y(max) + 3}" text-anchor="end">${fmt(max)}</text><text class="ya" x="${X0 - 3}" y="67" text-anchor="end">0</text><line class="ax" x1="${X0}" x2="300" y1="64.5" y2="64.5"/>
      ${d.map((b, i) => `<rect class="b ${this._st(val(b), tt) === 'out' ? 'out' : ''} ${b.id === this._selId ? 'cur' : ''}" data-pick="${esc(b.id)}" x="${X0 + i * w + 1}" y="${y(val(b))}" width="${Math.max(w - 2, 1)}" height="${64 - y(val(b))}" rx="2"><title>${esc(disp(b).full)}: ${fmt(val(b))}</title></rect>
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
    return `<div class="graph"><svg viewBox="0 0 300 112" role="img" aria-label="Gewichtsverlauf über ${T} Sekunden">
      <text x="2" y="9">(g)</text><text x="298" y="9" text-anchor="end">${real ? '(s)' : '(s) · geschätzt'}</text>
      ${[0, .5, 1].map(f => `<line class="gr" x1="${L}" x2="${R}" y1="${y(ym * f)}" y2="${y(ym * f)}"/><text x="${L - 4}" y="${y(ym * f) + 3}" text-anchor="end">${Math.round(ym * f)}</text>`).join('')}
      ${xt.map(t => `<text x="${x(t)}" y="${B + 12}" text-anchor="middle">${t}</text>`).join('')}
      <path class="area" d="${path}L${x(T)} ${B}L${L} ${B}Z"/>
      <line class="end" x1="${x(T)}" x2="${x(T)}" y1="${Tp - 4}" y2="${B}"/><path class="mk" d="M${x(T) - 4} ${Tp - 10}L${x(T) + 4} ${Tp - 10}L${x(T)} ${Tp - 3}Z"/>
      <path class="wl ${real ? '' : 'dash'}" d="${path}"/>${real ? pts.slice(1, -1).map(p => `<circle class="wd" cx="${x(p[0])}" cy="${y(p[1])}" r="2.4"/>`).join('') : ''}</svg></div>`;
  }
  _hero(b, pos, n, l) {
    const real = (b.curve || []).length >= 5, pk = real ? this._peak(b) : 0, m = `${Math.floor(b.time_s / 60)}:${String(b.time_s % 60).padStart(2, '0')}`;
    const t = this._tg(b.mode), s = this._states(b), rng = (r, u = '') => r ? `Ziel ${r[0]}–${r[1]}${u}` : '';
    const tile = (cls, label, val, st, sub) => `<div class="tile ${cls} ${st}"><b>${val}</b><span>${label}</span><small class="${st}">${esc(sub)}</small></div>`, miss = (st, r, u = '') => st === 'out' ? rng(r, u) : '';
    const no = this._notes[b.id] || {};
    return `<div class="hero"><div class="pillrow"><button class="icon" data-nav="1" aria-label="Älterer Bezug" ${pos >= n - 1 ? 'disabled' : ''}>${ic('left')}</button>
      <button class="pilltoggle" data-menu aria-haspopup="listbox" aria-expanded="${this._menu}">${n - pos}/${n} · ${esc(disp(b).short)} ${esc(disp(b).time)} ${ic(this._menu ? 'up' : 'down')}</button>
      <button class="icon" data-nav="-1" aria-label="Neuerer Bezug" ${pos <= 0 ? 'disabled' : ''}>${ic('right')}</button>
      ${this._menu ? `<div class="menu" role="listbox" aria-label="Bezug auswählen">${this._menuRows(l)}</div>` : ''}</div>
      <div class="tiles">${tile('r', 'Verhältnis (x)', b.ratio ? b.ratio.toFixed(1) : '--', s.ratio, miss(s.ratio, t.ratio) || (b.dose_g ? `${b.dose_g.toFixed(1)} g Mehl` : ''))}
      ${tile('f', 'Fluss (g/s)', (pk || this._flow(b)).toFixed(1), s.flow, miss(s.flow, t.flow) || (pk ? `Ø ${this._flow(b).toFixed(1)}` : ''))}
      ${tile('w', 'Gewicht (g)', b.yield_g.toFixed(1), s.yield, miss(s.yield, t.yield))}${tile('t', 'Zeit', m, s.time, miss(s.time, t.time, ' s'))}</div>
      ${this._ok(b) ? `<div class="chip ok" style="margin:0 0 8px">${ic('check')} im Ziel</div>` : ''}${this._graph(b)}
      <div class="notes"><div class="st">${[1, 2, 3, 4, 5].map(k => `<button data-s="${k}" class="${(no.stars || 0) >= k ? 'on' : ''}" aria-label="${k} Sterne">${ic('star')}</button>`).join('')}<button class="icon" data-notes aria-label="Notiz bearbeiten" aria-expanded="${this._nopen}">${ic('edit')}</button></div>
      ${this._nopen ? `<input data-f="bean" placeholder="Bohne" aria-label="Bohne" value="${esc(no.bean)}"><textarea data-f="note" rows="2" placeholder="Notiz" aria-label="Notiz">${esc(no.note)}</textarea>` : (no.bean || no.note) ? `<div class="mut">${esc([no.bean, no.note].filter(Boolean).join(' · '))}</div>` : ''}</div></div>`;
  }
  _menuRows(l) { // the logbook: every brew, grouped by day, with notes and stars
    let day = '', h = '';
    for (const b of l) {
      const d = disp(b).date, no = this._notes[b.id] || {};
      if (d !== day) { day = d; h += `<div class="day">${esc(d)}</div>`; }
      h += `<div class="row ${b.id === this._selId ? 'sel' : ''}" tabindex="0" role="option" aria-selected="${b.id === this._selId}" data-pick="${esc(b.id)}"><div class="t ${this._ok(b) ? 'ok' : ''}"><span>${disp(b).short}<br>${disp(b).time}</span></div>
        <div style="min-width:0"><b>${b.yield_g.toFixed(1)} g</b> in ${b.time_s} s · ${this._flow(b).toFixed(1)} g/s<small>${esc(no.bean || (b.mode === 'pourover' ? 'Filter' : 'Espresso'))}${no.note ? ' · ' + esc(no.note) : ''}</small></div>
        <div class="r">${b.ratio ? '1:' + b.ratio.toFixed(1) : ''}<div class="stars">${'★'.repeat(no.stars || 0)}</div></div></div>`;
    }
    return h;
  }
  _draw() {
    const r = this.shadowRoot; if (!r) return;
    const l = this._list(), selPos = Math.max(0, l.findIndex(b => b.id === this._sel)), sel = l[selPos]; this._selId = sel?.id;
    const keep = r.activeElement?.dataset?.f, v = keep && r.activeElement.value;
    r.innerHTML = `<style>${CSS(this._c.accent || '#e8b54a')}</style><div class="card">
      <header><div class="logo">${ic('cup')}</div><h2>${esc(this._c.title || 'Logbuch')}</h2>
        <div class="seg">${[['all', 'Alle'], ['espresso', 'Espresso'], ['pourover', 'Filter']].map(([k, t]) => `<button data-m="${k}" class="${this._mode === k ? 'on' : ''}">${t}</button>`).join('')}</div></header>
      ${sel ? this._hero(sel, selPos, l.length, l) + this._chart(l) : '<div class="empty">Noch keine Brühungen.</div>'}</div>`;
    if (keep) { const el = r.querySelector(`[data-f="${keep}"]`); if (el) { el.focus(); el.setSelectionRange?.(v.length, v.length); } }
  }
  getCardSize() { return 9; }
}
customElements.define('nofree-brew-card', NofreeBrewCard);
