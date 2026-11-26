// shared/graph.js — the hub's graph view: a network or a lineage you can pan, zoom, search and click.
//
// Nodes are drawn by sigma.js 3 (WebGL) over a graphology graph; edges and labels on two canvases of
// our own above and below them (curved arrows, dashes, halos, labels that never overlap). Networks
// are laid out by ForceAtlas2, lineages by ELK's layered algorithm (elkjs, loaded only when needed).
//
//   import { createGraph } from '/shared/graph.js';      // with <link rel="stylesheet" href="/shared/graph.css">
//   const g = createGraph(container, {          // returns at once; g.ready resolves when the layout has settled
//     nodes: [{ id, ... }], edges: [{ id?, source, target, ... }],   // the page's own objects, kept as given
//     label: (n) => 'Füzuli',              // text beside the node
//     color: (n) => 'var(--k16)',          // any CSS colour or var(); re-read when the theme switches
//     size:  (n) => 6,                     // radius: px at the default zoom (force), layout units (layered)
//     hollow: (n) => false,                // drawn as a ring (e.g. people not on the map)
//     edgeColor: (e) => null,              // default: the source node's colour
//     dashed: (e) => false, weak: (e) => false, weight: (e) => 1,
//     layout: 'force' | 'layered',         // ForceAtlas2, or ELK layered (a tree / lineage)
//     seedX: (n) => 1580,                  // force: a number per node (a year) read left to right as a soft force
//     direction: 'RIGHT' | 'DOWN',         // layered: masters left of / above their students
//     positions: { id: {x, y} },           // settled positions from an earlier run (g.positions()): no layout
//     focus: (id, g) => ({ nodes, edges }),// what a focused node lights up (default: itself, neighbours, its edges)
//     searchText: (n) => '',               // more text the search box matches (other languages' names)
//     tooltip: (n) => '<b>…</b>',          // HTML on hover
//     panel: element,                      // the page's info card: moved into a side panel (a bottom sheet on a phone)
//     onSelect: ({ type: 'node'|'edge', id, data } | null) => {},   // a click; null when cleared
//     strings: { search, fit, zoomIn, zoomOut, close, force, layered },
//     toggle: true,                        // a force / layered switch in the toolbar
//     edgeClick: true,                     // edges can be hovered and clicked (onSelect type 'edge')
//     shape: (n) => 'circle',              // or 'square' | 'diamond' | 'triangle' (drawn by us, filled; hollow() makes it an outline)
//     edgeWidth: (e) => 1,                 // a line's width relative to the default (1 px; lit and hovered lines scale too)
//     dash: [4, 3],                        // the dashed() lines' pattern, px at width 1
//     litColor: 'edge' | 'node',           // 'node': lines lit by a focused node take that node's colour at full strength
//     labelRank: (n) => size,              // which labels win a collision (higher first); below 0: shown only on focus
//     minLabel: 10.5,                      // layered: the smallest label size, px, however far out the zoom
//     trimLabels: false,                   // layered: a label that would collide is shortened with … to fit, not dropped
//     start: 'all' | 'main',               // layered: open on the largest lineage ('main'), the fit button shows all;
//                                          //   on a stage narrower than the tree it opens on the tree's left part, at a readable height
//     panHint: false,                      // a "drag to see more" note while the start view shows part of the tree (strings.pan)
//     lod: auto,                           // large-graph mode, on by itself past 4,000 nodes or 8,000 edges: the lines are
//                                          //   drawn by sigma on the GPU (straight, no arrows; edgeAlpha, lodEdgeWidth px),
//                                          //   only the lit ones by us (curved, arrows); labels are tried for the
//                                          //   labelCandidates (700) best-ranked nodes on screen; edges are picked among lit ones
//     reshape: false,                      // positions given: widen or heighten them towards the stage's shape (up to stretch)
//     fill: false,                         // a network opens (and the fit button frames it) filling the stage's own shape, not
//                                          //   a square fitted to its shorter side (a phone's tall stage, a wide desktop one)
//     notes: () => [{ x, y, text }],       // quiet captions at graph positions (a block's title), drawn on the label layer
//     revealable: (n) => false,            // search also finds these nodes while a filter hides them; picking one calls
//     onReveal: (n) => {},                 //   onReveal first (the page shows it, e.g. switches a group on), then flies there
//     keepIsolated: false,                 // with an edge filter, a node the node filter keeps stays even with no line on show
//   });
//   g.focus(id) / g.focusEdge(id) / g.clear(); g.search('füz') → [{ id, label }]; g.setFilter(nodeFn, edgeFn);
//   g.fit(); g.zoom(±1); g.setLayout('force'|'layered'); g.relabel(); g.setStrings({...}); g.positions(); g.destroy()
//
// Interaction: hover a node and it and its neighbours stay, the rest fades; click pins that and opens the
// panel; Esc, the panel's close or a click on empty space clears. Drag a node (others follow while the
// layout runs; it stays where dropped). Wheel / pinch zooms; labels show by importance and more appear as
// you zoom in. Filters hide nodes and edges without moving anything. prefers-reduced-motion: the layout
// is computed, then shown, and the camera jumps instead of flying.
//
// Determinism: the force layout starts from seeded positions (seedX, or a hash of the id) and runs a
// fixed number of ForceAtlas2 iterations in steps on the main thread, so the picture is the same on
// every load (the library's web worker stops on time, not on a count, so it would differ per load).
//
// Libraries (jsDelivr, pinned): sigma 3.0.3, graphology 0.26.0, graphology-layout-forceatlas2 0.10.1
// (MIT), elkjs 0.11.1 (EPL-2.0).
import Graph from 'https://cdn.jsdelivr.net/npm/graphology@0.26.0/+esm';
import Sigma from 'https://cdn.jsdelivr.net/npm/sigma@3.0.3/+esm';
import forceAtlas2 from 'https://cdn.jsdelivr.net/npm/graphology-layout-forceatlas2@0.10.1/+esm';

const ELK_URL = 'https://cdn.jsdelivr.net/npm/elkjs@0.11.1/lib/elk.bundled.js/+esm';
const STRINGS = {
  az: { search: 'Axtar…', fit: 'Hamısı', zoomIn: 'Yaxınlaşdır', zoomOut: 'Uzaqlaşdır', close: 'Bağla', force: 'Şəbəkə', layered: 'Ağac', none: 'Tapılmadı', pan: 'Sürüşdürün: ağac sağa davam edir →' },
  ru: { search: 'Поиск…', fit: 'Всё', zoomIn: 'Приблизить', zoomOut: 'Отдалить', close: 'Закрыть', force: 'Сеть', layered: 'Дерево', none: 'Не найдено', pan: 'Листайте: дерево продолжается вправо →' },
  en: { search: 'Search…', fit: 'Fit', zoomIn: 'Zoom in', zoomOut: 'Zoom out', close: 'Close', force: 'Network', layered: 'Tree', none: 'Nothing found', pan: 'Drag: the tree goes on to the right →' },
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Search folds case and diacritics, and Azerbaijani letters to their Latin look-alikes
export const fold = (s) => String(s ?? '').toLocaleLowerCase('az').replace(/ə/g, 'e').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ё/g, 'е');
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) / 4294967296; };

