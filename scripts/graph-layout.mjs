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

export async function forceLayout(n, edges, { core = null, include = null, iterations = null, settings = {}, log = true } = {}) {
  const { Graph, fa2 } = load();
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
