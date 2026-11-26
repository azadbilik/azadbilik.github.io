// Second step of the rivers map: every river that flows into the Kür or the Araz, at any remove and over
// its whole length (Georgia, Armenia, Turkey, Iran as well as Azerbaijan), and the basin's lakes, from
// OpenStreetMap (ODbL) extracts of the five countries cut to the basin (see README for the osmium
// commands that make data/raw/pbf/basin-water.geojsonseq and rel.opl). Run after build.mjs:
//   node scripts/basin.mjs
// It replaces each river build.mjs drew only inside Azerbaijan with its whole course, adds the rest of
// the network, and adds lakes; names in Azerbaijani, Russian and English come from OSM, else Wikidata.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const MIN_KM = 10;
const OUT_LAKE_KM2 = 2;

// ---- read the extracts
const feats = (await readFile(new URL('raw/pbf/basin-water.geojsonseq', root), 'utf8')).split('\x1e').filter((l) => l.trim()).map((l) => JSON.parse(l));
const decode = (s) => s.replace(/%([0-9a-f]+)%/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const rels = (await readFile(new URL('raw/pbf/rel.opl', root), 'utf8')).split('\n').filter((l) => l.startsWith('r')).map((l) => {
  const id = l.split(' ')[0].slice(1);
  const tags = Object.fromEntries((l.match(/ T(\S*)/)?.[1] ?? '').split(',').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return [decode(kv.slice(0, i)), decode(kv.slice(i + 1))]; }));
  const members = (l.match(/ M(\S*)/)?.[1] ?? '').split(',').filter(Boolean).map((m) => { const [ref, role = ''] = m.split('@'); return { type: ref[0], ref: ref.slice(1), role: decode(role) }; });
  return { id, tags, members };
});

const R = 6371.0088, rad = (d) => d * Math.PI / 180;
const km = (line) => line.slice(1).reduce((s, [x, y], i) => { const [x0, y0] = line[i]; const a = Math.sin(rad(y - y0) / 2) ** 2 + Math.cos(rad(y0)) * Math.cos(rad(y)) * Math.sin(rad(x - x0) / 2) ** 2; return s + 2 * R * Math.asin(Math.sqrt(a)); }, 0);
const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
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
// Join each way to the one that starts where it ends, never turning one round (OSM draws rivers downstream)
function chain(lines) {
  const starts = new Map();
  for (const [i, l] of lines.entries()) { const k = key(l[0]); if (!starts.has(k)) starts.set(k, []); starts.get(k).push(i); }
  const used = new Set(), endsAt = new Set(lines.map((l) => key(l.at(-1))));
  const order = [...lines.keys()].sort((a, b) => endsAt.has(key(lines[a][0])) - endsAt.has(key(lines[b][0])));
  const out = [];
  for (const i of order) {
    if (used.has(i)) continue;
    used.add(i);
    let cur = [...lines[i]];
    for (;;) { const next = (starts.get(key(cur.at(-1))) ?? []).find((j) => !used.has(j)); if (next == null) break; used.add(next); cur = cur.concat(lines[next].slice(1)); }
    out.push(cur);
  }
  return out;
}

