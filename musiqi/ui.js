// Shared script of the music sub-pages (bestekarlar, caz, estrada): language switch, a lane timeline, a master→student / who-played-with-whom network (d3)
(() => {
const LANGS = ['az', 'ru', 'en'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MQ = window.MQ = { esc, LANGS };
MQ.lang = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(q)) return q;
  try { const s = localStorage.getItem('lang'); if (LANGS.includes(s)) return s; } catch {}
  return 'az';
})();
// boot(T, render): T = { az: {...}, ru: {...}, en: {...} }; [data-i18n] gets T[lang][key] as text, [data-i18n-html] as HTML; render() runs after every language change
MQ.boot = (T, render) => {
  MQ.T = T;
  const topEl = document.getElementById('top'); if (topEl) topEl.innerHTML = MQ.top();
  MQ.t = (k, ...a) => { const v = T[MQ.lang][k] ?? T.az[k]; return typeof v === 'function' ? v(...a) : v; };
  const apply = () => {
    const lang = MQ.lang;
    document.documentElement.lang = lang; document.title = MQ.t('doc');
    document.querySelectorAll('[data-i18n]').forEach((e) => e.textContent = MQ.t(e.dataset.i18n));
    document.querySelectorAll('[data-i18n-html]').forEach((e) => e.innerHTML = MQ.t(e.dataset.i18nHtml));
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    document.querySelectorAll('[data-keep-lang]').forEach((a) => { const u = new URL(a.getAttribute('href'), location.href); if (lang === 'az') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang); a.href = u.pathname + u.search + u.hash; });
    render();
  };
  document.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => {
    MQ.lang = b.dataset.lang; try { localStorage.setItem('lang', MQ.lang); } catch {}
    const u = new URL(location.href); if (MQ.lang === 'az') u.searchParams.delete('lang'); else u.searchParams.set('lang', MQ.lang); history.replaceState(null, '', u);
    apply();
  });
  apply();
  return apply;
};
MQ.nm = (p) => p[MQ.lang] || p.az || p.en || p.ru || p.qid;
MQ.kxBase = () => `https://kitabxana.az${MQ.lang === 'az' ? '' : '/' + MQ.lang}`;
MQ.wikiLinks = (wiki) => Object.entries(wiki ?? {}).filter(([l]) => LANGS.includes(l)).sort((a, b) => LANGS.indexOf(a[0]) - LANGS.indexOf(b[0])).map(([l, t]) => `<a href="https://${l}.wikipedia.org/wiki/${encodeURI(t)}">${l}</a>`).join(' · ');
MQ.yrs = (p) => p.born || p.died ? `${p.born ?? '?'}–${p.died ?? ''}` : '';
// Audio items { title, performer, composer, year, commons, ogg, licence }; only freely licensed or public-domain files ever go in these lists
MQ.audio = (items, tt) => items.map((r) => `<div class="card"><h3>${esc(r.title[MQ.lang] || r.title.az)}</h3><div class="muted">${esc(r.performer)}${r.composer ? ' · ' + esc(r.composer) : ''}${r.year ? ' · ' + esc(r.year) : ''}</div><audio controls preload="none" src="${esc(r.ogg)}"></audio><div><span class="tag ok">${esc(r.licence)}</span> <a href="${esc(r.commons)}">Commons</a></div></div>`).join('');
// YouTube link-out for a person (data/youtube.json, scripts/youtube.mjs): a plain «YouTube» link, never an embed; the tag says where the channel comes from
MQ.YT = {};
MQ.ytRow = (q) => { const y = MQ.YT[q]; return y ? `<dt>YouTube</dt><dd><a href="${esc(y.url)}" rel="noopener">YouTube</a><span class="tag">${y.src === 'wikidata' ? 'Wikidata P2397' : '?'}</span></dd>` : ''; };
MQ.loadYT = () => fetch('/musiqi/data/youtube.json').then((r) => r.json()).then((d) => { MQ.YT = d; }).catch(() => {});
MQ.top = (here) => `<div class="top"><a class="brand" href="/" data-keep-lang><svg viewBox="0 0 512 512" aria-hidden="true"><g class="star"><rect x="126" y="126" width="260" height="260"/><polygon points="256,72 440,256 256,440 72,256"/></g><polygon class="gem" points="256,196 316,256 256,316 196,256"/></svg>Azad Bilik</a><nav><a href="/musiqi/" data-keep-lang data-i18n="music">Musiqi</a><span class="langs" role="group" aria-label="Dil · Язык · Language"><button type="button" data-lang="az">AZ</button><button type="button" data-lang="ru">RU</button><button type="button" data-lang="en">EN</button></span></nav></div>`;

