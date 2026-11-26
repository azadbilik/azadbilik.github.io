// scripts/graph-layout.mjs — ForceAtlas2 at build time for the hub's large networks. shared/graph.js takes
// the result as its `positions` option and shows the settled picture at once, with no layout in the browser.
//
//   import { forceLayout, quantise } from '../../../scripts/graph-layout.mjs';
//   const xy = await forceLayout(n, edges, { core, iterations, settings });   // Float32Array [x0, y0, x1, y1, ...]
//   const q = quantise(xy);                                                    // Int16Array, same order
//
//   n       number of nodes (0..n-1)
//   edges   [[a, b, weight], ...] (weight optional, 1 by default); duplicates and self-loops are dropped
//   include optional Uint8Array(n): only these nodes are laid out (the rest stay at 0, 0)
//   pack    true: only the largest connected part is laid out as one picture; every smaller part is laid out
//           alone and they are packed, largest first, in rows into a block to the right of it (a clear gap,
//           top-aligned, about as tall as the main picture), instead of the ring ForceAtlas2 throws them into.
//           The result then carries .small (Uint8Array(n), 1 = in a small part) and .groups (their number)
//   core    optional Uint8Array(n): laid out first, alone; the rest is then placed around it with the core held
//           still, so a page that shows the core by default and the rest on a switch never moves the core
//
// Deterministic: seeded start (the same hash of the index on every run), a fixed number of iterations, the
// Barnes-Hut approximation. The libraries are the page's own versions (graphology 0.26.0,
// graphology-layout-forceatlas2 0.10.1), installed on first use into scripts/.deps (git-ignored).
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEPS = path.join(path.dirname(fileURLToPath(import.meta.url)), '.deps');
function load() {
  if (!existsSync(path.join(DEPS, 'node_modules', 'graphology-layout-forceatlas2'))) {
    console.log('graph-layout: installing graphology 0.26.0 + graphology-layout-forceatlas2 0.10.1 into scripts/.deps');
    execFileSync('npm', ['install', '--no-save', '--no-package-lock', '--prefix', DEPS, 'graphology@0.26.0', 'graphology-layout-forceatlas2@0.10.1'], { stdio: 'inherit' });
  }
  const req = createRequire(path.join(DEPS, 'x.js'));
  return { Graph: req('graphology'), fa2: req('graphology-layout-forceatlas2') };
}
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return (h >>> 0) / 4294967296; };