// ---- rivers: whole rivers from relations, then named ways joined by name where they touch
const ways = new Map();
for (const f of feats) if (f.properties['@type'] === 'way' && f.properties.waterway === 'river' && f.geometry?.type === 'LineString') ways.set(String(f.properties['@id']), f);
const rivers = [];
const inRel = new Set();
for (const r of rels.filter((r) => r.tags.waterway === 'river' || (r.tags.type === 'waterway' && (r.tags.waterway ?? 'river') === 'river'))) {
  const ids = r.members.filter((m) => m.type === 'w' && ['', 'main_stream', 'side_stream', 'main', 'outer'].includes(m.role) && ways.has(m.ref)).map((m) => m.ref);
  if (!ids.length) continue;
  ids.forEach((id) => inRel.add(id));
  rivers.push({ id: 'r' + r.id, tags: r.tags, lines: ids.map((id) => ways.get(id).geometry.coordinates) });
}
const nameOf = (t) => t['name:az'] || t.name || t['name:en'] || null;
const byName = new Map();
for (const [id, f] of ways) {
  if (inRel.has(id)) continue;
  const n = nameOf(f.properties);
  if (!n) continue;
  if (!byName.has(n)) byName.set(n, []);
  byName.get(n).push(f);
}
// Ways of the same name that touch are one river; far-apart namesakes stay apart
for (const [n, fs] of byName) {
  const parent = fs.map((_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const at = new Map();
  fs.forEach((f, i) => { for (const p of [f.geometry.coordinates[0], f.geometry.coordinates.at(-1)]) { const k = key(p); if (at.has(k)) parent[find(i)] = find(at.get(k)); else at.set(k, i); } });
  const groups = new Map();
  fs.forEach((f, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(f); });
  for (const g of groups.values()) {
    const tags = {};
    for (const f of g) for (const [k, v] of Object.entries(f.properties)) if (!k.startsWith('@') && !(k in tags)) tags[k] = v;
    rivers.push({ id: 'w' + g[0].properties['@id'], tags, lines: g.map((f) => f.geometry.coordinates) });
  }
}
// Pieces of one river that don't touch (a gap in the mapping) are joined by their Wikidata id
{
  const byQ = new Map();
  for (const r of rivers) {
    const q = r.tags.wikidata;
    if (!q) continue;
    if (byQ.has(q)) { const keep = byQ.get(q); keep.lines.push(...r.lines); r.merged = true; if (r.id.startsWith('r') && !keep.id.startsWith('r')) { keep.id = r.id; keep.tags = { ...r.tags, ...keep.tags, ...r.tags }; } }
    else byQ.set(q, r);
  }
  for (let i = rivers.length - 1; i >= 0; i--) if (rivers[i].merged) rivers.splice(i, 1);
}
for (const r of rivers) { r.chained = chain(r.lines); r.length = r.lines.reduce((s, l) => s + km(l), 0); }

// ---- where each river ends: the downstream end of its longest line, on another river (a shared node),
// else the nearest river point within 3 km (a river that ends in a reservoir the main river runs through)
const vertexOwner = new Map();
const grid = new Map();
const cell = (x, y) => `${Math.floor(x / 0.05)},${Math.floor(y / 0.05)}`;
rivers.forEach((r, i) => { for (const l of r.lines) for (const p of l) { const k = key(p); if (!vertexOwner.has(k)) vertexOwner.set(k, new Set()); vertexOwner.get(k).add(i); const c = cell(p[0], p[1]); if (!grid.has(c)) grid.set(c, []); grid.get(c).push([p[0], p[1], i]); } });
function receiver(i) {
  const r = rivers[i];
  const main = r.chained.reduce((a, b) => km(b) > km(a) ? b : a);
  const mouth = main.at(-1);
  const exact = [...(vertexOwner.get(key(mouth)) ?? [])].filter((j) => j !== i);
  if (exact.length) return exact.sort((a, b) => rivers[b].length - rivers[a].length)[0];
  let best = null, bestD = 3;
  const [cx, cy] = [Math.floor(mouth[0] / 0.05), Math.floor(mouth[1] / 0.05)];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const [x, y, j] of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
    if (j === i) continue;
    const d = km([mouth, [x, y]]);
    if (d < bestD) { bestD = d; best = j; }
  }
  return best;
}
const KURA = rivers.findIndex((r) => r.tags.wikidata === 'Q156557'), ARAZ = rivers.findIndex((r) => r.tags.wikidata === 'Q179751');
if (KURA < 0 || ARAZ < 0) throw new Error('Kür or Araz relation not found in the extract');
// A river whose lower course ends in canals (the Hrazdan) still names where it goes: OSM's destination tag
const allNames = (t) => ['name', 'name:az', 'name:en', 'name:ru', 'name:tr', 'name:hy', 'name:ka', 'name:fa', 'int_name'].map((k) => t[k]).filter(Boolean).map((s) => s.toLowerCase());
const DEST = new Map([[KURA, allNames(rivers[KURA].tags)], [ARAZ, allNames(rivers[ARAZ].tags)]]);
// The tag wins over geometry when it names the Kür or the Araz: near the Hrazdan's end a ditch is closer
const recv = rivers.map((r, i) => {
  if (i !== KURA && i !== ARAZ && r.tags.destination) {
    const d = r.tags.destination.toLowerCase();
    for (const [k, ns] of DEST) if (ns.includes(d)) return k;
  }
  return receiver(i);
});
const inBasin = new Set([KURA, ARAZ]);
for (let grew = true; grew;) { grew = false; rivers.forEach((r, i) => { if (!inBasin.has(i) && recv[i] != null && inBasin.has(recv[i]) && r.length >= 1) { inBasin.add(i); grew = true; } }); }
// A river with no usable name (none, or just «رودخانه», “river”) is left out
const usable = (t) => { const n = (t['name:az'] || t.name || t['name:en'] || '').trim(); return n && !/^(رودخانه|river|çay|река)$/i.test(n); };
const network = [...inBasin].filter((i) => i === KURA || i === ARAZ || (rivers[i].length >= MIN_KM && usable(rivers[i].tags)));

// ---- names: OSM's az/ru/en, else Wikidata's labels, else the local name
const qids = [...new Set(network.map((i) => rivers[i].tags.wikidata).filter(Boolean))];
const labels = {};
for (let k = 0; k < qids.length; k += 50) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=az|ru|en|tr&ids=${qids.slice(k, k + 50).join('|')}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'AzadBilikAtlas/1.0 (https://azadbilik.org)' } });
    for (const [q, e] of Object.entries((await res.json()).entities ?? {})) labels[q] = Object.fromEntries(Object.entries(e.labels ?? {}).map(([l, v]) => [l, v.value]));
  } catch (e) { console.warn('Wikidata labels:', e.message); }
}
// Georgian and Armenian letters to Latin, for rivers with no name in az/ru/en anywhere
const KA = 'ა a ბ b გ g დ d ე e ვ v ზ z თ t ი i კ k ლ l მ m ნ n ო o პ p ჟ zh რ r ს s ტ t უ u ფ p ქ k ღ gh ყ q შ sh ჩ ch ც ts ძ dz წ ts ჭ ch ხ kh ჯ j ჰ h'.split(' ');
const HY = 'ա a բ b գ g դ d ե e զ z է e ը ə թ t ժ zh ի i լ l խ kh ծ ts կ k հ h ձ dz ղ gh ճ ch մ m յ y ն n շ sh ո o չ ch պ p ջ j ռ r ս s վ v տ t ր r ց ts ւ v փ p ք k օ o ֆ f'.split(' ');
const table = new Map(); for (const t of [KA, HY]) for (let i = 0; i < t.length; i += 2) table.set(t[i], t[i + 1]);
const latin = (s) => s && /[Ⴀ-ჿ԰-֏]/.test(s) ? [...s.toLowerCase()].map((c) => table.get(c) ?? c).join('').replace(/^./, (c) => c.toUpperCase()) : s;
// Names of rivers in Iranian Azerbaijan written in Arabic script, and Latin spellings without Azerbaijani letters
const AZ_FIX = { 'Ghara Su': 'Qarasu', 'الند چایی': 'Ələnd çayı', 'بالخلی چای': 'Balıqlı çay', 'اینچه چای': 'İncə çay', 'خانقاه چایی': 'Xanəgah çayı', 'Tikanli Cay': 'Tikanlı çay', 'Nadir cayi': 'Nadir çayı', 'Ergene cay': 'Ergene çayı', 'Ceyrankeçməz cayı': 'Ceyrankeçməz çayı', 'Келалчай': 'Kelalçay' };
// Latin letters, Azerbaijani ə included (U+0259)
const LATIN = /^[\u0000-ʯ\s'’()-]+$/u;
function names(r) {
  const t = r.tags, w = labels[t.wikidata] ?? {};
  const local = t.name ?? t['name:en'] ?? '';
  // Azerbaijani, else the local name where it is in Latin letters (Turkey), else English, Turkish, a transliteration
  // Wikidata's az label of a river is sometimes its lake («Paravani gölü»)
  const waz = w.az && !/gölü?$/i.test(w.az) ? w.az : null;
  const pick = t['name:az'] || waz || (LATIN.test(local) ? local : null) || t['name:en'] || w.en || t['name:tr'] || w.tr || latin(local);
  const az = AZ_FIX[pick] ?? AZ_FIX[local] ?? pick;
  return { az, ru: t['name:ru'] || w.ru || local, en: (t['name:en'] && !/[^\x00-\x7F’'-]/.test(t['name:en']) ? t['name:en'] : null) || w.en || az };
}

// ---- merge with build.mjs's rivers: a river it drew (by relation id, or by Wikidata id) gets its whole course
const old = JSON.parse(await readFile(new URL('rivers.geojson', root), 'utf8'));
const taken = new Set();
const feature = (i, base) => {
  const r = rivers[i];
  const n = names(r);
  const props = base ? { ...base.properties } : { id: r.id, az: n.az, ru: n.ru, en: n.en, wikidata: r.tags.wikidata ?? null };
  return { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: r.chained.map((l) => simplify(l)).filter((l) => l.length > 1) },
    properties: { ...props, length: Math.round(r.length), whole: true, basin: true } };
};
const byId = new Map(network.map((i) => [rivers[i].id, i]));
const byQ = new Map(network.filter((i) => rivers[i].tags.wikidata).map((i) => [rivers[i].tags.wikidata, i]));
// …or by its name where the two overlap on the map (build.mjs groups by name, without a Wikidata id)
const box = (lines) => { let b = [180, 90, -180, -90]; for (const l of lines) for (const [x, y] of l) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; return b; };
const overlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const netNames = network.map((i) => ({ i, az: names(rivers[i]).az, local: rivers[i].tags.name, b: box(rivers[i].lines) }));
const out = [];
for (const f of old.features) {
  let i = byId.get(f.properties.id) ?? (f.properties.wikidata ? byQ.get(f.properties.wikidata) : undefined);
  if (i == null) { const fb = box(f.geometry.coordinates); i = netNames.find((n) => (n.az === f.properties.az || n.local === f.properties.az) && overlap(n.b, fb))?.i; }
  if (i == null) { out.push(f); continue; }
  if (taken.has(i)) continue; // another piece of a river already drawn whole
  taken.add(i);
  // Keep a river's own length if it was already whole (the Samur runs out of this extract into Dagestan)
  out.push(f.properties.whole && rivers[i].length < f.properties.length * .9 ? f : feature(i, f));
}
let added = 0;
for (const i of network) if (!taken.has(i)) { out.push(feature(i)); added++; }
out.sort((a, b) => b.properties.length - a.properties.length);

// ---- lakes: the basin's big lakes (Sevan, Çıldır, Paravani…) and Azerbaijan's that build.mjs missed
const units = JSON.parse(await readFile(new URL('../../ehali/data/units.geojson', import.meta.url), 'utf8')).features.filter((f) => f.properties.country === 'az');
function inRing(x, y, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const inAz = ([x, y]) => units.some((u) => polys(u.geometry).some((p) => inRing(x, y, p[0])));
const ringArea = (ring) => { let a = 0; for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2))); } return Math.abs(a * R * R / 2); };
const lakes = JSON.parse(await readFile(new URL('lakes.geojson', root), 'utf8'));
// Abroad, only lakes the network runs into or out of (Göyçə, Çıldır, Paravani, Arpi…), not Van or Urmia
const netGrid = new Map();
for (const i of network) for (const l of rivers[i].lines) for (const p of l) { const c = cell(p[0], p[1]); if (!netGrid.has(c)) netGrid.set(c, []); netGrid.get(c).push(p); }
function touchesNetwork(rings) {
  for (const r of rings) for (let k = 0; k < r.length; k += 2) {
    const [x, y] = r[k], cx = Math.floor(x / 0.05), cy = Math.floor(y / 0.05);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const q of netGrid.get(`${cx + dx},${cy + dy}`) ?? []) if (km([[x, y], q]) < 1.5) return true;
  }
  return false;
}
const haveQ = new Set(lakes.features.map((f) => f.properties.wikidata).filter(Boolean));
const haveName = new Set(lakes.features.map((f) => f.properties.az));
const simplifyRing = (r, tol) => { const h = Math.floor(r.length / 2); const a = simplify(r.slice(0, h + 1), tol), b = simplify([...r.slice(h), r[0]], tol); return [...a, ...b.slice(1)]; };
let lakesAdded = 0;
for (const f of feats) {
  const t = f.properties;
  if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type) || !(t.natural === 'water' || t.landuse === 'reservoir') || !t.name) continue;
  if (['river', 'canal', 'pond', 'wastewater', 'basin', 'fishpond', 'moat', 'pool', 'ditch', 'stream'].includes(t.water)) continue;
  if (/dənizi|море|sea|deryası|دریا/i.test(`${t.name} ${t['name:az'] ?? ''} ${t['name:en'] ?? ''}`)) continue;
  const outer = polys(f.geometry).map((p) => p[0]);
  const area = outer.reduce((s, r) => s + ringArea(r), 0);
  const c = outer[0][0];
  const az = inAz(c);
  if (area < (az ? 0.05 : OUT_LAKE_KM2)) continue;
  if (!az && !touchesNetwork(outer)) continue;
  if (t.wikidata && haveQ.has(t.wikidata)) continue;
  const n = names({ tags: t });
  if (haveName.has(n.az) || /^(su (deposu|depo|hovuzu|çəni|anbarı)|göl|adsız)$/i.test(n.az ?? '')) continue;
  haveName.add(n.az); if (t.wikidata) haveQ.add(t.wikidata);
  lakes.features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: outer.map((r) => [simplifyRing(r.slice(0, -1), 0.0005)]) },
    properties: { id: t['@type'][0] + t['@id'], az: n.az, ru: n.ru, en: n.en, wikidata: t.wikidata ?? null, kind: t.water === 'reservoir' || t.landuse === 'reservoir' ? 'reservoir' : 'lake', area: Math.round(area * 10) / 10, abroad: !az } });
  lakesAdded++;
}
// Lakes still to come in the basin's names: a little transliteration for names only in Georgian/Armenian
lakes.features.sort((a, b) => b.properties.area - a.properties.area);

await writeFile(new URL('rivers.geojson', root), JSON.stringify({ type: 'FeatureCollection', features: out }) + '\n');
await writeFile(new URL('lakes.geojson', root), JSON.stringify(lakes) + '\n');
console.log(`basin: ${network.length} rivers of the Kür–Araz network (≥ ${MIN_KM} km), ${taken.size} replaced with their whole course, ${added} added; ${out.length} rivers in all`);
console.log(`lakes: ${lakesAdded} added, ${lakes.features.length} in all (largest added: ${lakes.features.filter((f) => f.properties.abroad).slice(0, 6).map((f) => `${f.properties.az} ${f.properties.area} km²`).join(', ')})`);
console.log('longest:', out.slice(0, 14).map((f) => `${f.properties.az} ${f.properties.length}`).join(', '));
