// Builds data/rivers.geojson and data/lakes.geojson for the rivers map from OpenStreetMap
// (ODbL; fetched through Overpass into data/raw/): each named river as one feature, its pieces
// joined, simplified to ~100 m, with its names in three languages, its length and its Wikidata id;
// each named lake and reservoir with its area.
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
// A missing or failed download (an Overpass error page) counts as empty
const raw = async (f) => { try { return JSON.parse(await readFile(new URL('raw/' + f, root), 'utf8')); } catch { console.warn(`  ${f}: missing or not JSON, skipped`); return { elements: [] }; } };

// Douglas–Peucker on lon/lat, tolerance in degrees (~0.001° ≈ 100 m)
function simplify(pts, tol = 0.001) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / len; if (d > max) { max = d; idx = i; } }
    if (max > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
}
const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const km = (line) => line.slice(1).reduce((s, [x, y], i) => { const [x0, y0] = line[i]; const a = Math.sin(rad(y - y0) / 2) ** 2 + Math.cos(rad(y0)) * Math.cos(rad(y)) * Math.sin(rad(x - x0) / 2) ** 2; return s + 2 * R * Math.asin(Math.sqrt(a)); }, 0);
const line = (geom) => geom.map((p) => [p.lon, p.lat]);
const names = (tags) => ({ az: tags['name:az'] || (/[əğıöüçş]/i.test(tags.name ?? '') ? tags.name : null), ru: tags['name:ru'] || null, en: tags['name:en'] || null, local: tags.name });

// Rivers OSM names only in Russian, Persian, Georgian or Armenian: their Azerbaijani names where
// they have an established one (Samur, Qotur, Bərzənd, Zəngmar), else the local name transliterated
const AZ_NAMES = {
  'Самур': 'Samur', 'قطورچای': 'Qotur', 'Վարագաջուր': 'Varaqacur', 'برزند چایی': 'Bərzənd çayı', 'ნინოსხევი': 'Ninosxevi',
  'Калачай': 'Kalaçay', 'მლაშეწყალი': 'Mlaşetsqali', 'Келалчай': 'Kelalçay', 'Կիրանց': 'Kirans', 'Ծավ': 'Tsav',
  'رود خانه زنگمار': 'Zəngmar çayı', 'Сагатор': 'Saqator', 'Мекиканчай': 'Mekikançay',
};
const rivers = new Map();
const { elements } = await raw('rivers-geom.json');
// Whole rivers first (relations, crossing borders: the Kür, the Araz…), then named pieces not in one
const inRelation = new Set();
for (const e of elements.filter((e) => e.type === 'relation' && e.tags?.waterway === 'river')) {
  const lines = e.members.filter((m) => m.type === 'way' && m.geometry && (!m.role || m.role === 'main_stream' || m.role === 'side_stream' || m.role === '')).map((m) => { inRelation.add(m.ref); return line(m.geometry); });
  if (!lines.length) continue;
  rivers.set('r' + e.id, { names: names(e.tags), wikidata: e.tags.wikidata ?? null, lines, relation: true });
}
for (const e of elements.filter((e) => e.type === 'way' && !inRelation.has(e.id) && e.tags?.name)) {
  const n = names(e.tags);
  const k = 'n:' + (n.az ?? n.local);
  if (!rivers.has(k)) rivers.set(k, { names: n, wikidata: e.tags.wikidata ?? null, lines: [] });
  const r = rivers.get(k);
  r.lines.push(line(e.geometry));
  if (!r.wikidata && e.tags.wikidata) r.wikidata = e.tags.wikidata;
  for (const l of ['az', 'ru', 'en']) if (!r.names[l] && n[l]) r.names[l] = n[l];
}
// OSM splits a river into many short ways, each drawn downstream. Join a way to the one that starts
// where it ends (never turning one round), so the map's flow dashes run on along the whole river
function chain(lines) {
  const key = (p) => `${p[0]},${p[1]}`;
  const starts = new Map();
  for (const [i, l] of lines.entries()) { const k = key(l[0]); if (!starts.has(k)) starts.set(k, []); starts.get(k).push(i); }
  const used = new Set(), endsAt = new Set(lines.map((l) => key(l.at(-1))));
  const out = [];
  // Begin at heads (no way ends where they start), then whatever is left (loops, islands)
  const order = [...lines.keys()].sort((a, b) => endsAt.has(key(lines[a][0])) - endsAt.has(key(lines[b][0])));
  for (const i of order) {
    if (used.has(i)) continue;
    used.add(i);
    let cur = [...lines[i]];
    for (;;) {
      const next = (starts.get(key(cur.at(-1))) ?? []).find((j) => !used.has(j));
      if (next == null) break;
      used.add(next); cur = cur.concat(lines[next].slice(1));
    }
    out.push(cur);
  }
  return out;
}
const riverFeatures = [...rivers.entries()].map(([id, r]) => {
  const length = Math.round(r.lines.reduce((s, l) => s + km(l), 0));
  return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: chain(r.lines).map((l) => simplify(l)).filter((l) => l.length > 1) },
    properties: { id, az: AZ_NAMES[r.names.az ?? r.names.local] ?? r.names.az ?? r.names.local, ru: r.names.ru ?? r.names.local, en: r.names.en && !/[^\x00-\x7F]/.test(r.names.en) ? r.names.en : AZ_NAMES[r.names.az ?? r.names.local] ?? r.names.en ?? r.names.local, wikidata: r.wikidata, length, whole: !!r.relation } };
}).filter((f) => f.geometry.coordinates.length && f.properties.length >= 3 && !/kanal|канал|canal/i.test(f.properties.az ?? ''))
  .sort((a, b) => b.properties.length - a.properties.length);