// ---- colours: CSS to [r, g, b, a]
function parseColor(c) {
  let m = /^rgba?\(([^)]+)\)/.exec(c);
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
  m = /^color\(srgb ([^)]+)\)/.exec(c);
  if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]; }
  return [128, 128, 128, 1];
}
const rgba = (c, a = c[3]) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(3)})`;
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t).concat(1);

export function createGraph(container, o) {
  const lang = () => (['az', 'ru', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'az');
  let strings = { ...STRINGS[lang()], ...(o.strings || {}) };
  const opt = {
    label: (n) => n.label ?? n.id, color: () => 'var(--accent)', size: () => 5, hollow: () => false,
    edgeColor: () => null, dashed: () => false, weak: () => false, weight: () => 1,
    layout: 'force', direction: 'RIGHT', labelSize: 12, edgeAlpha: 0.4, arrows: true, curve: 0.2, iterations: null,
    ...o,
  };
  let layoutMode = opt.layout;

  // ---- DOM
  container.classList.add('gx');
  container.innerHTML = '';
  delete container.dataset.ready;
  const stage = el('div', 'gx-stage');
  const bar = el('div', 'gx-bar');
  const tools = el('div', 'gx-tools');
  const seg = el('div', 'gx-seg'); seg.setAttribute('role', 'group');
  const find = el('div', 'gx-find');
  bar.append(find, seg, tools);
  const tip = el('div', 'gx-tip'); tip.hidden = true;
  const panel = el('aside', 'gx-panel'); panel.hidden = true;
  const probe = el('span'); probe.style.display = 'none';
  container.append(stage, bar, tip, panel, probe);
  find.innerHTML = `<input type="search" class="gx-q" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list"><ul class="gx-hits" role="listbox" hidden></ul>`;
  const q = find.querySelector('.gx-q'), hits = find.querySelector('.gx-hits');
  const listId = `gx-hits-${Math.random().toString(36).slice(2, 8)}`; hits.id = listId; q.setAttribute('aria-controls', listId);
  panel.innerHTML = `<button type="button" class="gx-close">×</button><div class="gx-body"></div>`;
  const body = panel.querySelector('.gx-body');
  const home = opt.panel && document.createComment('gx-panel');   // where the card goes back on destroy
  if (opt.panel) { opt.panel.replaceWith(home); body.append(opt.panel); }

  // ---- data
  const byId = new Map(), edgeById = new Map();
  const graph = new Graph({ type: 'directed', multi: false, allowSelfLoops: false });
  for (const n of opt.nodes) { byId.set(String(n.id), n); graph.addNode(String(n.id), { x: 0, y: 0, size: 4 }); }
  opt.edges.forEach((e, i) => {
    const s = String(e.source), t = String(e.target);
    if (s === t || !graph.hasNode(s) || !graph.hasNode(t)) return;
    const id = String(e.id ?? `e${i}`);
    if (graph.hasEdge(s, t)) return;
    graph.addDirectedEdgeWithKey(id, s, t, { weight: opt.weight(e) });
    edgeById.set(id, e);
  });

  // ---- theme
  let C = {}; const ccache = new Map();
  const css = (c) => {
    if (!c) return null;
    if (c.startsWith('--')) c = `var(${c})`;
    if (!ccache.has(c)) { probe.style.color = ''; probe.style.color = c; ccache.set(c, parseColor(getComputedStyle(probe).color)); }
    return ccache.get(c);
  };
  const shapeOf = (n) => { const s = opt.shape?.(n); return s && s !== 'circle' ? s : null; };
  function readTheme() {
    ccache.clear();
    C = { paper: css('var(--paper)'), ink: css('var(--ink)'), muted: css('var(--muted)'), accent: css('var(--accent)') };
    const font = getComputedStyle(container).getPropertyValue('--sans').trim() || "'Inter', system-ui, sans-serif";
    C.font = font;
    graph.forEachNode((id) => {
      const n = byId.get(id), c = css(opt.color(n)), sh = shapeOf(n);
      // a shaped node is drawn by us (paint), sigma's disc only takes the pointer
      if (sh) graph.mergeNodeAttributes(id, { rgb: c, shape: sh, color: 'rgba(0,0,0,0)', faded: 'rgba(0,0,0,0)' });
      else graph.mergeNodeAttributes(id, { rgb: c, color: rgba(opt.hollow(n) ? C.paper : c), faded: rgba(mix(opt.hollow(n) ? C.paper : c, C.paper, 0.84)) });
    });
    graph.forEachEdge((id) => { const e = edgeById.get(id); graph.setEdgeAttribute(id, 'rgb', css(opt.edgeColor(e)) ?? null); });
    if (lod) graph.forEachEdge((id, a, s) => {
      // the GPU's lines: their colour at rest and when something else is lit, and width
      const e = edgeById.get(id), base = a.rgb ?? graph.getNodeAttribute(s, 'rgb'), al = opt.weak(e) ? opt.edgeAlpha * 0.5 : opt.edgeAlpha;
      // opaque, mixed into the paper: sigma blends premultiplied, so a translucent colour would come out pale
      graph.mergeEdgeAttributes(id, { ec: rgba(mix(base, C.paper, 1 - al)), ecf: rgba(mix(base, C.paper, 1 - Math.min(al, 0.05))), esz: (opt.lodEdgeWidth ?? 0.6) * (opt.edgeWidth ? opt.edgeWidth(e) : 1) });
    });
  }
  function sizes() {
    rankList = null; specialList = null;
    graph.forEachNode((id) => {
      const n = byId.get(id);
      graph.mergeNodeAttributes(id, { size: opt.size(n), label: opt.label(n), fold: fold(opt.label(n)), alt: opt.searchText ? fold(opt.searchText(n)) : '', hollow: !!opt.hollow(n) });
    });
  }

  // ---- state
  let pinned = null;              // { type: 'node'|'edge', id }
  let hovered = null, hoverEdge = null;
  let nodeFilter = null, edgeFilter = null;
  let lit = null;                 // { nodes: Set, edges: Set } of the focus on show
  let routes = null;              // layered: edge id -> [[x, y]...] cubic Bézier points in graph units
  let running = false, dragging = null, dragMoved = false, layoutGraph = null;
  const nodeOn = (id) => !nodeFilter || nodeFilter(byId.get(id));
  const edgeOn = (id) => { const [s, t] = graph.extremities(id); return nodeOn(s) && nodeOn(t) && (!edgeFilter || edgeFilter(edgeById.get(id))); };
  // a node shown by a filter but with no edge left on show is hidden too
  let visible = new Set();
  function computeVisible() {
    visible = new Set(); edgeVis = lod ? new Set() : null; rankList = null; specialList = null;
    graph.forEachEdge((id, a, s, t) => { if (edgeOn(id)) { visible.add(s); visible.add(t); edgeVis?.add(id); } });
    if (!edgeFilter || opt.keepIsolated) graph.forEachNode((id) => { if (nodeOn(id)) visible.add(id); });
  }
  // A large graph (lod): sigma draws the lines on the GPU, our canvas only the lit ones (curved, with arrows);
  // labels are tried for the highest-ranked nodes on screen only. Small graphs are drawn as before.
  const lod = opt.lod ?? (graph.order > 4000 || graph.size > 8000);
  let edgeVis = null, rankList = null;
  const rankOf = (id) => (opt.labelRank ? opt.labelRank(byId.get(id)) : graph.getNodeAttribute(id, 'size'));
  function ranked() {
    if (!rankList) { rankList = [...visible]; const r = new Map(rankList.map((id) => [id, rankOf(id)])); rankList.sort((a, b) => r.get(b) - r.get(a) || (a < b ? -1 : 1)); }
    return rankList;
  }
  let specialList = null;
  const specials = () => specialList ??= [...visible].filter((id) => { const a = graph.getNodeAttributes(id); return a.hollow || a.shape; });

  function focusOf(f) {
    if (!f) return null;
    if (f.type === 'edge') { const [s, t] = graph.extremities(f.id); return { nodes: new Set([s, t]), edges: new Set([f.id]), center: null }; }
    if (opt.focus) { const r = opt.focus(f.id, api); return { nodes: new Set([...r.nodes].map(String)), edges: new Set([...r.edges].map(String)), center: f.id }; }
    const nodes = new Set([f.id]), edges = new Set();
    graph.forEachEdge(f.id, (e, a, s, t) => { if (!edgeOn(e)) return; edges.add(e); nodes.add(s); nodes.add(t); });
    return { nodes, edges, center: f.id };
  }
  // A large graph fades the rest on the GPU only once the pointer rests on a node (a full re-colour costs a frame
  // or more there): sweeping across nodes lights their lines and labels at once, without that cost
  let gpuLit = false, fadeT = 0;
  const relight = () => {
    lit = focusOf(hovered ? { type: 'node', id: hovered } : pinned);
    clearTimeout(fadeT);
    if (lod && !pinned && (hovered || !gpuLit)) {
      renderer.scheduleRender();
      if (hovered) fadeT = setTimeout(() => { if (hovered) renderer.refresh({ skipIndexation: true }); }, 160);
      return;
    }
    renderer.refresh({ skipIndexation: true });
  };

  // ---- sigma
  sizes(); readTheme(); computeVisible();
  const layered = () => layoutMode === 'layered';
  const renderer = new Sigma(graph, stage, {
    renderLabels: false, renderEdgeLabels: false, enableEdgeEvents: false, allowInvalidContainer: true,
    zIndex: true, stagePadding: 52, minCameraRatio: lod ? 0.008 : 0.06, maxCameraRatio: 4, labelFont: C.font,
    defaultDrawNodeHover: drawRing,
    nodeReducer: (id, a) => {
      gpuLit = !!lit;
      const r = { ...a };
      if (!visible.has(id)) { r.hidden = true; return r; }
      if (lit && !lit.nodes.has(id)) { r.color = a.faded; r.zIndex = 0; } else r.zIndex = lit ? 2 : 1;
      if (pinned?.type === 'node' && pinned.id === id) r.highlighted = true;
      return r;
    },
    edgeReducer: (id, a) => (!lod || !edgeVis.has(id) || lit?.edges.has(id) ? { ...a, hidden: true }
      : { ...a, hidden: false, color: lit ? a.ecf : a.ec, size: a.esz, zIndex: 0 }),
  });
  applyScale();
  const ectx = context('gx-edges', { beforeLayer: 'nodes' });
  const lctx = context('gx-labels', { afterLayer: 'nodes' });
  function context(id, where) { renderer.createCanvasContext(id, where); return renderer.getCanvases()[id].getContext('2d'); }
  renderer.resize(true);
  function applyScale() {
    // a lineage is a diagram: everything scales with the zoom; a network keeps its nodes about the same size
    renderer.setSettings(layered()
      ? { itemSizesReference: 'positions', zoomToSizeRatioFunction: (r) => r }
      : { itemSizesReference: 'screen', zoomToSizeRatioFunction: (r) => Math.max(0.6, Math.sqrt(r)) });
  }
  function drawRing(ctx, d) {
    ctx.beginPath(); ctx.arc(d.x, d.y, d.size + 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.ink); ctx.stroke();
  }

  // ---- edges and labels, drawn after each frame of sigma's
  const measure = new Map();
  const textW = (ctx, s, font) => { const k = font + '|' + s; let w = measure.get(k); if (w == null) { ctx.font = font; w = ctx.measureText(s).width; measure.set(k, w); } return w; };
  const short = (s) => (s.length > 34 ? `${s.slice(0, 32).trimEnd()}…` : s);
  renderer.on('afterRender', paint);
  function paint() {
    const { width: W, height: H } = renderer.getDimensions();
    ectx.clearRect(0, 0, W, H); lctx.clearRect(0, 0, W, H);
    const P = new Map();
    const at = (id) => {
      if (P.has(id) || !visible.has(id)) return P.get(id);
      const d = renderer.getNodeDisplayData(id); if (!d) return;
      const v = renderer.framedGraphToViewport(d), p = { x: v.x, y: v.y, r: renderer.scaleSize(d.size) };
      P.set(id, p); return p;
    };
    if (!lod) graph.forEachNode(at);
    else {
      // only what can be drawn: the lit nodes, the rings and shapes, and the best-ranked on screen
      if (lit) for (const id of lit.nodes) at(id);
      if (hovered) at(hovered);
      for (const id of specials()) at(id);
      const want = opt.labelCandidates ?? 700; let got = 0;
      for (const id of ranked()) {
        if (got >= want) break;
        const p = at(id); if (p && p.x > -40 && p.x < W + 40 && p.y > -20 && p.y < H + 20) got++; else P.delete(id);
      }
      if (lit) for (const id of lit.nodes) at(id);
    }
    const k = pxPerUnit();
    // edges: one path per style
    const buckets = new Map();
    const bucket = (key) => buckets.get(key) ?? buckets.set(key, { line: new Path2D(), head: new Path2D() }).get(key);
    const eachEdge = lod
      ? (fn) => { const on = new Set(lit ? lit.edges : []); if (hoverEdge) on.add(hoverEdge); for (const id of on) if (graph.hasEdge(id)) fn(id, graph.getEdgeAttributes(id), graph.source(id), graph.target(id)); }
      : (fn) => graph.forEachEdge(fn);
    eachEdge((id, a, s, t) => {
      if (!edgeOn(id)) return;
      const ps = P.get(s), pt = P.get(t); if (!ps || !pt) return;
      const e = edgeById.get(id), on = lit?.edges.has(id), hot = hoverEdge === id || (pinned?.type === 'edge' && pinned.id === id);
      const nodeLit = opt.litColor === 'node' && on && lit?.center != null;
      const base = nodeLit ? graph.getNodeAttribute(lit.center, 'rgb') : a.rgb ?? graph.getNodeAttribute(s, 'rgb');
      const alpha = hot || nodeLit ? 1 : on ? 0.95 : lit ? 0.06 : opt.weak(e) ? opt.edgeAlpha * 0.5 : opt.edgeAlpha;
      const zk = layered() ? Math.min(1, Math.max(0.35, k)) : 1;   // a zoomed-out diagram thins its lines and arrows
      const w = +((hot ? 2.6 : on ? 1.8 : 1) * zk * (opt.edgeWidth ? opt.edgeWidth(e) : 1)).toFixed(2);
      const key = `${rgba(base, alpha)}|${w}|${opt.dashed(e) ? 1 : 0}`;
      const b = bucket(key);
      let tipX, tipY, ux, uy;
      if (layered() && routes?.has(id)) {
        const pts = routes.get(id).map(([x, y]) => renderer.graphToViewport({ x, y }));
        b.line.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i + 2 < pts.length; i += 3) b.line.bezierCurveTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, pts[i + 2].x, pts[i + 2].y);
        const L = pts[pts.length - 1];
        let j = pts.length - 2; while (j > 0 && Math.hypot(L.x - pts[j].x, L.y - pts[j].y) < 0.5) j--;
        const dx = L.x - pts[j].x, dy = L.y - pts[j].y, dl = Math.hypot(dx, dy) || 1;
        tipX = L.x; tipY = L.y; ux = dx / dl; uy = dy / dl;
      } else {
        const dx = pt.x - ps.x, dy = pt.y - ps.y, len = Math.hypot(dx, dy) || 1;
        const cx = (ps.x + pt.x) / 2 - dy * opt.curve, cy = (ps.y + pt.y) / 2 + dx * opt.curve;
        const ex = pt.x - cx, ey = pt.y - cy, el2 = Math.hypot(ex, ey) || 1;
        ux = ex / el2; uy = ey / el2;
        tipX = pt.x - ux * (pt.r + 1.5); tipY = pt.y - uy * (pt.r + 1.5);
        if (len < pt.r + ps.r + 2) return;
        const back = opt.arrows ? Math.min(4 + w * 1.5, len * 0.3) : 0;
        // a large graph draws its lit lines above the faded nodes, so they start at the source's rim
        const sd = lod ? (ps.r + 1) / (Math.hypot(cx - ps.x, cy - ps.y) || 1) : 0;
        b.line.moveTo(ps.x + (cx - ps.x) * sd, ps.y + (cy - ps.y) * sd); b.line.quadraticCurveTo(cx, cy, tipX - ux * back * 0.6, tipY - uy * back * 0.6);
      }
      if (opt.arrows && (on || hot || !lit)) {
        const L = ((on || hot ? 7 : 5) + w) * zk, Wd = L * 0.42;
        b.head.moveTo(tipX, tipY);
        b.head.lineTo(tipX - ux * L - uy * Wd, tipY - uy * L + ux * Wd);
        b.head.lineTo(tipX - ux * L + uy * Wd, tipY - uy * L - ux * Wd);
        b.head.closePath();
      }
    });
    // faint first, so lit edges draw on top
    const order = [...buckets.entries()].sort((x, y) => alphaOf(x[0]) - alphaOf(y[0]));
    const ex = lod ? lctx : ectx;
    for (const [key, b] of order) {
      const [col, w, dash] = key.split('|');
      ex.strokeStyle = col; ex.fillStyle = col; ex.lineWidth = +w;
      const dp = opt.dash ?? [4, 3];
      ex.setLineDash(dash === '1' ? [dp[0] * Math.max(1, +w * 0.7), dp[1] * Math.max(1, +w * 0.7)] : []);
      ex.stroke(b.line); ex.setLineDash([]); ex.fill(b.head);
    }
    // hollow nodes: a ring in their colour
    for (const [id, p] of P) {
      const a = graph.getNodeAttributes(id); if (!a.hollow) continue;
      const faded = lit && !lit.nodes.has(id);
      lctx.beginPath(); lctx.arc(p.x, p.y, Math.max(1, p.r - 0.9), 0, Math.PI * 2);
      if (a.shape) continue;
      lctx.lineWidth = 1.8; lctx.strokeStyle = rgba(faded ? mix(a.rgb, C.paper, 0.84) : a.rgb); lctx.stroke();
    }
    // shaped nodes: a square, a diamond or a triangle of about the disc's area, on a paper halo
    for (const [id, p] of P) {
      const a = graph.getNodeAttributes(id); if (!a.shape) continue;
      const faded = lit && !lit.nodes.has(id), col = rgba(faded ? mix(a.rgb, C.paper, 0.84) : a.rgb), r = p.r;
      lctx.beginPath();
      if (a.shape === 'square') { const h = r * 0.9; lctx.rect(p.x - h, p.y - h, 2 * h, 2 * h); }
      else if (a.shape === 'diamond') { const h = r * 1.2; lctx.moveTo(p.x, p.y - h); lctx.lineTo(p.x + h, p.y); lctx.lineTo(p.x, p.y + h); lctx.lineTo(p.x - h, p.y); lctx.closePath(); }
      else { const h = r * 1.25; lctx.moveTo(p.x, p.y - h); lctx.lineTo(p.x + h * 0.95, p.y + h * 0.62); lctx.lineTo(p.x - h * 0.95, p.y + h * 0.62); lctx.closePath(); }
      lctx.lineJoin = 'round';
      if (a.hollow) { lctx.fillStyle = rgba(C.paper); lctx.fill(); lctx.lineWidth = 1.8; lctx.strokeStyle = col; lctx.stroke(); }
      else { lctx.lineWidth = 1.5; lctx.strokeStyle = rgba(C.paper); lctx.stroke(); lctx.fillStyle = col; lctx.fill(); }
    }
    labels(P, k, W, H);
    if (opt.notes) {
      lctx.font = `500 11.5px ${C.font}`; lctx.textBaseline = 'alphabetic'; lctx.fillStyle = rgba(C.muted);
      for (const n of opt.notes() || []) { const v = renderer.graphToViewport({ x: n.x, y: n.y }); lctx.fillText(n.text, v.x, v.y); }
    }
  }
  const alphaOf = (key) => +/,([\d.]+)\)\|/.exec(key)?.[1] || 0;
  function pxPerUnit() { const a = renderer.graphToViewport({ x: 0, y: 0 }), b = renderer.graphToViewport({ x: 1, y: 0 }); return Math.hypot(b.x - a.x, b.y - a.y); }

  function labels(P, k, W, H) {
    const base = opt.labelSize;
    const scaled = layered() ? base * k : base;
    const placed = [];
    const hit = (b, self) => placed.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
      || discs.some((d) => d.id !== self && d.r > P.get(self).r && b[0] < d.x + d.r && b[2] > d.x - d.r && b[1] < d.y + d.r && b[3] > d.y - d.r);
    // in a network a label keeps off the nodes bigger than its own (a diagram has room for its labels)
    const discs = [];
    if (!layered()) for (const [id, p] of P) if (p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20) discs.push({ id, x: p.x, y: p.y, r: p.r + 1 });
    const center = lit?.center ?? (pinned?.type === 'node' ? pinned.id : null);
    const forced = new Set(lit ? lit.nodes : []); if (hovered) forced.add(hovered);
    const ids = [...P.keys()];
    const size = opt.labelRank ? (id) => opt.labelRank(byId.get(id)) : (id) => graph.getNodeAttribute(id, 'size');
    ids.sort((a, b) => (b === center) - (a === center) || forced.has(b) - forced.has(a) || size(b) - size(a) || (a < b ? -1 : 1));
    lctx.lineJoin = 'round'; lctx.textBaseline = 'middle';
    const below = layered() && opt.direction === 'DOWN';
    for (const id of ids) {
      const p = P.get(id), f = forced.has(id);
      if (!f && opt.labelRank && size(id) < 0) continue;
      // a diagram's labels grow and shrink with it, but never below a readable size: those that would then
      // collide wait for a closer zoom
      const fs = Math.min(Math.max(scaled, layered() ? opt.minLabel ?? 10.5 : scaled), base * 1.5);
      let text = short(graph.getNodeAttribute(id, 'label') || '');
      if (!text) continue;
      const weight = id === center ? 650 : 500;
      const font = `${weight} ${fs.toFixed(1)}px ${C.font}`;
      let w = textW(lctx, text, font); const h = fs * (layered() ? 1.1 : 1.25);
      if (opt.trimLabels && layered() && !below) {
        // a lineage label that would run into the next one is cut short (at least 6 letters and …) rather than dropped
        const x = p.x + p.r + 4, y = p.y, pad = f ? 1 : 3;
        const room = placed.filter((o) => o[0] >= x && o[1] < y + h / 2 && o[3] > y - h / 2).reduce((m, o) => Math.min(m, o[0] - pad - 2 - x), Infinity);
        if (w > room) {
          let cut = text.replace(/…$/, '');
          while (cut.length > 6 && textW(lctx, `${cut}…`, font) > room) cut = cut.slice(0, -1).trimEnd();
          if (cut.length > 6 || textW(lctx, `${cut}…`, font) <= room) { text = `${cut}…`; w = textW(lctx, text, font); }
        }
      }
      const pad = f ? 1 : 3;
      const cands = below
        ? [[p.x - w / 2, p.y + p.r + 2 + h / 2], [p.x + p.r + 4, p.y]]
        : [[p.x + p.r + 4, p.y], [p.x - p.r - 4 - w, p.y], [p.x - w / 2, p.y - p.r - 2 - h / 2], [p.x - w / 2, p.y + p.r + 2 + h / 2]];
      // a label tries its own side first, then (a focused one, or one cut off by the edge) the others
      let spot = null;
      for (const [i, [x, y]] of cands.entries()) {
        const b = [x - pad, y - h / 2 - pad / 2, x + w + pad, y + h / 2 + pad / 2];
        // a network's label moves away from the stage's edge; a diagram's keeps its side and is cut
        const out = layered() ? b[2] < 0 || b[0] > W || b[3] < 0 || b[1] > H : b[0] < 0 || b[2] > W || b[1] < 0 || b[3] > H;
        if (!out && !hit(b, id)) { spot = [x, y, b]; break; }
        // a small network (under 100 on show) tries every side for every label; a big one only the first two
        if (!f && (layered() || (P.size >= 100 && (!out || i >= 1)))) break;
      }
      if (!spot) continue;
      placed.push(spot[2]);
      const faded = lit && !lit.nodes.has(id);
      lctx.font = font;
      lctx.globalAlpha = faded ? 0.38 : 1;
      lctx.lineWidth = Math.max(2.5, fs * 0.28); lctx.strokeStyle = rgba(C.paper, 0.9);
      lctx.strokeText(text, spot[0], spot[1]);
      lctx.fillStyle = rgba(C.ink); lctx.fillText(text, spot[0], spot[1]);
      lctx.globalAlpha = 1;
    }
  }

  // ---- edge picking (edges are ours, not sigma's)
  function edgeAt(x, y) {
    let best = null, bd = 6;
    const P = (id) => { const d = renderer.getNodeDisplayData(id); return d && renderer.framedGraphToViewport(d); };
    // a large graph picks among the lit lines only (a hover over tens of thousands would stall the pointer)
    const each = lod ? (fn) => { for (const id of lit?.edges ?? []) if (graph.hasEdge(id)) fn(id, null, graph.source(id), graph.target(id)); } : (fn) => graph.forEachEdge(fn);
    each((id, a, s, t) => {
      if (!edgeOn(id)) return;
      let pts;
      if (layered() && routes?.has(id)) pts = sampleBez(routes.get(id).map(([u, v]) => renderer.graphToViewport({ x: u, y: v })));
      else {
        const ps = P(s), pt = P(t); if (!ps || !pt) return;
        const dx = pt.x - ps.x, dy = pt.y - ps.y, cx = (ps.x + pt.x) / 2 - dy * opt.curve, cy = (ps.y + pt.y) / 2 + dx * opt.curve;
        pts = []; for (let i = 0; i <= 16; i++) { const u = i / 16, m = 1 - u; pts.push({ x: m * m * ps.x + 2 * m * u * cx + u * u * pt.x, y: m * m * ps.y + 2 * m * u * cy + u * u * pt.y }); }
      }
      for (let i = 1; i < pts.length; i++) { const d = segDist(x, y, pts[i - 1], pts[i]); if (d < bd) { bd = d; best = id; } }
    });
    return best;
  }
  const sampleBez = (p) => { const out = [p[0]]; for (let i = 1; i + 2 < p.length; i += 3) for (let j = 1; j <= 8; j++) { const u = j / 8, m = 1 - u, a = p[i - 1], b = p[i], c = p[i + 1], d = p[i + 2]; out.push({ x: m * m * m * a.x + 3 * m * m * u * b.x + 3 * m * u * u * c.x + u * u * u * d.x, y: m * m * m * a.y + 3 * m * m * u * b.y + 3 * m * u * u * c.y + u * u * u * d.y }); } return out; };
  const segDist = (x, y, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l)); return Math.hypot(x - a.x - u * dx, y - a.y - u * dy); };

  // ---- interaction
  const camera = renderer.getCamera();
  const dur = (ms) => (still() ? 0 : ms);
  renderer.on('enterNode', ({ node }) => { if (dragging) return; hovered = node; stage.style.cursor = 'pointer'; relight(); showTip(node); });
  renderer.on('leaveNode', () => { if (dragging) return; hovered = null; stage.style.cursor = ''; relight(); tip.hidden = true; });
  renderer.on('clickNode', ({ node }) => { if (dragMoved) return; select({ type: 'node', id: node }, false); });
  renderer.on('clickStage', ({ event }) => {
    const n = nodeAt(event.x, event.y, event.original?.type?.startsWith('touch') ? 18 : 8);
    if (n) return select({ type: 'node', id: n }, false);
    const e = opt.edgeClick === false ? null : edgeAt(event.x, event.y);
    if (e) select({ type: 'edge', id: e }, false); else clear();
  });
  function nodeAt(x, y, slack) {
    let best = null, bd = Infinity;
    graph.forEachNode((id) => {
      if (!visible.has(id)) return;
      const d = renderer.getNodeDisplayData(id), v = renderer.framedGraphToViewport(d), dist = Math.hypot(v.x - x, v.y - y) - renderer.scaleSize(d.size);
      if (dist < slack && dist < bd) { bd = dist; best = id; }
    });
    return best;
  }
  renderer.on('downNode', ({ node, event }) => {
    if (layered()) return;
    dragging = node; dragMoved = false; dragStart = [event.x, event.y];
    if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
  });
  let dragStart = null;
  renderer.on('moveBody', ({ event }) => {
    if (dragging) {
      if (!dragMoved && Math.hypot(event.x - dragStart[0], event.y - dragStart[1]) < 4) return;
      dragMoved = true; tip.hidden = true;
      const p = renderer.viewportToGraph(event);
      graph.mergeNodeAttributes(dragging, { x: p.x, y: p.y, fixed: true });
      if (layoutGraph?.hasNode(dragging)) layoutGraph.mergeNodeAttributes(dragging, { x: p.x, y: p.y, fixed: true });
      event.preventSigmaDefault(); event.original.preventDefault(); event.original.stopPropagation();
      return;
    }
    if (hovered || opt.edgeClick === false) return;
    const e = edgeAt(event.x, event.y);
    if (e !== hoverEdge) { hoverEdge = e; stage.style.cursor = e ? 'pointer' : ''; renderer.refresh({ skipIndexation: true }); if (e && opt.edgeTooltip) showEdgeTip(e, event); else tip.hidden = true; }
  });
  const up = () => { if (dragging) { const d = dragging; dragging = null; setTimeout(() => { dragMoved = false; }, 0); if (!dragMoved) return; graph.setNodeAttribute(d, 'fixed', true); } };
  renderer.on('upNode', up); renderer.on('upStage', up);
  const onKey = (ev) => {
    if (ev.key === 'Escape' && (pinned || hovered)) { hovered = null; clear(); }
  };
  document.addEventListener('keydown', onKey);
  panel.querySelector('.gx-close').onclick = () => clear();

  function showTip(id) {
    if (!opt.tooltip) return;
    const html = opt.tooltip(byId.get(id)); if (!html) return;
    tip.innerHTML = html; tip.hidden = false;
    // in the stage's bottom-left corner, clear of the node's neighbours and their labels
    tip.style.left = '.6rem'; tip.style.top = 'auto'; tip.style.bottom = '.6rem';
  }
  function showEdgeTip(id, ev) { tip.innerHTML = opt.edgeTooltip(edgeById.get(id)); tip.hidden = false; tip.style.bottom = ''; placeTip(ev.x, ev.y, 4); }
  function placeTip(x, y, r) {
    const W = container.clientWidth, w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + r + 10, top = y - h - r - 6;
    if (left + w > W - 6) left = Math.max(6, x - r - 10 - w);
    if (top < 6) top = y + r + 8;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  }

  function select(f, fly = true) {
    pinned = f; hovered = null; tip.hidden = true; relight();
    const id = f?.type === 'node' ? f.id : null;
    if (opt.panel) { panel.hidden = !f; container.classList.toggle('gx-open', !!f); }
    opt.onSelect?.(f ? { ...f, data: f.type === 'node' ? byId.get(f.id) : edgeById.get(f.id) } : null);
    if (opt.panel && f) body.scrollTop = 0;
    if (f) frame(fly ? 'fit' : 'reveal');
  }
  function clear() { if (!pinned && !lit) return; pinned = null; lit = null; tip.hidden = true; if (opt.panel) { panel.hidden = true; container.classList.remove('gx-open'); } relight(); opt.onSelect?.(null); }
  // The part of the stage not covered by the panel (right) or the bottom sheet (phone), in viewport px
  function openArea() {
    const { width: W, height: H } = renderer.getDimensions();
    const a = { x0: 12, y0: 52, x1: W - 12, y1: H - 12 };
    if (opt.panel && !panel.hidden) {
      if (matchMedia('(max-width: 48rem)').matches) {
        const top = panel.getBoundingClientRect().top - stage.getBoundingClientRect().top;
        a.y1 = Math.max(a.y0 + 80, Math.min(a.y1, top - 12));
      } else a.x1 = Math.max(a.x0 + 120, W - panel.offsetWidth - 24);
    }
    return a;
  }
  // Move the camera so the focus (a node and its neighbours) sits in the open area: 'fit' zooms to it
  // (search, the page's own links), 'reveal' only pans, or zooms out, when part of it is hidden (a click)
  function frame(how = 'fit') {
    if (!lit || !lit.nodes.size) return;
    const pts = [...lit.nodes].map((id) => renderer.getNodeDisplayData(id)).filter((d) => d && !d.hidden);
    if (!pts.length) return;
    const { width: W, height: H } = renderer.getDimensions(), A = openArea();
    const fb = { x0: Math.min(...pts.map((d) => d.x)), x1: Math.max(...pts.map((d) => d.x)), y0: Math.min(...pts.map((d) => d.y)), y1: Math.max(...pts.map((d) => d.y)) };
    const vp = pts.map((d) => renderer.framedGraphToViewport(d));
    const vb = { x0: Math.min(...vp.map((p) => p.x)) - 60, x1: Math.max(...vp.map((p) => p.x)) + 140, y0: Math.min(...vp.map((p) => p.y)) - 20, y1: Math.max(...vp.map((p) => p.y)) + 20 };
    if (how === 'reveal' && vb.x0 >= A.x0 && vb.x1 <= A.x1 && vb.y0 >= A.y0 && vb.y1 <= A.y1) return;
    // px per framed unit at ratio 1
    const a = renderer.framedGraphToViewport({ x: 0, y: 0 }), b = renderer.framedGraphToViewport({ x: 1, y: 0 });
    const k1 = Math.hypot(b.x - a.x, b.y - a.y) * camera.ratio;
    const needW = (fb.x1 - fb.x0) * k1 + 200, needH = (fb.y1 - fb.y0) * k1 + 40;
    const fit = Math.max(needW / (A.x1 - A.x0), needH / (A.y1 - A.y0));
    let r = how === 'fit' ? Math.min(Math.max(fit, layered() ? 0.35 : 0.42), 1.1) : Math.max(camera.ratio, Math.min(fit, 1.1));
    let c = { x: (fb.x0 + fb.x1) / 2, y: (fb.y0 + fb.y1) / 2 };
    // a diagram is not zoomed out past where its labels can be read: then the focused node is centred
    if (layered() && how === 'fit') {
      const maxR = (pxPerUnit() * camera.ratio) / 0.95;
      if (r > maxR) { r = maxR; const d = lit.center && renderer.getNodeDisplayData(lit.center); if (d) c = { x: d.x, y: d.y }; }
    }
    // a camera on the focus' centre, then shifted so that centre lands in the middle of the open area
    const ax = (A.x0 + A.x1) / 2 - 40, ay = (A.y0 + A.y1) / 2;   // a little left of centre: labels run right
    const target = renderer.viewportToFramedGraph({ x: W - ax, y: H - ay }, { cameraState: { x: c.x, y: c.y, ratio: r, angle: 0 } });
    camera.animate({ x: target.x, y: target.y, ratio: r }, { duration: dur(450), easing: 'quadraticInOut' });
  }
  // ---- toolbar and search
  function buildTools() {
    seg.hidden = !opt.toggle;
    seg.innerHTML = opt.toggle ? `<button type="button" data-l="force">${esc(strings.force)}</button><button type="button" data-l="layered">${esc(strings.layered)}</button>` : '';
    tools.innerHTML = `<button type="button" data-z="in" aria-label="${esc(strings.zoomIn)}" title="${esc(strings.zoomIn)}">+</button><button type="button" data-z="out" aria-label="${esc(strings.zoomOut)}" title="${esc(strings.zoomOut)}">−</button><button type="button" data-z="fit" aria-label="${esc(strings.fit)}" title="${esc(strings.fit)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button>`;
    seg.querySelectorAll('[data-l]').forEach((b) => { b.setAttribute('aria-pressed', b.dataset.l === layoutMode); b.onclick = () => api.setLayout(b.dataset.l); });
    tools.querySelector('[data-z="in"]').onclick = () => api.zoom(1);
    tools.querySelector('[data-z="out"]').onclick = () => api.zoom(-1);
    tools.querySelector('[data-z="fit"]').onclick = () => api.fit();
    q.placeholder = strings.search; q.setAttribute('aria-label', strings.search);
    panel.querySelector('.gx-close').setAttribute('aria-label', strings.close);
  }
  let hitIds = [], active = -1;
  function renderHits() {
    const v = q.value.trim();
    if (!v) { hits.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
    const r = api.search(v); hitIds = r.map((x) => x.id); active = r.length ? 0 : -1;
    hits.innerHTML = r.length ? r.map((x, i) => `<li role="option" id="${listId}-${i}" data-id="${esc(x.id)}" aria-selected="${i === active}"><i style="background:${esc(graph.getNodeAttribute(x.id, 'color'))};${graph.getNodeAttribute(x.id, 'hollow') ? `box-shadow:inset 0 0 0 2px ${rgba(graph.getNodeAttribute(x.id, 'rgb'))}` : ''}"></i>${esc(x.label)}</li>`).join('') : `<li class="gx-none">${esc(strings.none)}</li>`;
    hits.hidden = false; q.setAttribute('aria-expanded', 'true');
    q.setAttribute('aria-activedescendant', active >= 0 ? `${listId}-${active}` : '');
  }
  const pick = (id) => { hits.hidden = true; q.setAttribute('aria-expanded', 'false'); q.value = graph.getNodeAttribute(id, 'label'); api.focus(id); };
  q.addEventListener('input', renderHits);
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!hitIds.length) return; ev.preventDefault();
      active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + hitIds.length) % hitIds.length;
      hits.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', i === active));
      q.setAttribute('aria-activedescendant', `${listId}-${active}`);
    } else if (ev.key === 'Enter') { if (active >= 0 && hitIds[active]) { ev.preventDefault(); pick(hitIds[active]); } }
    else if (ev.key === 'Escape') { ev.stopPropagation(); q.value = ''; hits.hidden = true; }
  });
  hits.addEventListener('mousedown', (ev) => { const li = ev.target.closest('[data-id]'); if (li) { ev.preventDefault(); pick(li.dataset.id); } });
  q.addEventListener('blur', () => setTimeout(() => { hits.hidden = true; q.setAttribute('aria-expanded', 'false'); }, 120));

  // ---- layouts
  const saved = { force: null, layered: null };
  function setPositions(pos) { graph.updateEachNodeAttributes((id, a) => (pos[id] ? { ...a, x: pos[id].x, y: pos[id].y } : a), { attributes: ['x', 'y'] }); }
  function snapshot() { const p = {}; graph.forEachNode((id, a) => { p[id] = { x: +a.x.toFixed(2), y: +a.y.toFixed(2) }; }); return p; }

  function seedPositions() {
    const xs = opt.seedX ? opt.nodes.map((n) => opt.seedX(n)).filter((v) => v != null && isFinite(v)) : [];
    const lo = Math.min(...xs), hi = Math.max(...xs), R = Math.sqrt(graph.order) * 12;
    graph.forEachNode((id) => {
      const s = opt.seedX?.(byId.get(id));
      const tx = s != null && xs.length && hi > lo ? ((s - lo) / (hi - lo)) * 2 - 1 : null;
      graph.mergeNodeAttributes(id, { tx, x: (tx ?? hash(id + 'x') * 2 - 1) * R, y: (hash(id) * 2 - 1) * R * 0.6, fixed: false });
    });
  }
  async function forceLayout() {
    if (saved.force) { setPositions(saved.force); return; }
    if (opt.positions) {
      setPositions(opt.positions);
      if (opt.reshape) {
        // positions from a build: widen (or heighten) them towards the stage's shape, as a layout run here would
        const raw = snapshot(), b = bounds(raw, visible), out = {};
        const want = (container.clientWidth || 4) / (container.clientHeight || 3), have = (b.x1 - b.x0) / (b.y1 - b.y0 || 1);
        const fx = have < want ? Math.min(want / have, opt.stretch ?? 1.5) : 1, fy = have > want ? Math.min(have / want, opt.stretch ?? 1.5) : 1;
        const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        for (const [id, p] of Object.entries(raw)) out[id] = { x: cx + (p.x - cx) * fx, y: cy + (p.y - cy) * fy };
        setPositions(out);
      }
      saved.force = snapshot(); return;
    }
    seedPositions();
    // What is on show is laid out first, alone; what the filters hide is placed afterwards around it, with
    // the first part held still, so switching a filter on adds to the picture without moving it.
    const first = new Set(visible.size ? visible : graph.nodes());
    const sub = new Graph({ type: 'directed' });
    graph.forEachNode((id, a) => { if (first.has(id)) sub.addNode(id, { x: a.x, y: a.y, size: a.size, tx: a.tx, fixed: false }); });
    graph.forEachEdge((id, a, s, t) => { if (first.has(s) && first.has(t) && edgeOn(id)) sub.addDirectedEdgeWithKey(id, s, t, { weight: a.weight }); });
    const n = sub.order;
    const settings = (g) => ({
      ...forceAtlas2.inferSettings(g), strongGravityMode: true, gravity: 0.25, scalingRatio: 10,
      linLogMode: false, outboundAttractionDistribution: false, adjustSizes: false, edgeWeightInfluence: 1,
      barnesHutOptimize: g.order > 1500, slowDown: 1 + Math.log(g.order + 1), ...(opt.fa2 || {}),
    });
    const total = opt.iterations ?? Math.round(Math.max(300, Math.min(900, 30000 / Math.sqrt(n + 1))));
    const pull = opt.seedPull ?? 0.08, s1 = settings(sub);
    const step = (k) => {
      forceAtlas2.assign(sub, { iterations: k, settings: s1, getEdgeWeight: 'weight' });
      if (opt.seedX) {
        // the soft force: drift each dated node towards its place on the x axis, scaled to the picture's spread
        let sx = 0, sy = 0, m = 0; sub.forEachNode((id, a) => { sx += a.x; sy += a.y; m++; });
        const cx = sx / m, cy = sy / m; let spread = 0; sub.forEachNode((id, a) => { spread += (a.x - cx) ** 2 + (a.y - cy) ** 2; });
        spread = Math.sqrt(spread / m) * (opt.seedSpread ?? 1.6);
        sub.updateEachNodeAttributes((id, a) => (a.tx == null || a.fixed ? a : { ...a, x: a.x + (cx + a.tx * spread - a.x) * pull * k / 4 }), { attributes: ['x'] });
      }
    };
    const show = () => {
      graph.updateEachNodeAttributes((id, a) => { if (!sub.hasNode(id)) return a; const b = sub.getNodeAttributes(id); return { ...a, x: b.x, y: b.y }; }, { attributes: ['x', 'y'] });
      const b = bounds(snapshotOf(sub)); if (isFinite(b.x0)) renderer.setCustomBBox({ x: [b.x0, b.x1], y: [b.y0, b.y1] });
    };
    // The same steps in the same order whether animated or not (so the result is too): ~100 steps, as
    // many per frame as fit in 12 ms, and whatever is left after 2.5 s at once
    const per = Math.max(2, Math.ceil(total / 100)), steps = Math.ceil(total / per);
    running = true; layoutGraph = sub;
    if (still() || opt.animate === false) { for (let i = 0; i < steps; i++) step(per); show(); }
    else {
      stage.classList.add('gx-settling');
      await new Promise((done) => {
        let i = 0; const start = performance.now();
        const frame = () => {
          if (destroyed) return done();
          const t0 = performance.now(), late = t0 - start > 2500;
          do { step(per); i++; } while (i < steps && (late || performance.now() - t0 < 12));
          show();
          if (i < steps) requestAnimationFrame(frame); else done();
        };
        requestAnimationFrame(frame);
      });
      stage.classList.remove('gx-settling');
    }
    layoutGraph = null;
    if (graph.order > sub.order) {
      // the rest: next to a neighbour already placed, else around the edge of the picture
      const b = bounds(snapshotOf(sub)), R = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 || 100, mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
      const held = new Map();
      graph.forEachNode((id, a) => {
        held.set(id, a.fixed);
        if (first.has(id)) { graph.setNodeAttribute(id, 'fixed', true); return; }
        const nb = graph.neighbors(id).find((x) => first.has(x)), ang = hash(id) * Math.PI * 2;
        if (nb) { const p = graph.getNodeAttributes(nb); graph.mergeNodeAttributes(id, { x: p.x + Math.cos(ang) * R * 0.1, y: p.y + Math.sin(ang) * R * 0.1 }); }
        else graph.mergeNodeAttributes(id, { x: mx + Math.cos(ang) * R * 1.1, y: my + Math.sin(ang) * R * 1.1 });
      });
      const s2 = settings(graph);
      for (let i = 0; i < 300; i += 10) forceAtlas2.assign(graph, { iterations: 10, settings: s2, getEdgeWeight: 'weight' });
      graph.forEachNode((id) => graph.setNodeAttribute(id, 'fixed', held.get(id)));
    }
    // widen (or heighten) the settled picture towards the stage's shape: a network has no up or down
    const raw = snapshot(), b = bounds(raw, first);
    const want = (container.clientWidth || 4) / (container.clientHeight || 3), have = (b.x1 - b.x0) / (b.y1 - b.y0 || 1);
    const fx = have < want ? Math.min(want / have, opt.stretch ?? 1.5) : 1, fy = have > want ? Math.min(have / want, opt.stretch ?? 1.5) : 1;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, out = {};
    for (const [id, p] of Object.entries(raw)) out[id] = { x: cx + (p.x - cx) * fx, y: cy + (p.y - cy) * fy };
    const nb = bounds(out, first); renderer.setCustomBBox({ x: [nb.x0, nb.x1], y: [nb.y0, nb.y1] });
    if (!still() && opt.animate !== false && (fx > 1.02 || fy > 1.02)) await glide(raw, out, 350); else setPositions(out);
    running = false;
    saved.force = snapshot();
  }
  function snapshotOf(g) { const p = {}; g.forEachNode((id, a) => { p[id] = { x: a.x, y: a.y }; }); return p; }
  function bounds(pos, only) {
    const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const [id, p] of Object.entries(pos)) { if (only && only.size && !only.has(id)) continue; b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); }
    return b;
  }
  function glide(from, to, T = 500) {
    return new Promise((done) => {
      const t0 = performance.now();
      const frame = (now) => {
        const u = Math.min(1, (now - t0) / T), e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        graph.updateEachNodeAttributes((id, a) => (from[id] && to[id] ? { ...a, x: from[id].x + (to[id].x - from[id].x) * e, y: from[id].y + (to[id].y - from[id].y) * e } : a), { attributes: ['x', 'y'] });
        if (u < 1 && !destroyed) requestAnimationFrame(frame); else done();
      };
      requestAnimationFrame(frame);
    });
  }

  async function layeredLayout() {
    if (saved.layered) { setPositions(saved.layered.pos); routes = saved.layered.routes; return; }
    const mod = await import(ELK_URL);
    const ELK = mod.default?.default ?? mod.default ?? mod.ELK;
    const elk = new ELK();
    const down = opt.direction === 'DOWN';
    const fs = opt.labelSize, font = `500 ${fs}px ${C.font}`;
    const elkBox = (id, a) => { const r = a.size, w = textW(lctx, short(a.label), font); return down ? { id, width: Math.max(2 * r, w + 4), height: 2 * r + fs * 1.3 + 4 } : { id, width: 2 * r + 5 + w + 4, height: Math.max(2 * r, fs * 1.3) }; };
    // each connected lineage is laid out alone; the largest on top, the rest below it, largest first, in rows
    // as wide as the largest, so small chains never sit in among the big tree
    const comps = [], seen = new Set();
    graph.forEachNode((id) => {
      if (seen.has(id)) return;
      const c = [], st = [id]; seen.add(id);
      while (st.length) { const x = st.pop(); c.push(x); for (const y of graph.neighbors(x)) if (!seen.has(y)) { seen.add(y); st.push(y); } }
      comps.push(c);
    });
    comps.sort((x, y) => y.length - x.length || (x[0] < y[0] ? -1 : 1));
    const layoutOptions = {
      'elk.algorithm': 'layered', 'elk.direction': down ? 'DOWN' : 'RIGHT', 'elk.edgeRouting': 'SPLINES',
      'elk.layered.spacing.nodeNodeBetweenLayers': down ? '44' : '44', 'elk.spacing.nodeNode': down ? '16' : '9',
      'elk.layered.spacing.edgeNodeBetweenLayers': '14', 'elk.spacing.edgeNode': '8', 'elk.spacing.edgeEdge': '5',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP', 'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', 'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
      'elk.randomSeed': '7', 'elk.padding': '[top=0,left=0,bottom=0,right=0]', ...(opt.elk || {}),
    };
    const outs = await Promise.all(comps.map((c) => {
      const inC = new Set(c), edges = [];
      for (const id of c) graph.forEachOutEdge(id, (e, a, s, t) => { if (inC.has(t)) edges.push({ id: e, sources: [s], targets: [t] }); });
      return elk.layout({ id: 'root', children: c.map((id) => elkBox(id, graph.getNodeAttributes(id))), edges, layoutOptions });
    }));
    const GAP = 36, ROWGAP = 22;
    const rowW = Math.max(outs[0]?.width ?? 0, 520);
    const placed = []; let ox = 0, oy = 0, rowH = 0;
    outs.forEach((r, i) => {
      if (i === 0) { placed.push([0, 0]); oy = r.height + GAP * 1.6; return; }
      if (ox > 0 && ox + r.width > rowW) { ox = 0; oy += rowH + ROWGAP; rowH = 0; }
      placed.push([ox, oy]); ox += r.width + GAP; rowH = Math.max(rowH, r.height);
    });
    const res = { children: [], edges: [] };
    outs.forEach((r, i) => {
      const [dx, dy] = placed[i];
      for (const c of r.children) res.children.push({ ...c, x: c.x + dx, y: c.y + dy });
      for (const e of r.edges || []) res.edges.push({ ...e, sections: (e.sections || []).map((sc) => ({ startPoint: { x: sc.startPoint.x + dx, y: sc.startPoint.y + dy }, endPoint: { x: sc.endPoint.x + dx, y: sc.endPoint.y + dy }, bendPoints: (sc.bendPoints || []).map((b) => ({ x: b.x + dx, y: b.y + dy })) })) });
    });
    const pos = {};
    const cs = new Map(res.children.map((c) => [c.id, c]));
    graph.forEachNode((id, a) => {
      const c = cs.get(id); if (!c) { pos[id] = { x: 0, y: 0 }; return; }
      const r = a.size;
      pos[id] = down ? { x: c.x + c.width / 2, y: -(c.y + r) } : { x: c.x + r, y: -(c.y + c.height / 2) };
    });
    routes = new Map();
    for (const e of res.edges || []) {
      const s = e.sections?.[0]; if (!s) continue;
      const pts = [s.startPoint, ...(s.bendPoints || []), s.endPoint].map((p) => [p.x, -p.y]);
      if ((pts.length - 1) % 3) { const a = pts[0], b = pts[pts.length - 1]; routes.set(e.id, [a, [(a[0] + b[0]) / 2, a[1]], [(a[0] + b[0]) / 2, b[1]], b]); }
      else routes.set(e.id, pts);
    }
    // a student's arrow ends at the dot, not at the side of its box
    for (const [id, pts] of routes) {
      const [, t] = graph.extremities(id), p = pos[t], r = graph.getNodeAttribute(t, 'size');
      const end = down ? [p.x, p.y + r + 1] : [p.x - r - 1, p.y];
      const L = pts[pts.length - 1], dx = end[0] - L[0], dy = end[1] - L[1];
      pts[pts.length - 1] = end; if (pts.length > 2) { const c = pts[pts.length - 2]; pts[pts.length - 2] = [c[0] + dx, c[1] + dy]; }
    }
    const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const c of res.children) { box.x0 = Math.min(box.x0, c.x); box.x1 = Math.max(box.x1, c.x + c.width); box.y0 = Math.min(box.y0, -(c.y + c.height)); box.y1 = Math.max(box.y1, -c.y); }
    const mb = outs[0] ? { x0: 0, x1: outs[0].width, y0: -outs[0].height, y1: 0 } : box;
    saved.layered = { pos, routes, box, main: mb, mainIds: comps[0] ?? [] };
    setPositions(pos);
  }

  async function runLayout(animateSwitch) {
    const before = animateSwitch ? snapshot() : null;
    applyScale();
    if (layered()) await layeredLayout(); else { routes = null; await forceLayout(); }
    if (before && !still()) {
      // glide from the old positions to the new
      const after = snapshot(), keepRoutes = routes; routes = null;
      await glide(before, after, 500);
      routes = keepRoutes;
    }
    const b = layered() ? saved.layered.box : bounds(snapshot(), visible);
    renderer.setCustomBBox({ x: [b.x0, b.x1], y: [b.y0, b.y1] });
    if ((layered() && opt.start === 'main') || (!layered() && opt.fill)) renderer.refresh();   // the box's mapping, which startView reads
    camera.setState(startView());
    renderer.refresh();
    if (opt.panHint) showPanHint(layered() && partial);
  }

  // A tree much wider than the stage (a phone) starts at a readable height, from its left edge (masters
  // first), to be panned; anything else starts fitted. start: 'main' frames the largest lineage instead
  let partial = false;
  function startView() {
    const W = container.clientWidth || 1, H = container.clientHeight || 1;
    partial = false;
    if (layered() && saved.layered && opt.start === 'main') return mainView(W, H);
    if (layered() && saved.layered) {
      const b = saved.layered.box, bw = b.x1 - b.x0, bh = b.y1 - b.y0;
      if (W / H < 0.75 * (bw / bh)) { partial = true; const r = Math.max(0.3, (W * bh) / (H * bw)); return { x: r / 2, y: 0.5, ratio: r, angle: 0 }; }
    }
    if (!layered() && opt.fill) return fillView(W, H);
    return { x: 0.5, y: 0.5, ratio: 1, angle: 0 };
  }
  // the camera that frames the box (on show) in the stage's own shape, below the toolbar
  function fillView(W, H) {
    const one = { x: 0.5, y: 0.5, ratio: 1, angle: 0 }, bb = renderer.getCustomBBox() ?? renderer.getBBox();
    const a = renderer.graphToViewport({ x: bb.x[0], y: bb.y[1] }, { cameraState: one }), z = renderer.graphToViewport({ x: bb.x[1], y: bb.y[0] }, { cameraState: one });
    const top = 54, side = 18, bw = Math.abs(z.x - a.x), bh = Math.abs(z.y - a.y);
    const r = Math.max(0.05, bw / (W - 2 * side), bh / (H - top - side));
    const c = renderer.viewportToFramedGraph({ x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 - ((top - side) / 2) * r }, { cameraState: one });
    return { x: c.x, y: c.y, ratio: r, angle: 0 };
  }
  function mainView(W, H) {
    const b = saved.layered.main, one = { x: 0.5, y: 0.5, ratio: 1, angle: 0 };
    // the main lineage's corners in px with the camera at rest (ratio 1 = the whole picture fitted)
    const a = renderer.graphToViewport({ x: b.x0, y: b.y1 }, { cameraState: one }), z = renderer.graphToViewport({ x: b.x1, y: b.y0 }, { cameraState: one });
    const bw = Math.abs(z.x - a.x), bh = Math.abs(z.y - a.y), top = 56, side = 16;
    let r = Math.max(bw / (W - 2 * side), bh / (H - top - side));
    // much wider than the stage (a phone): fit its height, or less if the labels would then be too small to
    // read, and start from its left edge (the masters)
    if (W / H < 0.75 * (bw / bh)) {
      const k = bw / (b.x1 - b.x0 || 1), readable = (opt.labelSize * k) / Math.max(10, opt.minLabel ?? 10.5);   // labels at their smallest size
      r = Math.min(bh / (H - top - side), readable); partial = true;
    }
    r = Math.max(0.08, r);
    // camera so that the box's left (partial) or centre lands in the open stage; a partial view centres
    // on the height of what it shows (the first generations), not on the whole lineage's
    let my = (a.y + z.y) / 2;
    if (partial) {
      const k = bw / (b.x1 - b.x0 || 1), reach = b.x0 + ((W - side) * r) / k, ys = [];
      for (const id of saved.layered.mainIds) { const q = saved.layered.pos[id]; if (q && q.x <= reach) ys.push(q.y); }
      if (ys.length) my = renderer.graphToViewport({ x: b.x0, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, { cameraState: one }).y;
    }
    const cx = partial ? Math.min(a.x, z.x) + (W / 2 - side) * r : (a.x + z.x) / 2, cy = my - (top - side) / 2 * r;
    const c = renderer.viewportToFramedGraph({ x: cx, y: cy }, { cameraState: one });
    return { x: c.x, y: c.y, ratio: r, angle: 0 };
  }
  let hintEl = null;
  function showPanHint(on) {
    hintEl?.remove(); hintEl = null;
    if (!on) return;
    hintEl = el('div', 'gx-pan'); hintEl.textContent = strings.pan; container.append(hintEl);
    const off = () => { hintEl?.classList.add('gx-gone'); stage.removeEventListener('pointerdown', off); stage.removeEventListener('wheel', off); };
    stage.addEventListener('pointerdown', off); stage.addEventListener('wheel', off, { passive: true });
  }

  // ---- theme and size changes
  const onTheme = () => { readTheme(); renderer.setSetting('labelFont', C.font); renderer.refresh(); };
  addEventListener('themechange', onTheme);
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', onTheme);
  const ro = new ResizeObserver(() => { renderer.resize(); renderer.refresh({ skipIndexation: true }); });
  ro.observe(stage);
  let destroyed = false;

  const api = {
    graph, renderer,
    get layout() { return layoutMode; },
    node: (id) => byId.get(String(id)),
    neighbors: (id) => graph.neighbors(String(id)),
    inEdges: (id) => graph.inEdges(String(id)).filter(edgeOn).map((e) => edgeById.get(e)),
    outEdges: (id) => graph.outEdges(String(id)).filter(edgeOn).map((e) => edgeById.get(e)),
    edgeSource: (id) => graph.source(String(id)), edgeTarget: (id) => graph.target(String(id)),
    isVisible: (id) => visible.has(String(id)),
    focus(id, { fly = true } = {}) {
      id = String(id); if (!graph.hasNode(id)) return;
      if (!visible.has(id) && opt.onReveal) opt.onReveal(byId.get(id));
      select({ type: 'node', id }, fly);
    },
    focusEdge(id, { fly = true } = {}) { id = String(id); if (!graph.hasEdge(id)) return; select({ type: 'edge', id }, fly); },
    clear,
    selected: () => pinned,
    search(text, limit = 8) {
      const f = fold(text).trim(); if (!f) return [];
      const out = [];
      graph.forEachNode((id, a) => {
        if (!visible.has(id) && !opt.revealable?.(byId.get(id))) return;
        const i = a.fold.indexOf(f), j = i < 0 ? a.alt.indexOf(f) : -1; if (i < 0 && j < 0) return;
        out.push({ id, label: a.label, rank: i === 0 ? 0 : i > 0 ? (a.fold[i - 1] === ' ' ? 1 : 2) : 3, size: a.size });
      });
      return out.sort((a, b) => a.rank - b.rank || b.size - a.size || a.label.localeCompare(b.label)).slice(0, limit).map(({ id, label }) => ({ id, label }));
    },
    setFilter(nf, ef) {
      nodeFilter = nf || null; edgeFilter = ef || null; computeVisible();
      if (pinned?.type === 'node' && !visible.has(pinned.id)) clear();
      if (pinned?.type === 'edge' && !edgeOn(pinned.id)) clear();
      lit = focusOf(pinned); renderer.refresh();
    },
    fit() { camera.animate(!layered() && opt.fill ? startView() : { x: 0.5, y: 0.5, ratio: 1, angle: 0 }, { duration: dur(400) }); },
    // frame what is on show now (after a filter showed or hid a whole part): the box follows, the camera fits it
    refit() {
      if (layered()) return;
      const b = bounds(snapshot(), visible); if (!isFinite(b.x0)) return;
      renderer.setCustomBBox({ x: [b.x0, b.x1], y: [b.y0, b.y1] }); renderer.refresh();
      camera.setState(startView());
    },
    home() { camera.animate(startView(), { duration: dur(400) }); },
    zoom(dir) { if (dir > 0) camera.animatedZoom({ duration: dur(250), factor: 1.6 }); else camera.animatedUnzoom({ duration: dur(250), factor: 1.6 }); },
    async setLayout(mode) {
      if (mode === layoutMode || running) return;
      layoutMode = mode; buildTools(); delete container.dataset.ready;
      await runLayout(true); container.dataset.ready = '1';
      if (pinned) { lit = focusOf(pinned); frame('fit'); }
    },
    relabel() { sizes(); measure.clear(); readTheme(); renderer.refresh(); },
    setStrings(s) { strings = { ...STRINGS[lang()], ...(o.strings || {}), ...(s || {}) }; buildTools(); if (hintEl) hintEl.textContent = strings.pan; },
    positions: () => (layoutMode === 'force' ? snapshot() : saved.force),
    destroy() {
      destroyed = true; removeEventListener('themechange', onTheme); mq.removeEventListener('change', onTheme);
      document.removeEventListener('keydown', onKey); ro.disconnect(); renderer.kill();
      if (opt.panel) home.replaceWith(opt.panel);
      container.innerHTML = ''; container.classList.remove('gx', 'gx-open');
    },
  };
  container.gx = api;          // for the page's scripts and tests
  buildTools();
  if (still() || layered() || opt.positions) stage.classList.add('gx-hide');
  api.ready = runLayout(false).then(() => { stage.classList.remove('gx-hide'); container.dataset.ready = '1'; return api; });
  return api;

  function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
}
