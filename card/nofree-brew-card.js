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
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
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
.card{border-radius:20px;padding:18px;background:linear-gradient(155deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 30px rgba(0,0,0,.28)}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
header .logo{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a)}
header h2{margin:0;font-size:16px;font-weight:650;flex:1}header h2 small{display:block;font-weight:400;font-size:12px;color:var(--mut)}
.seg{display:flex;gap:6px}
button{font:inherit;color:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);cursor:pointer;transition:transform .12s,background .15s}
button:hover{background:rgba(255,255,255,.12)}button:active{transform:scale(.97)}
button.on{background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a);border-color:var(--a)}
button:focus-visible,.row:focus-visible{outline:2px solid var(--a);outline-offset:2px}
.hero{display:grid;grid-template-columns:1fr 104px;gap:14px;align-items:center;padding:14px;border-radius:16px;background:rgba(0,0,0,.2);margin-bottom:12px}
.hero .big{font-size:44px;font-weight:700;letter-spacing:-.02em;line-height:1}.hero .big small{font-size:16px;font-weight:500;color:var(--mut);margin-left:4px}
.hero .sub{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.09);font-size:12px}.chip .ic{width:14px;height:14px}
.chip.warn{background:rgba(230,120,90,.22);color:#f0a08c}.chip.ok{background:color-mix(in srgb,var(--a) 24%,transparent);color:var(--a)}
.lab{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-bottom:6px}
.ring{position:relative;width:104px;height:104px}.ring svg{width:104px;height:104px;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-width:9;stroke-linecap:round}.ring .bg{stroke:rgba(255,255,255,.1)}.ring .fg{stroke:var(--a);transition:stroke-dashoffset .6s}
.ring div{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font-size:22px;font-weight:700}.ring small{display:block;font-size:11px;font-weight:400;color:var(--mut)}
.chart{margin:4px 0 14px}.chart svg{width:100%;height:76px;display:block}
.chart rect.b{fill:var(--a);opacity:.85}.chart rect.b.out{opacity:.3}.chart rect.band{fill:var(--a);opacity:.1}
.row{display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;padding:10px;border-radius:14px;cursor:pointer}
.row:hover{background:rgba(255,255,255,.07)}
.row .t{width:52px;height:44px;border-radius:14px;display:grid;place-items:center;text-align:center;background:rgba(255,255,255,.08);font-size:11px;line-height:1.25;font-weight:600}
.row .t.ok{background:color-mix(in srgb,var(--a) 24%,transparent);color:var(--a)}
.row b{font-weight:600}.row small{display:block;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .r{text-align:right;font-size:12px;color:var(--mut)}.stars{color:var(--a);letter-spacing:1px}
.bar{height:3px;border-radius:2px;background:rgba(255,255,255,.1);margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:var(--a);border-radius:2px}
.curve{margin:0 0 12px}.edit .curve{margin:0}.curve svg{width:100%;display:block}.curve text{fill:var(--mut);font-size:9px}
.curve .wl{fill:none;stroke:var(--a);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.curve .wl.dash{stroke-dasharray:5 4;opacity:.7}
.curve .wd{fill:var(--a)}.curve .fb{fill:var(--a);opacity:.28}.curve .ax{stroke:rgba(255,255,255,.2);stroke-width:1}.curve .note{font-size:11px;color:var(--mut)}
.more{width:100%;margin-top:8px}
.older{max-height:380px;overflow:auto;margin-top:4px;border-radius:14px}
.day{margin:12px 0 2px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut)}
.edit{padding:12px;margin:2px 0 8px;border-radius:14px;background:rgba(0,0,0,.22);display:grid;gap:8px}
input,textarea{font:inherit;color:inherit;padding:9px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07)}
input:focus-visible,textarea:focus-visible{outline:2px solid var(--a);outline-offset:1px}
.edit .st{display:flex;gap:6px}.edit .st button{min-width:40px;padding:0}.edit .st button.on .ic{fill:var(--a)}
.empty{opacity:.7;padding:20px 0;text-align:center}
@media (max-width:480px){header{flex-wrap:wrap}header .seg{order:3;width:100%}header .seg button{flex:1}}
@media (max-width:380px){.hero{grid-template-columns:1fr}.ring{display:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

class NofreeBrewCard extends HTMLElement {
  setConfig(c) {
    this._c = { chart_count: 30, recent: 5, show_invalid: false, ring_max: 45, chart_metric: 'time', ...c };
    this._mode = 'all'; this._open = null; this._all = false; this._brews = null;
    if (!this.shadowRoot) { const r = this.attachShadow({ mode: 'open' }); this._wire(r); }
    this._notes = this._load(); this._fetch();
  }
  _wire(r) { // ShadowRoot has no onclick property, so use listeners (registered once)
    r.addEventListener('click', e => {
      const t = e.target.closest('[data-m],[data-c],[data-s],[data-more],.row'); if (!t) return;
      if (t.dataset.c) this._c.chart_metric = t.dataset.c;
      else if (t.dataset.m) { this._mode = t.dataset.m; this._open = null; }
      else if ('more' in t.dataset) this._all = !this._all;
      else if (t.dataset.s) { const o = this._notes[this._open] ||= {}; o.stars = o.stars === +t.dataset.s ? 0 : +t.dataset.s; this._save(); }
      else this._open = this._open === t.dataset.id ? null : t.dataset.id;
      this._draw();
    });
    r.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('row')) e.target.click(); });
    r.addEventListener('change', e => { const f = e.target.dataset.f; if (f && this._open) { (this._notes[this._open] ||= {})[f] = e.target.value; this._save(); this._draw(); } });
  }
  set hass(h) { this._h = h; if (this._c?.entity) { const b = h.states[this._c.entity]?.attributes?.brews; if (b !== this._src) { this._src = b; this._brews = b || []; this._draw(); } } }
  async _fetch() { if (!this._c.brews_url) return; try { this._brews = await (await fetch(this._c.brews_url)).json(); } catch { this._brews = []; } this._draw(); }
  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  async _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this._notes)); } catch {}
    try { await this._h?.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._notes }); } catch {}
  }
  _list() { // newest first; ts is the scale's clock, only good for ordering
    return (this._brews || []).map((b, i) => ({ ...b, id: b.ts + '|' + b.time_s + '|' + b.yield_g, i }))
      .filter(b => (this._c.show_invalid || b.valid !== false) && (this._mode === 'all' || b.mode === this._mode))
      .sort((a, b) => (b.seq ?? b.i) - (a.seq ?? a.i)); // file order of the scale log = chronological
  }
  _flow(b) { return b.flow_gs ?? (b.time_s ? b.yield_g / b.time_s : 0); }
  _in(v, r) { return !r || (v >= r[0] && v <= r[1]); }
  _ok(b) { const k = this._c; return (k.target_time || k.target_yield || k.target_flow) && this._in(b.time_s, k.target_time) && this._in(b.yield_g, k.target_yield) && this._in(this._flow(b), k.target_flow); }
  _chart(list) {
    const fl = this._c.chart_metric === 'flow', val = b => fl ? this._flow(b) : b.time_s, tt = fl ? this._c.target_flow : this._c.target_time;
    const d = list.filter(b => this._mode === 'pourover' || b.mode === 'espresso').slice(0, this._c.chart_count).reverse(); /* long pours would flatten the espresso bars */
    const max = Math.max(fl ? 1 : 10, ...d.map(val), tt ? tt[1] : 0), w = 300 / Math.max(d.length, 1), y = v => 72 - 66 * v / max;
    return `<div class="chart"><div class="lab" style="display:flex;justify-content:space-between;align-items:center">${fl ? 'Durchfluss' : 'Bezugszeit'} · letzte ${d.length}<span class="seg">${[['time', 'Zeit'], ['flow', 'Fluss']].map(([k, t]) => `<button data-c="${k}" class="${(fl ? 'flow' : 'time') === k ? 'on' : ''}" style="min-height:32px;padding:0 10px">${t}</button>`).join('')}</span></div><svg viewBox="0 0 300 76" role="img" aria-label="${fl ? 'Durchfluss' : 'Bezugszeit'} der letzten ${d.length} Brühungen">
      ${tt ? `<rect class="band" x="0" y="${y(tt[1])}" width="300" height="${y(tt[0]) - y(tt[1])}" rx="3"/>` : ''}
      ${d.map((b, i) => `<rect class="b ${this._in(val(b), tt) ? '' : 'out'}" x="${i * w + 1}" y="${y(val(b))}" width="${Math.max(w - 2, 1)}" height="${72 - y(val(b))}" rx="2"/>`).join('')}</svg></div>`;
  }
  _curve(b) { // weight line + flow bars over time; dashed average line when the log has no samples for this shot
    const pts = b.curve || [[0, 0], [b.time_s, b.yield_g]], T = b.time_s, Y = Math.max(b.yield_g, 1), H = 86, real = pts.length >= 5;
    const x = t => 4 + 292 * t / T, wy = g => H - (H - 6) * g / Y;
    const m = [pts[0]]; for (const p of pts.slice(1)) if (p[0] - m[m.length - 1][0] >= 6 || p === pts[pts.length - 1]) m.push(p); // samples 1 s apart would fake flow spikes
    const seg = m.slice(1).map((p, i) => ({ t0: m[i][0], t1: p[0], f: (p[1] - m[i][1]) / Math.max(p[0] - m[i][0], 1) }));
    const fm = Math.max(0.1, ...seg.map(s => s.f)), peak = Math.max(...seg.map(s => s.f));
    return `<div class="curve"><div class="lab" style="display:flex;justify-content:space-between"><span>Verlauf</span><span>Ø ${this._flow(b).toFixed(1)} g/s${real ? ' · max ' + peak.toFixed(1) : ''}</span></div>
      <svg viewBox="0 0 300 ${H + 16}" role="img" aria-label="Gewicht und Durchfluss über ${T} Sekunden">
      ${real ? seg.map(s => `<rect class="fb" x="${x(s.t0)}" y="${H - (H - 6) * s.f / fm}" width="${Math.max(x(s.t1) - x(s.t0) - 1, 1)}" height="${(H - 6) * s.f / fm}" rx="2"/>`).join('') : ''}
      <path class="wl ${real ? '' : 'dash'}" d="${pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + wy(p[1]).toFixed(1)).join('')}"/>
      ${real ? pts.slice(1, -1).map(p => `<circle class="wd" cx="${x(p[0])}" cy="${wy(p[1])}" r="2.5"/>`).join('') : ''}
      <line class="ax" x1="4" x2="296" y1="${H}" y2="${H}"/>
      ${[0, .5, 1].map(f => `<text x="${4 + 292 * f}" y="${H + 12}" text-anchor="${f ? (f === 1 ? 'end' : 'middle') : 'start'}">${Math.round(T * f)} s</text>`).join('')}</svg>
      <div class="note">${real ? 'Gewicht (Linie) · Durchfluss zwischen den Messpunkten (Balken)' : 'Die Waage hat für diesen Bezug keinen Verlauf gespeichert – gestrichelt: Durchschnitt.'}</div></div>`;
  }
  _hero(b) {
    const C = 2 * Math.PI * 41, p = Math.min(1, b.time_s / this._c.ring_max);
    return `<div class="hero"><div><div class="lab">Letzter Bezug · ${disp(b).full}</div><div class="big">${b.yield_g.toFixed(1)}<small>g</small></div>
      <div class="sub"><span class="chip">${this._flow(b).toFixed(1)} g/s</span>${b.ratio ? `<span class="chip">1 : ${b.ratio.toFixed(1)}</span>` : ''}${b.dose_g ? `<span class="chip">${b.dose_g.toFixed(1)} g Mehl</span>` : ''}${this._ok(b) ? `<span class="chip ok">${ic('check')} im Ziel</span>` : ''}</div></div>
      <div class="ring" role="img" aria-label="${b.time_s} Sekunden"><svg viewBox="0 0 104 104"><circle class="bg" cx="52" cy="52" r="41"/><circle class="fg" cx="52" cy="52" r="41" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"/></svg><div>${b.time_s}<small>Sekunden</small></div></div></div>${this._curve(b)}`;
  }
  _row(b) {
    const no = this._notes[b.id] || {}, ok = this._ok(b), tmax = this._c.ring_max;
    let h = `<div class="row" tabindex="0" role="button" aria-expanded="${this._open === b.id}" data-id="${esc(b.id)}"><div class="t ${ok ? 'ok' : ''}"><span>${disp(b).short}<br>${disp(b).time}</span></div>
      <div style="min-width:0"><b>${b.yield_g.toFixed(1)} g</b> in ${b.time_s} s · ${this._flow(b).toFixed(1)} g/s<small>${esc(no.bean || (b.mode === 'pourover' ? 'Filter' : 'Espresso'))}${no.note ? ' · ' + esc(no.note) : ''}</small>
      <div class="bar"><i style="width:${Math.min(100, 100 * b.time_s / (b.mode === 'pourover' ? 240 : tmax))}%"></i></div></div>
      <div class="r">${b.ratio ? '1:' + b.ratio.toFixed(1) : ''}<div class="stars">${'★'.repeat(no.stars || 0)}</div></div></div>`;
    if (this._open === b.id) h += `<div class="edit"><div class="note" style="font-size:11px;color:var(--mut)">${esc(disp(b).full)}${b.real_ts ? ':' + esc(b.real_ts.slice(17)) : ''}</div>${this._curve(b)}<input data-f="bean" placeholder="Bohne" aria-label="Bohne" value="${esc(no.bean)}">
      <textarea data-f="note" rows="2" placeholder="Notiz" aria-label="Notiz">${esc(no.note)}</textarea>
      <div class="st">${[1, 2, 3, 4, 5].map(s => `<button data-s="${s}" class="${(no.stars || 0) >= s ? 'on' : ''}" aria-label="${s} Sterne">${ic('star')}</button>`).join('')}</div></div>`;
    return h;
  }
  _draw() {
    const r = this.shadowRoot; if (!r) return;
    const l = this._list(), n = this._c.recent, recent = l.slice(0, n), older = l.slice(n);
    let day = '', old = '';
    for (const b of older) { const d = disp(b).date; if (d !== day) { day = d; old += `<div class="day">${esc(d)}</div>`; } old += this._row(b); }
    r.innerHTML = `<style>${CSS(this._c.accent || '#e8b54a')}</style><div class="card">
      <header><div class="logo">${ic('cup')}</div><h2>${esc(this._c.title || 'Espresso-Logbuch')}<small>${l.length} Brühungen</small></h2>
        <div class="seg">${[['all', 'Alle'], ['espresso', 'Espresso'], ['pourover', 'Filter']].map(([k, t]) => `<button data-m="${k}" class="${this._mode === k ? 'on' : ''}">${t}</button>`).join('')}</div></header>
      ${l[0] ? this._hero(l[0]) + this._chart(l) : ''}
      ${l.length ? `<div class="lab" style="margin-left:10px">Letzte ${Math.min(n, l.length)}</div>${recent.map(b => this._row(b)).join('')}` : '<div class="empty">Noch keine Brühungen.</div>'}
      ${older.length ? `<button class="more" data-more aria-expanded="${this._all}">${ic(this._all ? 'up' : 'down')}${this._all ? 'Weniger anzeigen' : `Alle ${l.length} anzeigen`}</button>${this._all ? `<div class="older">${old}</div>` : ''}` : ''}</div>`;
  }
  getCardSize() { return 9; }
}
customElements.define('nofree-brew-card', NofreeBrewCard);