export async function forceLayout(n, edges, { core = null, include = null, iterations = null, settings = {}, log = true, pack = false } = {}) {
  const { Graph, fa2 } = load();
  if (pack) return packed(n, edges, { core, include, iterations, settings, log }, Graph, fa2);
  const t0 = Date.now();
  const build = (keep) => {
    const g = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
    for (let i = 0; i < n; i++) if (keep(i)) g.addNode(i);
    for (const [a, b, w = 1] of edges) {
      if (a === b || !g.hasNode(a) || !g.hasNode(b)) continue;
      if (g.hasEdge(a, b)) g.updateEdgeAttribute(a, b, 'weight', (x) => x + w); else g.addEdge(a, b, { weight: w });
    }
    return g;
  };
  const R = Math.sqrt(n) * 12;
  const opts = (g) => ({
    ...fa2.inferSettings(g), barnesHutOptimize: true, barnesHutTheta: 0.6, strongGravityMode: true, gravity: 0.05,
    scalingRatio: 4, linLogMode: false, outboundAttractionDistribution: true, adjustSizes: false, edgeWeightInfluence: 0.5,
    slowDown: 1 + Math.log(g.order + 1), ...settings,
  });
  const run = (g, label) => {
    const total = iterations ?? Math.round(Math.max(300, Math.min(1200, 60000 / Math.sqrt(g.order + 1))));
    const s = opts(g);
    for (let i = 0; i < total; i += 25) fa2.assign(g, { iterations: Math.min(25, total - i), settings: s, getEdgeWeight: 'weight' });
    if (log) console.log(`graph-layout: ${label} ${g.order} nodes, ${g.size} edges, ${total} iterations, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  };
  const xy = new Float32Array(2 * n);
  const inc = include ? (i) => !!include[i] : () => true;
  const first = core ? (i) => !!core[i] && inc(i) : inc;
  const g1 = build(first);
  g1.forEachNode((k) => g1.mergeNodeAttributes(k, { x: (hash(k + 'x') * 2 - 1) * R, y: (hash(k) * 2 - 1) * R }));
  run(g1, core ? 'core' : 'all');
  g1.forEachNode((k, a) => { xy[2 * k] = a.x; xy[2 * k + 1] = a.y; });
  if (core && g1.order < n) {
    // the rest: next to a neighbour already placed, else on a ring around the core; the core held still
    const g2 = build(inc);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    g1.forEachNode((k, a) => { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); });
    const rr = Math.max(x1 - x0, y1 - y0) / 2 || 100, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    g2.forEachNode((k) => {
      const i = +k, ang = hash(k) * Math.PI * 2;
      if (core[i]) { g2.mergeNodeAttributes(k, { x: xy[2 * i], y: xy[2 * i + 1], fixed: true }); return; }
      const nb = g2.neighbors(k).find((m) => core[+m]);
      if (nb != null) g2.mergeNodeAttributes(k, { x: xy[2 * nb] + Math.cos(ang) * rr * 0.05, y: xy[2 * nb + 1] + Math.sin(ang) * rr * 0.05 });
      else g2.mergeNodeAttributes(k, { x: mx + Math.cos(ang) * rr * 1.05, y: my + Math.sin(ang) * rr * 1.05 });
    });
    run(g2, 'rest');
    g2.forEachNode((k, a) => { xy[2 * k] = a.x; xy[2 * k + 1] = a.y; });
  }
  return xy;
}

async function packed(n, edges, o, Graph, fa2) {
  const inc = o.include ? (i) => !!o.include[i] : () => true;
  // connected parts (union-find), each listed by its smallest index
  const up = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  for (const [a, b] of edges) if (a !== b && inc(a) && inc(b)) { const x = find(a), y = find(b); if (x !== y) up[Math.max(x, y)] = Math.min(x, y); }
  const parts = new Map();
  for (let i = 0; i < n; i++) if (inc(i)) { const r = find(i); (parts.get(r) ?? parts.set(r, []).get(r)).push(i); }
  const list = [...parts.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
  const giant = new Uint8Array(n); for (const i of list[0] ?? []) giant[i] = 1;
  const xy = await forceLayout(n, edges, { ...o, include: giant, core: o.core ? o.core.map((v, i) => (v && giant[i] ? 1 : 0)) : null });
  // the main picture turned so its long axis lies across (a stage is wider than tall; a page reshapes it for a phone)
  {
    const g = list[0], gc = o.core ? g.filter((i) => o.core[i]) : g, gp = gc.length ? gc : g;   // the core, if any: what a page opens on
    let mx = 0, my = 0; for (const i of gp) { mx += xy[2 * i]; my += xy[2 * i + 1]; } mx /= gp.length; my /= gp.length;
    let sxx = 0, syy = 0, sxy = 0; for (const i of gp) { const dx = xy[2 * i] - mx, dy = xy[2 * i + 1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const t = -0.5 * Math.atan2(2 * sxy, sxx - syy), c = Math.cos(t), s2 = Math.sin(t);
    for (const i of g) { const dx = xy[2 * i] - mx, dy = xy[2 * i + 1] - my; xy[2 * i] = mx + dx * c - dy * s2; xy[2 * i + 1] = my + dx * s2 + dy * c; }
  }
  // the main picture's box and its typical line length: the small parts are drawn at the same scale
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const i of list[0]) { x0 = Math.min(x0, xy[2 * i]); x1 = Math.max(x1, xy[2 * i]); y0 = Math.min(y0, xy[2 * i + 1]); y1 = Math.max(y1, xy[2 * i + 1]); }
  const lens = []; for (const [a, b] of edges) if (giant[a] && giant[b]) lens.push(Math.hypot(xy[2 * a] - xy[2 * b], xy[2 * a + 1] - xy[2 * b + 1]));
  lens.sort((a, b) => a - b); const L = lens[lens.length >> 1] || (x1 - x0) / 100;
  // each small part alone, scaled so its median line is L
  const adj = new Map(); for (const [a, b] of edges) if (a !== b && !giant[a] && inc(a) && inc(b)) { (adj.get(a) ?? adj.set(a, []).get(a)).push(b); }
  const boxes = list.slice(1).map((part) => {
    const g = new Graph({ type: 'undirected', multi: false, allowSelfLoops: false });
    for (const i of part) g.addNode(i, { x: hash(i + 'x') * 10, y: hash(i) * 10 });
    for (const a of part) for (const b of adj.get(a) ?? []) if (!g.hasEdge(a, b)) g.addEdge(a, b, { weight: 1 });
    if (part.length > 2) fa2.assign(g, { iterations: 200, settings: { ...fa2.inferSettings(g), strongGravityMode: true, gravity: 0.05, scalingRatio: 2 } });
    const pts = part.map((i) => [i, g.getNodeAttribute(i, 'x'), g.getNodeAttribute(i, 'y')]);
    if (part.length === 2) { pts[0][1] = 0; pts[0][2] = 0; pts[1][1] = 1; pts[1][2] = 0; }
    const ls = []; g.forEachEdge((e, a, s2, t2) => ls.push(Math.hypot(g.getNodeAttribute(s2, 'x') - g.getNodeAttribute(t2, 'x'), g.getNodeAttribute(s2, 'y') - g.getNodeAttribute(t2, 'y'))));
    ls.sort((a, b) => a - b); const m = part.length === 2 ? 1 : ls[ls.length >> 1] || 1, k = L / m;
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const p of pts) { p[1] *= k; p[2] *= k; bx0 = Math.min(bx0, p[1]); bx1 = Math.max(bx1, p[1]); by0 = Math.min(by0, p[2]); by1 = Math.max(by1, p[2]); }
    return { pts, x0: bx0, y0: by0, w: bx1 - bx0, h: by1 - by0 };
  });
  // the block as dense as the main picture (nodes per area), else a thousand pairs would dwarf it
  let pad = L * 1.2;
  {
    const nSmall = boxes.reduce((a, b) => a + b.pts.length, 0), aSmall = boxes.reduce((a, b) => a + (b.w + pad) * (b.h + pad), 0);
    const f = nSmall ? Math.min(1, Math.max(0.15, Math.sqrt(((x1 - x0) * (y1 - y0) / list[0].length) / (aSmall / nSmall)))) : 1;
    for (const b of boxes) { for (const p of b.pts) { p[1] *= f; p[2] *= f; } b.x0 *= f; b.y0 *= f; b.w *= f; b.h *= f; }
    pad *= f;
  }
  // shelves: rows of a width chosen so the block is about as tall as the main picture
  const H = y1 - y0;
  const shelve = (W, place) => {
    let x = 0, y = 0, rowH = 0, maxW = 0;
    for (const b of boxes) {
      if (x > 0 && x + b.w > W) { y += rowH + pad; x = 0; rowH = 0; }
      if (place) for (const [i, px, py] of b.pts) { xy[2 * i] = place.x + x + (px - b.x0); xy[2 * i + 1] = place.y + y + (py - b.y0); }
      x += b.w + pad; rowH = Math.max(rowH, b.h); maxW = Math.max(maxW, x - pad);
    }
    return { w: maxW, h: y + rowH };
  };
  if (boxes.length) {
    let lo = Math.max(...boxes.map((b) => b.w)), hi = boxes.reduce((a, b) => a + b.w + pad, 0);
    for (let it = 0; it < 30; it++) { const mid = (lo + hi) / 2; if (shelve(mid).h > H) lo = mid; else hi = mid; }
    shelve(hi, { x: x1 + Math.max((x1 - x0) * 0.08, pad * 4), y: y0 });   // the pages draw -y up: rows run down from the main picture's top
  }
  xy.small = new Uint8Array(n); for (const part of list.slice(1)) for (const i of part) xy.small[i] = 1;
  xy.groups = list.length - 1;
  if (o.log !== false) console.log(`graph-layout: ${list[0]?.length ?? 0} in the main part, ${xy.groups} small parts (${n - (list[0]?.length ?? 0)} nodes) packed beside it`);
  return xy;
}

// Positions to 16-bit integers over the picture's bounding box (centred on 0); a 33,000-node picture loses
// nothing visible at 1/65,000 of its width
export function quantise(xy) {
  let cx = 0, cy = 0; const n = xy.length / 2;
  for (let i = 0; i < n; i++) { cx += xy[2 * i]; cy += xy[2 * i + 1]; }
  cx /= n || 1; cy /= n || 1;
  let r = 0; for (let i = 0; i < n; i++) r = Math.max(r, Math.abs(xy[2 * i] - cx), Math.abs(xy[2 * i + 1] - cy));
  const k = 32000 / (r || 1), q = new Int16Array(xy.length);
  for (let i = 0; i < n; i++) { q[2 * i] = Math.round((xy[2 * i] - cx) * k); q[2 * i + 1] = Math.round((xy[2 * i + 1] - cy) * k); }
  return q;
}