// Timeline: items on lanes along a year axis. item = { id, lane, x0, x1?, label, sub?, color, dim? }; x1 makes a bar. Labels are packed into tracks so they do not overlap.
MQ.timeline = (el, o) => {
  const PX = o.px ?? 13, L = 92, R = 40, TR = 15, PAD = 10, from = o.from, to = o.to;
  const X = (y) => L + (y - from) * PX, W = Math.max(el.parentElement.clientWidth, X(to) + R);
  let y = 22, out = '', hits = '';
  const ticks = []; for (let t = Math.ceil(from / 10) * 10; t <= to; t += 10) ticks.push(t);
  const body = [];
  for (const lane of o.lanes) {
    const its = o.items.filter((i) => i.lane === lane.id).sort((a, b) => a.x0 - b.x0 || String(a.label).localeCompare(String(b.label)));
    const ends = []; // end x of each track
    const placed = its.map((i) => {
      const w = (i.label.length + (i.sub ? i.sub.length + 1 : 0)) * 5.6 + 12, x0 = X(i.x0), x1 = i.x1 != null ? X(i.x1) : x0, end = x1 + 6 + w;
      let tr = ends.findIndex((e) => e + 6 < x0 - 6);
      if (tr < 0) { tr = ends.length; ends.push(0); }
      ends[tr] = end; return { i, tr, x0, x1 };
    });
    const h = Math.max(1, ends.length) * TR + PAD * 2 + 14;
    body.push(`<rect class="lane" x="0" y="${y}" width="${W}" height="${h - 2}"/><text class="lanelab" x="8" y="${y + 15}">${esc(lane.label)}</text>`);
    for (const p of placed) {
      const cy = y + PAD + 14 + p.tr * TR + 6, i = p.i, on = o.selected === i.id;
      const shape = i.x1 != null ? `<rect class="shape span${i.dead ? ' dead' : ''}" x="${p.x0}" y="${cy - 3.5}" width="${Math.max(3, p.x1 - p.x0)}" height="7" rx="3.5"/>` : `<circle class="shape" cx="${p.x0}" cy="${cy}" r="4.6"/>`;
      body.push(`<g class="ev${on ? ' on' : ''}${i.dim ? ' dim' : ''}" data-id="${esc(i.id)}" tabindex="0" role="button" aria-label="${esc(i.label)}" style="--c:${i.color}">${shape}<text class="lab" x="${(i.x1 != null ? p.x0 + 6 : p.x1 + 8)}" y="${cy + 3.5}">${esc(i.label)}${i.sub ? `<tspan class="lab s" dx="4">${esc(i.sub)}</tspan>` : ''}</text><rect x="${p.x0 - 5}" y="${cy - 8}" width="${p.x1 - p.x0 + 10 + 24 + (i.label.length * 5.6)}" height="16" fill="transparent"/></g>`);
    }
    y += h;
  }
  const H = y + 22;
  const axis = ticks.map((t) => `<g class="axis"><line x1="${X(t)}" y1="14" x2="${X(t)}" y2="${H - 18}"/><text x="${X(t)}" y="${H - 5}" text-anchor="middle">${t}</text><text x="${X(t)}" y="10" text-anchor="middle">${t}</text></g>`).join('');
  el.setAttribute('viewBox', `0 0 ${W} ${H}`); el.setAttribute('width', W); el.setAttribute('height', H);
  el.innerHTML = axis + body.join('');
  const pick = (g) => o.onPick(g.dataset.id);
  el.querySelectorAll('.ev').forEach((g) => { g.onclick = () => pick(g); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(g); } }; });
};

