/* nofree-brew-card · prototype v0.1 · Mavo Lumicurve brew logbook
   config: { type: 'custom:nofree-brew-card', entity: 'sensor.mavo_brews' }  (attribute `brews` = list from parse.py)
           or { brews_url: 'brews.json' } for the local test page.
   Notes (bean, rating, text) live in HA user data (frontend/set_user_data), localStorage as fallback. */
const KEY = 'nofree_brew_notes';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = a => `
:host{--a:${a};display:block;color:var(--primary-text-color,#f4efe6);font:14px system-ui,sans-serif}
.card{border-radius:16px;padding:16px;background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 8px 24px rgba(0,0,0,.25)}
h2{margin:0 0 12px;font-size:16px;display:flex;justify-content:space-between;align-items:center}
.hero{display:flex;gap:20px;margin-bottom:12px}.hero b{font-size:30px;display:block;line-height:1.1}.hero span{opacity:.7;font-size:12px}
.seg{display:flex;gap:8px;margin:8px 0}
button{font:inherit;color:inherit;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);cursor:pointer}
button:active{transform:scale(.97)}button.on{background:color-mix(in srgb,var(--a) 22%,transparent);color:var(--a);border-color:var(--a)}
button:focus-visible,.row:focus-visible{outline:2px solid var(--a);outline-offset:2px}
rect.out{opacity:.35}svg{width:100%;height:70px;display:block;margin:8px 0}
.day{margin:12px 0 4px;font-size:12px;opacity:.7}
.row{display:grid;grid-template-columns:52px 1fr 52px 56px;gap:8px;align-items:center;padding:8px 10px;border-radius:12px;cursor:pointer}
.row:hover{background:rgba(255,255,255,.08)}.row small{opacity:.65;display:block}.row .r{text-align:right}
.edit{padding:10px;margin:4px 0 8px;border-radius:12px;background:rgba(0,0,0,.2);display:grid;gap:8px}
input,textarea{font:inherit;color:inherit;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08)}
.stars button{min-height:40px;min-width:40px;padding:0}.empty{opacity:.7;padding:16px 0}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;

class NofreeBrewCard extends HTMLElement {
  setConfig(c) { this._c = { chart_count: 30, show_invalid: false, ...c }; this._mode = 'all'; this._open = null; this.attachShadow?.({ mode: 'open' }); this._notes = this._load(); this._brews = null; this._fetch(); }
  set hass(h) { this._h = h; if (this._c?.entity) { const b = h.states[this._c.entity]?.attributes?.brews; if (b !== this._src) { this._src = b; this._brews = b || []; this._draw(); } } }
  async _fetch() { if (!this._c.brews_url) return; try { this._brews = await (await fetch(this._c.brews_url)).json(); } catch { this._brews = []; } this._draw(); }
  _load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  async _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this._notes)); } catch {}
    try { await this._h?.callWS({ type: 'frontend/set_user_data', key: KEY, value: this._notes }); } catch {}
  }
  _list() { // newest first; ts is the scale's clock, only good for ordering
    return (this._brews || []).map((b, i) => ({ ...b, id: b.ts + '|' + b.time_s + '|' + b.yield_g, i }))
      .filter(b => (this._c.show_invalid || b.valid !== false) && (this._mode === 'all' || b.mode === this._mode)).sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : b.i - a.i));
  }
  _in(v, r) { return !r || (v >= r[0] && v <= r[1]); }
  _chart(list) {
    const d = list.slice(0, this._c.chart_count).reverse(), max = Math.max(1, ...d.map(b => b.time_s)), w = 300 / Math.max(d.length, 1);
    return `<svg viewBox="0 0 300 70" role="img" aria-label="Bezugszeit der letzten ${d.length} Brühungen">${d.map((b, i) =>
      `<rect class="${this._in(b.time_s, this._c.target_time) ? '' : 'out'}" x="${i * w + 1}" y="${70 - 66 * b.time_s / max}" width="${Math.max(w - 2, 1)}" height="${66 * b.time_s / max}" rx="2" fill="var(--a)" opacity=".8"/>`).join('')}</svg>`;
  }
  _draw() {
    const r = this.shadowRoot; if (!r) return;
    const l = this._list(), last = l[0], n = k => this._notes[k] || {};
    let day = '', rows = '';
    for (const b of l) {
      const d = b.ts.slice(0, 10);
      if (d !== day) { day = d; rows += `<div class="day">${esc(d)}</div>`; }
      const no = n(b.id);
      rows += `<div class="row" tabindex="0" role="button" data-id="${esc(b.id)}"><div>${esc(b.ts.slice(11, 16))}</div>
        <div>${b.yield_g.toFixed(1)} g · ${b.time_s} s ${this._in(b.yield_g, this._c.target_yield) && this._in(b.time_s, this._c.target_time) ? '<span style="color:var(--a)">✓</span>' : ''}<small>${esc(no.bean || (b.mode === 'pourover' ? 'Filter' : 'Espresso'))}${no.note ? ' · ' + esc(no.note) : ''}</small></div>
        <div class="r">${b.ratio ? '1:' + b.ratio.toFixed(1) : ''}</div><div class="r">${'★'.repeat(no.stars || 0)}</div></div>`;
      if (this._open === b.id) rows += `<div class="edit"><input data-f="bean" placeholder="Bohne" aria-label="Bohne" value="${esc(no.bean)}">
        <textarea data-f="note" rows="2" placeholder="Notiz" aria-label="Notiz">${esc(no.note)}</textarea>
        <div class="stars">${[1, 2, 3, 4, 5].map(s => `<button data-s="${s}" class="${(no.stars || 0) >= s ? 'on' : ''}" aria-label="${s} Sterne">★</button>`).join('')}</div></div>`;
    }
    r.innerHTML = `<style>${CSS(this._c.accent||'#e8b54a')}</style><div class="card"><h2>${esc(this._c.title || 'Espresso-Logbuch')} <span style="font-weight:400;opacity:.6">${l.length}</span></h2>
      ${last ? `<div class="hero"><div><b>${last.yield_g.toFixed(1)} g</b><span>letzter Bezug</span></div><div><b>${last.time_s} s</b><span>Zeit</span></div>${last.ratio ? `<div><b>1:${last.ratio.toFixed(1)}</b><span>Verhältnis</span></div>` : ''}</div>${this._chart(l)}` : ''}
      <div class="seg">${[['all', 'Alle'], ['espresso', 'Espresso'], ['pourover', 'Filter']].map(([k, t]) => `<button data-m="${k}" class="${this._mode === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      ${rows || '<div class="empty">Noch keine Brühungen.</div>'}</div>`;
    r.onclick = e => {
      const t = e.target.closest('[data-m],[data-s],.row'); if (!t) return;
      if (t.dataset.m) { this._mode = t.dataset.m; this._open = null; }
      else if (t.dataset.s) { const o = this._notes[this._open] ||= {}; o.stars = o.stars === +t.dataset.s ? 0 : +t.dataset.s; this._save(); }
      else this._open = this._open === t.dataset.id ? null : t.dataset.id;
      this._draw();
    };
    r.onkeydown = e => { if (e.key === 'Enter' && e.target.classList.contains('row')) e.target.click(); };
    r.onchange = e => { const f = e.target.dataset.f; if (f && this._open) { (this._notes[this._open] ||= {})[f] = e.target.value; this._save(); this._draw(); } };
  }
  getCardSize() { return 8; }
}
customElements.define('nofree-brew-card', NofreeBrewCard);
