// İçərişəhər walking map: data/places.json + data/walks.json (by hand) → data/site.json (the page reads it).
//
//   node scripts/build.mjs            uses the downloads cached in data/raw/
//   node scripts/build.mjs --refresh  downloads Wikidata, Wikipedia, Commons and OpenStreetMap again
//
// No dates of our own: Wikidata's inception years often disagree with the articles (rebuilds, rough
// centuries), so the article's opening carries the date.
// Per place: name from Wikidata, position from OpenStreetMap when an OSM feature carries the
// place's Wikidata id (Wikidata's own points are often rounded or shared by a whole complex), else
// Wikidata, else the place's own "at". Text: the opening of the Wikipedia article in each language.
// Photo: the Wikidata image (P18), with author and licence from Commons. Walks follow the streets:
// the shortest way on OpenStreetMap's footways and streets between consecutive stops.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = ROOT + 'data/raw/';
const REFRESH = process.argv.includes('--refresh');
const UA = { 'User-Agent': 'azadbilik.org map builder (https://azadbilik.org)' };
const LANGS = ['az', 'ru', 'en'];
const BBOX = '40.3615,49.8270,40.3715,49.8420'; // s,w,n,e: the walls with a street's margin
const OUTLINE_WAY = 152190481; // OSM «İçəri Şəhər», place=neighbourhood: the line of the walls

const json = async (f) => JSON.parse(await readFile(f, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cached(name, get) {
  const f = RAW + name;
  if (!REFRESH && existsSync(f)) return json(f);
  const v = await get();
  await writeFile(f, JSON.stringify(v));
  return v;
}
async function fetchJSON(url, opts = {}) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { ...opts, headers: { ...UA, ...opts.headers } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    console.warn(`  ${r.status} ${url.slice(0, 90)}… retrying`);
    await sleep(2000 * 2 ** i);
  }
  throw new Error('gave up: ' + url);
}
const overpass = (q) => fetchJSON('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) });

await mkdir(RAW, { recursive: true });
const places = await json(ROOT + 'data/places.json');
const walks = await json(ROOT + 'data/walks.json');
const qids = places.map((p) => p.qid);

// ---- Wikidata
const wd = await cached('wikidata.json', async () => {
  const q = `SELECT ?i ?c ?img ?inc ?prec ?lab ?ll ?art WHERE { VALUES ?i { ${qids.map((q) => 'wd:' + q).join(' ')} }
    OPTIONAL { ?i wdt:P625 ?c } OPTIONAL { ?i wdt:P18 ?img }
    OPTIONAL { ?i p:P571/psv:P571 [ wikibase:timeValue ?inc; wikibase:timePrecision ?prec ] }
    OPTIONAL { ?i rdfs:label ?lab FILTER(lang(?lab) IN ("az","ru","en")) BIND(lang(?lab) AS ?ll) }
    OPTIONAL { ?art schema:about ?i; schema:isPartOf ?w FILTER(?w IN (<https://az.wikipedia.org/>, <https://ru.wikipedia.org/>, <https://en.wikipedia.org/>)) } }`;
  return (await fetchJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q))).results.bindings;
});
const W = {};
for (const b of wd) {
  const q = b.i.value.split('/').pop();
  const w = (W[q] ??= { name: {}, wiki: {}, img: null, c: null, inc: null });
  if (b.lab) w.name[b.ll.value] = b.lab.value;
  if (b.c && !w.c) w.c = b.c.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
  if (b.img && !w.img) w.img = decodeURIComponent(b.img.value.split('/').pop());
  if (b.inc && !w.inc) w.inc = { y: parseInt(b.inc.value.replace(/^\+?(-?\d+).*/, '$1'), 10), p: +b.prec.value };
  if (b.art) {
    const u = new URL(b.art.value);
    w.wiki[u.hostname.slice(0, 2)] = decodeURIComponent(u.pathname.replace('/wiki/', ''));
  }
}

// ---- Wikipedia: the article's opening, two sentences or so
const wiki = await cached('wikipedia.json', async () => {
  const out = {};
  for (const q of qids) for (const l of LANGS) {
    const t = W[q]?.wiki[l];
    if (!t) continue;
    const s = await fetchJSON(`https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t)}`);
    if (s?.extract) out[`${q}/${l}`] = { title: s.titles?.normalized ?? t, extract: s.extract };
    await sleep(100);
  }
  return out;
});
function opening(text, max = 340) {
  const parts = text.replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) ?? [text];
  let out = '';
  for (const p of parts) {
    if (out && (out + p).length > max) break;
    out += p;
  }
  return out.trim();
}