// Network of people and links (t → s): columns are generations (longest chain of t's), rows are ordered by neighbours' mean row.
// o = { svg, scroller, people, links, name(p), color(p), sub(p), off(p), onSelect(q), arrows }
MQ.network = (o) => {
  const svg = d3.select(o.svg), byQ = new Map(o.people.map((p) => [p.qid, p]));
  let sel = null;
  const kids = new Map(), parents = new Map();
  for (const l of o.links) { (kids.get(l.t) ?? kids.set(l.t, []).get(l.t)).push(l); (parents.get(l.s) ?? parents.set(l.s, []).get(l.s)).push(l); }
  const closure = (q, map, key) => { const out = new Set([q]), st = [q]; while (st.length) for (const l of map.get(st.pop()) ?? []) if (!out.has(l[key])) { out.add(l[key]); st.push(l[key]); } return out; };
  const ids = new Set(o.links.flatMap((l) => [l.t, l.s])), seen = new Set(), comps = [];
  for (const q of ids) {
    if (seen.has(q)) continue;
    const comp = [], st = [q]; seen.add(q);
    while (st.length) { const x = st.pop(); comp.push(x); for (const l of [...(kids.get(x) ?? []), ...(parents.get(x) ?? [])]) for (const y of [l.t, l.s]) if (!seen.has(y)) { seen.add(y); st.push(y); } }
    comps.push(comp);
  }
  comps.sort((a, b) => b.length - a.length);
  const COLW = o.colw ?? 190, ROW = 21, layer = new Map();
  const lay = (q, d = 0) => { if (layer.has(q)) return layer.get(q); if (d > 14) return 0; layer.set(q, 0); const v = Math.max(-1, ...(parents.get(q) ?? []).map((l) => lay(l.t, d + 1))) + 1; layer.set(q, v); return v; };
  const nodes = [], by = new Map(); let y0 = 8, maxL = 0;
  for (const [ci, comp] of comps.entries()) {
    const cols = new Map();
    for (const q of comp) { const L = lay(q); maxL = Math.max(maxL, L); (cols.get(L) ?? cols.set(L, []).get(L)).push(q); }
    const keys = [...cols.keys()].sort((p, q) => p - q);
    for (const k of keys) cols.get(k).sort((p, q) => (byQ.get(p).born ?? 9999) - (byQ.get(q).born ?? 9999));
    const pos = new Map(), setPos = () => keys.forEach((k) => cols.get(k).forEach((q, i) => pos.set(q, i)));
    setPos();
    for (let it = 0; it < 4; it++) for (const k of (it % 2 ? [...keys].reverse() : keys)) {
      const nb = (q) => (it % 2 ? (kids.get(q) ?? []).map((l) => l.s) : (parents.get(q) ?? []).map((l) => l.t));
      const bc = (q) => { const r = nb(q).map((x) => pos.get(x)).filter((v) => v != null); return r.length ? r.reduce((p, v) => p + v, 0) / r.length : pos.get(q); };
      cols.get(k).sort((p, q) => bc(p) - bc(q)); setPos();
    }
    const rows = Math.max(...keys.map((k) => cols.get(k).length));
    for (const k of keys) { const col = cols.get(k), off = (rows - col.length) / 2; col.forEach((q, i) => { const n = { id: q, p: byQ.get(q), x: 16 + k * COLW, y: y0 + 10 + (off + i) * ROW }; nodes.push(n); by.set(q, n); }); }
    y0 += rows * ROW + 22;
  }
  svg.selectAll('*').remove();
  if (!nodes.length) return { select() {} };
  const W = Math.max(document.querySelector(o.scroller).clientWidth, 16 + (maxL + 1) * COLW + 40), H = y0;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H);
  const defs = svg.append('defs');
  defs.append('marker').attr('id', 'arr' + o.svg.replace(/\W/g, '')).attr('viewBox', '0 0 8 8').attr('refX', 8).attr('refY', 4).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,0L8,4L0,8z').attr('fill', 'currentColor').attr('style', 'color:var(--muted)');
  const path = (e) => { const x1 = e.source.x + 6, y1 = e.source.y, x2 = e.target.x, y2 = e.target.y, mx = (x1 + x2) / 2; return `M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2 - 7},${y2}`; };
  const edges = o.links.map((l) => ({ ...l, source: by.get(l.t), target: by.get(l.s) }));
  const edge = svg.append('g').selectAll('path').data(edges).join('path').attr('class', (e) => `edge ${e.src ?? ''}`).attr('d', path).attr('marker-end', o.arrows === false ? null : `url(#arr${o.svg.replace(/\W/g, '')})`);
  const node = svg.append('g').selectAll('g').data(nodes).join('g').attr('class', (n) => `node${o.off?.(n.p) ? ' off' : ''}`).attr('transform', (n) => `translate(${n.x},${n.y})`).attr('tabindex', 0).attr('role', 'button').attr('aria-label', (n) => o.name(n.p)).style('--c', (n) => o.color(n.p));
  node.append('circle').attr('class', 'shape').attr('r', 5.5);
  node.append('text').attr('class', 'lab').attr('x', 9).attr('y', 4).text((n) => o.name(n.p) + (n.p.born ? ` ${n.p.born}` : ''));
  const mark = () => {
    const up = sel ? closure(sel, parents, 't') : null, down = sel ? closure(sel, kids, 's') : null;
    node.classed('dim', (n) => !!sel && !(up.has(n.id) || down.has(n.id))).classed('on', (n) => n.id === sel);
    const hot = (e) => !!sel && ((up.has(e.t) && up.has(e.s)) || (down.has(e.t) && down.has(e.s)));
    edge.classed('dim', (e) => !!sel && !hot(e)).classed('hot', hot);
  };
  const pick = (q) => { sel = sel === q ? null : q; mark(); o.onSelect(sel); };
  node.on('click', (e, n) => pick(n.id)).on('keydown', (e, n) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n.id); } });
  svg.on('click', (e) => { if (e.target === svg.node()) { sel = null; mark(); o.onSelect(null); } });
  mark();
  return { select: (q) => { sel = q; mark(); o.onSelect(sel); } };
};
// Roots of the links as nested lists (each person once per path)
MQ.treeList = (people, links, o) => {
  const byQ = new Map(people.map((p) => [p.qid, p])), kids = new Map(), parents = new Map();
  for (const l of links) { (kids.get(l.t) ?? kids.set(l.t, []).get(l.t)).push(l); (parents.get(l.s) ?? parents.set(l.s, []).get(l.s)).push(l); }
  const roots = [...new Set(links.flatMap((l) => [l.t, l.s]))].filter((q) => !(parents.get(q) ?? []).length).sort((a, b) => (byQ.get(a).born ?? 9999) - (byQ.get(b).born ?? 9999));
  const done = new Set(); // a person with several teachers is expanded once, under the first; elsewhere only named
  const item = (q, l, path) => {
    const p = byQ.get(q), again = done.has(q); done.add(q);
    const c = again ? [] : (kids.get(q) ?? []).filter((x) => !path.has(x.s));
    return `<li><span class="who"><i class="dot" style="--c:${o.color(p)}"></i><b>${esc(o.name(p))}</b> <span class="yr">${MQ.yrs(p)}</span>${again ? '<span class="link">↑</span>' : ''}${l ? `<span class="link">${l.src === 'text' ? '◦' : '●'}</span>` : ''}</span>${c.length ? `<ul>${c.map((x) => item(x.s, x, new Set([...path, q]))).join('')}</ul>` : ''}</li>`;
  };
  return roots.map((q) => `<div><ul>${item(q, null, new Set())}</ul></div>`).join('');
};
})();
