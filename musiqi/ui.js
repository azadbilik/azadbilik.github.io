// Shared script of the music sub-pages (bestekarlar, caz, estrada): language switch, a lane timeline, a master→student / who-played-with-whom network (shared/graph.js)
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
      const w = i.bare ? 6 : (i.label.length + (i.sub ? i.sub.length + 1 : 0)) * 5.6 + 12, x0 = X(i.x0), x1 = i.x1 != null ? X(i.x1) : x0, end = x1 + 6 + w;
      let tr = ends.findIndex((e) => e + 6 < x0 - 6);
      if (tr < 0) { tr = ends.length; ends.push(0); }
      ends[tr] = end; return { i, tr, x0, x1 };
    });
    const h = Math.max(1, ends.length) * TR + PAD * 2 + 14;
    body.push(`<rect class="lane" x="0" y="${y}" width="${W}" height="${h - 2}"/><text class="lanelab" x="8" y="${y + 15}">${esc(lane.label)}</text>`);
    for (const p of placed) {
      const cy = y + PAD + 14 + p.tr * TR + 6, i = p.i, on = o.selected === i.id;
      const shape = i.x1 != null ? `<rect class="shape span${i.dead ? ' dead' : ''}" x="${p.x0}" y="${cy - 3.5}" width="${Math.max(3, p.x1 - p.x0)}" height="7" rx="3.5"/>` : `<circle class="shape" cx="${p.x0}" cy="${cy}" r="4.6"/>`;
      body.push(`<g class="ev${on ? ' on' : ''}${i.dim ? ' dim' : ''}" data-id="${esc(i.id)}" tabindex="0" role="button" aria-label="${esc(i.label)}" style="--c:${i.color}">${shape}${i.bare ? `<title>${esc(i.label)}</title>` : `<text class="lab" x="${(i.x1 != null ? p.x0 + 6 : p.x1 + 8)}" y="${cy + 3.5}">${esc(i.label)}${i.sub ? `<tspan class="lab s" dx="4">${esc(i.sub)}</tspan>` : ''}</text>`}<rect x="${p.x0 - 5}" y="${cy - 8}" width="${p.x1 - p.x0 + 10 + (i.bare ? 0 : 24 + (i.label.length * 5.6))}" height="16" fill="transparent"/></g>`);
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

// Network of people and links (t → s), drawn by the hub's shared graph view (/shared/graph.js: sigma.js over
// graphology, ELK layered or ForceAtlas2). Resolves to the graph's API (focus, clear, setFilter, setStrings, relabel...).
// o = { stage, people, links, name(p), color(p), off(p), panel, onSelect(q), layout: 'layered'|'force', toggle,
//       lineage: true (a node lights up all its masters and students, not only its neighbours), linkOn(l): the page's link filter,
//       edge: {...more createGraph options} }
MQ.network = async (o) => {
  const { createGraph } = await import('/shared/graph.js');
  const byQ = new Map(o.people.map((p) => [p.qid, p])), kids = new Map(), parents = new Map();
  for (const l of o.links) { (kids.get(l.t) ?? kids.set(l.t, []).get(l.t)).push(l); (parents.get(l.s) ?? parents.set(l.s, []).get(l.s)).push(l); }
  const closure = (q, map, key) => { const out = new Set([q]), st = [q]; while (st.length) for (const l of map.get(st.pop()) ?? []) if (on(l) && !out.has(l[key])) { out.add(l[key]); st.push(l[key]); } return out; };
  const ids = [...new Set(o.links.flatMap((l) => [l.t, l.s]))].filter((q) => byQ.has(q));
  const deg = (q) => (kids.get(q)?.length ?? 0) + (o.layout === 'force' ? parents.get(q)?.length ?? 0 : 0);
  const eid = (l, i) => `${l.t}>${l.s}#${i}`;
  const on = (l) => (o.linkOn ? o.linkOn(l) : true);   // the page's filter (e.g. Wikidata / text chips)
  return createGraph(o.stage, {
    nodes: ids.map((q) => ({ ...byQ.get(q), id: q })),
    edges: o.links.map((l, i) => ({ ...l, id: eid(l, i), source: l.t, target: l.s })),
    layout: o.layout ?? 'layered', direction: 'RIGHT', toggle: o.toggle ?? true, edgeClick: false,
    label: (p) => o.name(p), searchText: (p) => [p.az, p.ru, p.en].join(' '), color: o.color, hollow: (p) => !!o.off?.(p),
    size: (p) => (o.layout === 'force' ? 4.5 + 1.6 * Math.sqrt(deg(p.qid)) : 4.2 + 1.5 * Math.sqrt(deg(p.qid))),
    dashed: (e) => e.src === 'text', dash: [3, 3.5], edgeWidth: (e) => (e.src === 'text' ? 1 : 1.45), edgeAlpha: 0.65, labelSize: 12,
    edgeColor: (e) => (e.src === 'text' ? 'var(--muted)' : 'var(--ink)'), litColor: 'node', minLabel: 9.5, trimLabels: true, start: 'main', panHint: true,
    focus: o.lineage === false ? undefined : (q) => {
      const up = closure(q, parents, 't'), down = closure(q, kids, 's'), es = new Set();
      o.links.forEach((l, i) => { if (on(l) && ((up.has(l.t) && up.has(l.s)) || (down.has(l.t) && down.has(l.s)))) es.add(eid(l, i)); });
      return { nodes: new Set([...up, ...down]), edges: es };
    },
    tooltip: (p) => `<div class="tt"><b>${esc(o.name(p))}</b>${MQ.yrs(p) ? `<span>${esc(MQ.yrs(p))}</span>` : ''}</div>`,
    panel: o.panel,
    onSelect: (f) => o.onSelect?.(f?.type === 'node' ? f.id : null),
    ...(o.edge || {}),
  });
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
