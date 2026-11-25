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
const riverFeatures = [...rivers.entries()].map(([id, r]) => {
  const length = Math.round(r.lines.reduce((s, l) => s + km(l), 0));
  return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: r.lines.map((l) => simplify(l)).filter((l) => l.length > 1) },
    properties: { id, az: AZ_NAMES[r.names.az ?? r.names.local] ?? r.names.az ?? r.names.local, ru: r.names.ru ?? r.names.local, en: r.names.en && !/[^\x00-\x7F]/.test(r.names.en) ? r.names.en : AZ_NAMES[r.names.az ?? r.names.local] ?? r.names.en ?? r.names.local, wikidata: r.wikidata, length, whole: !!r.relation } };
}).filter((f) => f.geometry.coordinates.length && f.properties.length >= 3 && !/kanal|канал|canal/i.test(f.properties.az ?? ''))
  .sort((a, b) => b.properties.length - a.properties.length);

// Lakes and reservoirs: outer rings of named water polygons. Their area here is only a sort key:
// OSM holds some (Mingəçevir) in pieces, so the sum falls well short of the official figure
const ringArea = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2))); } return Math.abs(a * R * R / 2); };
const water = (await raw('water-geom.json')).elements;
const lakeFeatures = [];
for (const e of water) {
  const rings = e.type === 'way' ? [line(e.geometry)] : (e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => line(m.geometry));
  const closed = rings.filter((r) => r.length > 3);
  if (!closed.length) continue;
  const area = closed.reduce((s, r) => s + ringArea([...r, r[0]]), 0);
  if (area < 0.5) continue;
  const n = names(e.tags);
  // The Caspian is a sea, not one of the country's lakes
  if (/dənizi|море|sea/i.test(`${n.az} ${n.ru} ${n.en} ${n.local}`)) continue;
  if (n.az === 'Sari Su' || n.local === 'Sari Su') n.az = 'Sarısu';
  lakeFeatures.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: closed.map((r) => [simplify([...r, r[0]], 0.0005)]) },
    properties: { id: e.type[0] + e.id, az: n.az ?? n.local, ru: n.ru ?? n.local, en: n.en ?? n.az ?? n.local, wikidata: e.tags.wikidata ?? null, kind: e.tags.water ?? 'lake', area: Math.round(area * 10) / 10 } });
}
lakeFeatures.sort((a, b) => b.properties.area - a.properties.area);

await writeFile(new URL('rivers.geojson', root), JSON.stringify({ type: 'FeatureCollection', features: riverFeatures }) + '\n');
await writeFile(new URL('lakes.geojson', root), JSON.stringify({ type: 'FeatureCollection', features: lakeFeatures }) + '\n');
console.log(`${riverFeatures.length} rivers (longest: ${riverFeatures.slice(0, 8).map((f) => `${f.properties.az} ${f.properties.length} km`).join(', ')})`);
console.log(`${lakeFeatures.length} lakes and reservoirs (largest: ${lakeFeatures.slice(0, 6).map((f) => `${f.properties.az} ${f.properties.area} km²`).join(', ')})`);