// ---- Commons: a 640px picture, its author and licence
const files = [...new Set(qids.map((q) => W[q]?.img).filter(Boolean))];
const commons = await cached('commons.json', async () => {
  const out = {};
  for (let i = 0; i < files.length; i += 40) {
    const titles = files.slice(i, i + 40).map((f) => 'File:' + f).join('|');
    const r = await fetchJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&titles=${encodeURIComponent(titles)}`);
    const norm = Object.fromEntries((r.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(r.query.pages)) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      const m = ii.extmetadata ?? {};
      const strip = (s) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      out[(norm[p.title] ?? p.title).replace(/^File:/, '')] = {
        thumb: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, page: ii.descriptionurl,
        artist: strip(m.Artist?.value).slice(0, 80), license: strip(m.LicenseShortName?.value),
      };
    }
  }
  return out;
});

// ---- OpenStreetMap: positions, the walls, the streets
const osmPlaces = await cached('osm-wikidata.json', () => overpass(`[out:json][timeout:90];nwr["wikidata"](${BBOX});out tags center;`));
const osmAt = {};
for (const e of osmPlaces.elements) {
  const c = e.center ?? e;
  if (c.lat && !osmAt[e.tags.wikidata]) osmAt[e.tags.wikidata] = [c.lon, c.lat];
}
const osm = await cached('osm.json', () => overpass(`[out:json][timeout:90];(way["highway"](${BBOX});way(${OUTLINE_WAY}););out tags geom;`));
const outline = osm.elements.find((e) => e.id === OUTLINE_WAY).geometry.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);

const R = 6371008.8, rad = Math.PI / 180;
const dist = (a, b) => {
  const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad), y = (b[1] - a[1]) * rad;
  return Math.hypot(x, y) * R;
};
const NO_WALK = /^(motorway|trunk|raceway|construction|proposed)/;
const nodes = new Map(); // "lon,lat" → { p, edges: [[key, m]] }
for (const e of osm.elements) {
  const h = e.tags?.highway;
  if (!h || NO_WALK.test(h) || e.tags.foot === 'no' || e.tags.access === 'private') continue;
  const pts = e.geometry.map((p) => [p.lon, p.lat]);
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1], pts[i]], ka = a.join(), kb = b.join(), m = dist(a, b);
    (nodes.get(ka) ?? nodes.set(ka, { p: a, edges: [] }).get(ka)).edges.push([kb, m]);
    (nodes.get(kb) ?? nodes.set(kb, { p: b, edges: [] }).get(kb)).edges.push([ka, m]);
  }
}
const nearest = (p) => {
  let best = null, bm = Infinity;
  for (const [k, n] of nodes) { const m = dist(p, n.p); if (m < bm) { bm = m; best = k; } }
  return bm < 80 ? best : null;
};
function route(a, b) {
  const ka = nearest(a), kb = nearest(b);
  if (!ka || !kb) return [a, b];
  const d = new Map([[ka, 0]]), prev = new Map(), done = new Set();
  // the graph is a few thousand nodes: a plain scan for the next node is quick enough
  const open = new Set([ka]);
  while (open.size) {
    let k = null, km = Infinity;
    for (const o of open) if (d.get(o) < km) { km = d.get(o); k = o; }
    open.delete(k);
    if (k === kb) break;
    done.add(k);
    for (const [n, m] of nodes.get(k).edges) {
      if (done.has(n)) continue;
      const nd = km + m;
      if (nd < (d.get(n) ?? Infinity)) { d.set(n, nd); prev.set(n, k); open.add(n); }
    }
  }
  if (!d.has(kb)) return [a, b];
  const path = [];
  for (let k = kb; k; k = prev.get(k)) path.unshift(nodes.get(k).p);
  return [a, ...path, b];
}

// ---- Put it together
const missing = [];
const out = places.map((p) => {
  const w = W[p.qid] ?? { name: {}, wiki: {} };
  const at = p.at ?? osmAt[p.qid] ?? w.c;
  if (!at) missing.push(p.id);
  const text = {}, title = {};
  for (const l of LANGS) {
    const s = wiki[`${p.qid}/${l}`];
    if (s) { text[l] = opening(s.extract); title[l] = s.title; }
  }
  const img = w.img && commons[w.img] ? { file: w.img, ...commons[w.img] } : null;
  return {
    id: p.id, qid: p.qid, kind: p.kind,
    at: at.map((v) => +v.toFixed(6)),
    // Wikidata labels carry their disambiguation: «Cümə məscidi (Köhnə Bakı)»
    name: Object.fromEntries(Object.entries({ ...w.name, ...p.name }).map(([l, n]) => [l, n.replace(/\s*\([^)]*\)\s*$/, '')])),
    text, wiki: title, img,
  };
});
if (missing.length) throw new Error('no position: ' + missing.join(', '));
const byId = Object.fromEntries(out.map((p) => [p.id, p]));
const walksOut = walks.map((w) => {
  for (const s of w.stops) if (!byId[s]) throw new Error(`walk ${w.id}: no place ${s}`);
  const path = [];
  for (let i = 1; i < w.stops.length; i++) {
    // "direct": a walk inside one complex (the palace courts) whose paths OSM doesn't hold; stop to stop
    const a = byId[w.stops[i - 1]].at, b = byId[w.stops[i]].at;
    const seg = w.direct ? [a, b] : route(a, b);
    path.push(...(i === 1 ? seg : seg.slice(1)));
  }
  const m = path.slice(1).reduce((s, p, i) => s + dist(path[i], p), 0);
  return { ...w, path: path.map((p) => p.map((v) => +v.toFixed(6))), m: Math.round(m / 10) * 10 };
});

await writeFile(ROOT + 'data/site.json', JSON.stringify({ outline, places: out, walks: walksOut }));
const noText = out.filter((p) => !Object.keys(p.text).length).map((p) => p.id);
console.log(`${out.length} places (${out.filter((p) => p.img).length} with a photo; no Wikipedia text: ${noText.join(', ') || 'none'})`);
for (const w of walksOut) console.log(`walk ${w.id}: ${w.stops.length} stops, ${w.m} m`);