// Lakes and reservoirs: outer rings of named water polygons. Their area here is only a sort key
// (OSM's water outline, which can include marsh or leave out arms, differs from official figures)
const ringArea = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2))); } return Math.abs(a * R * R / 2); };
const water = (await raw('water-geom.json')).elements;
const lakeFeatures = [];
// A relation's outer ring is often split over several ways: join them end to end (turning a piece
// round where it runs the other way) until each ring closes. Rings come back open (no repeated point).
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const open = (r) => r.length > 1 && same(r[0], r.at(-1)) ? r.slice(0, -1) : r;
function stitch(pieces) {
  const left = pieces.map((p) => [...p]), rings = [];
  while (left.length) {
    let ring = left.shift();
    for (let grew = true; grew && !same(ring[0], ring.at(-1));) {
      grew = false;
      for (let i = 0; i < left.length; i++) {
        const p = left[i], end = ring.at(-1);
        if (same(p[0], end)) ring = ring.concat(p.slice(1));
        else if (same(p.at(-1), end)) ring = ring.concat(p.slice(0, -1).reverse());
        else if (same(p.at(-1), ring[0])) ring = p.concat(ring.slice(1));
        else if (same(p[0], ring[0])) ring = [...p].reverse().concat(ring.slice(1));
        else continue;
        left.splice(i, 1); grew = true; break;
      }
    }
    if (same(ring[0], ring.at(-1))) rings.push(open(ring));
  }
  return rings;
}
// Douglas–Peucker needs distinct ends: simplify a ring as two halves, then close it
const simplifyRing = (r, tol) => { const h = Math.floor(r.length / 2); const a = simplify(r.slice(0, h + 1), tol), b = simplify([...r.slice(h), r[0]], tol); return [...a, ...b.slice(1)]; };
for (const e of water) {
  const rings = e.type === 'way' ? [open(line(e.geometry))] : stitch((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => line(m.geometry)));
  const closed = rings.filter((r) => r.length > 3);
  if (!closed.length) continue;
  const area = closed.reduce((s, r) => s + ringArea([...r, r[0]]), 0);
  if (area < 0.5) continue;
  const n = names(e.tags);
  // The Caspian is a sea, not one of the country's lakes
  if (/dənizi|море|sea/i.test(`${n.az} ${n.ru} ${n.en} ${n.local}`)) continue;
  if (n.az === 'Sari Su' || n.local === 'Sari Su') n.az = 'Sarısu';
  lakeFeatures.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: closed.map((r) => [simplifyRing(r, 0.0005)]) },
    properties: { id: e.type[0] + e.id, az: n.az ?? n.local, ru: n.ru ?? n.local, en: n.en ?? n.az ?? n.local, wikidata: e.tags.wikidata ?? null, kind: e.tags.water ?? 'lake', area: Math.round(area * 10) / 10 } });
}
lakeFeatures.sort((a, b) => b.properties.area - a.properties.area);

await writeFile(new URL('rivers.geojson', root), JSON.stringify({ type: 'FeatureCollection', features: riverFeatures }) + '\n');
await writeFile(new URL('lakes.geojson', root), JSON.stringify({ type: 'FeatureCollection', features: lakeFeatures }) + '\n');
console.log(`${riverFeatures.length} rivers (longest: ${riverFeatures.slice(0, 8).map((f) => `${f.properties.az} ${f.properties.length} km`).join(', ')})`);
console.log(`${lakeFeatures.length} lakes and reservoirs (largest: ${lakeFeatures.slice(0, 6).map((f) => `${f.properties.az} ${f.properties.area} km²`).join(', ')})`);
