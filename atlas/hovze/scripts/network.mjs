// Third step of the basin map: the network. For every river: the river it flows into (the longer river
// one of its ends touches), the point where it joins, its «system» (the tributary of the Kür or the
// Araz it belongs to, at any remove: the colour on the map, after Grasshopper Geography's basin maps)
// and the length of everything upstream of its mouth (the line's width). Run after basin.mjs:
//   node scripts/network.mjs      → data/network.json
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const { features } = JSON.parse(await readFile(new URL('rivers.geojson', root), 'utf8'));
const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const dist = ([x0, y0], [x, y]) => { const a = Math.sin(rad(y - y0) / 2) ** 2 + Math.cos(rad(y0)) * Math.cos(rad(y)) * Math.sin(rad(x - x0) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
const lines = (g) => g.type === 'LineString' ? [g.coordinates] : g.coordinates;

// a coarse grid of every vertex, to find what an end touches
const CELL = .05, grid = new Map();
const cell = ([x, y]) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
features.forEach((f, i) => { for (const l of lines(f.geometry)) for (const p of l) { const k = cell(p); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([i, p]); } });
function near(p, skip) {
  let best = null;
  const [cx, cy] = cell(p).split(',').map(Number);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [i, q] of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
    if (i === skip) continue;
    const d = dist(p, q);
    if (!best || d < best.d) best = { i, q, d };
  }
  return best;
}

const out = {};
const idOf = (i) => features[i].properties.id;
// the trunk: the Kür has no parent; its mouth is its end nearest the Caspian
const kur = features.findIndex((f) => f.properties.az === 'Kür');
for (let i = 0; i < features.length; i++) {
  const f = features[i], ends = lines(f.geometry).flatMap((l) => [l[0], l.at(-1)]);
  let join = null;
  if (i !== kur) {
    // the end that lies on a longer river (within 3 km): the mouth
    for (const e of ends) {
      const n = near(e, i);
      if (n && n.d < 3 && (features[n.i].properties.length ?? 0) > (f.properties.length ?? 0) && (!join || n.d < join.d)) join = { ...n, e };
    }
  }
  const mouth = i === kur ? ends.reduce((a, b) => (b[0] - b[1] > a[0] - a[1] ? b : a)) : join?.e ?? null;
  out[idOf(i)] = { parent: join ? idOf(join.i) : null, mouth, at: join ? join.q : null };
}
// systems: climb to the river whose parent is the Kür or the Araz
const araz = idOf(features.findIndex((f) => f.properties.az === 'Araz'));
const trunk = new Set([idOf(kur), araz]);
const system = (id, seen = new Set()) => {
  if (trunk.has(id)) return id;
  const p = out[id].parent;
  if (!p || seen.has(id)) return id;
  if (trunk.has(p)) return id;
  seen.add(id);
  return system(p, seen);
};
// everything upstream, by length
const kids = new Map();
for (const [id, r] of Object.entries(out)) if (r.parent) { if (!kids.has(r.parent)) kids.set(r.parent, []); kids.get(r.parent).push(id); }
const len = Object.fromEntries(features.map((f) => [f.properties.id, f.properties.length ?? 0]));
const up = (id, seen = new Set()) => { if (seen.has(id)) return 0; seen.add(id); return len[id] + (kids.get(id) ?? []).reduce((s, k) => s + up(k, seen), 0); };
for (const id of Object.keys(out)) { out[id].system = system(id); out[id].upstream = Math.round(up(id)); }
const orphans = Object.entries(out).filter(([id, r]) => !r.parent && !trunk.has(id) && id !== idOf(kur)).length;
const systems = new Map();
for (const r of Object.values(out)) systems.set(r.system, (systems.get(r.system) ?? 0) + 1);
await writeFile(new URL('network.json', root), JSON.stringify(out) + '\n');
console.log(`${features.length} rivers; ${orphans} with no river found at either end (drawn in the trunk colour); ${systems.size} systems; the largest:`,
  [...systems].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => `${features.find((f) => f.properties.id === id)?.properties.az} ${n}`).join(', '));
