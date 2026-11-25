// Smoke test for the Azad Bilik hub, against the live sites: each page answers and carries what
// it is for, the data behind the maps and the gallery is whole, and the links between the hub
// and kitabxana.az still lead somewhere. Plain fetches, no browser: what matters is in the HTML
// the servers send. Exits non-zero on any failure (the workflow then emails the repo's owners).
//
//   node scripts/smoke.mjs            BASE / KX override the hosts
const BASE = process.env.BASE ?? 'https://azadbilik.org';
const KX = process.env.KX ?? 'https://kitabxana.az';
const UA = 'azadbilik-smoke/1.0 (https://github.com/azadbilik/azadbilik.github.io)';

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

async function get(url, as = 'text') {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (res.status >= 500 && attempt < 2) throw new Error(`HTTP ${res.status}`);
      return { status: res.status, type: res.headers.get('content-type') ?? '', body: as === 'json' && res.ok ? await res.json() : as === 'none' ? null : await res.text() };
    } catch (e) {
      if (attempt >= 2) return { status: 0, error: e.message };
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}
const sample = (xs, n) => [...xs].sort(() => Math.random() - 0.5).slice(0, n);

async function page(url, musts) {
  const r = await get(url);
  if (r.status !== 200) return fail(`${url} → ${r.status || r.error}`);
  const missing = musts.filter((m) => !(m instanceof RegExp ? m.test(r.body) : r.body.includes(m)));
  check(missing.length === 0, `${url}${missing.length ? ` lacks ${missing.join(', ')}` : ''}`);
}

console.log('Hub pages');
for (const [path, musts] of [
  ['/', ['href="/xeriteler/"', 'href="/qalereya/"', 'href="/atlas/"', 'id="culture"', 'id="atlas"', 'data-lang="ru"']],
  ['/atlas/', ['href="/atlas/ehali/"', 'href="/xeriteler/"']],
  ['/musiqi/', ['maplibre-gl', 'recordings.json']],
  ['/atlas/icmalar/', ['maplibre-gl', 'extras.json']],
  ['/atlas/xalqlar/', ['maplibre-gl', 'peoples.out.json', 'data/dots-']],
  ['/atlas/caylar/', ['maplibre-gl', 'rivers.geojson']],
  ['/atlas/1897/', ['maplibre-gl', 'census.out.json']],
  ['/atlas/xanliqlar/', ['maplibre-gl', 'data/khanates.geojson']],
  ['/xeriteler/ehali/', ['/atlas/ehali/']],
  ['/xeriteler/', ['href="/xerite/"', 'href="/qalereya/emalatxana/"']],
  ['/xerite/', ['maplibre-gl', 'data/authors.json']],
  ['/qalereya/', ['data/gallery.json', 'id="viewer"']],
  ['/qalereya/emalatxana/', ['maplibre-gl', '../data/manuscripts.json']],
  ['/xeriteler/iskender/', ['maplibre-gl', '/shared/story-map.js', '/shared/viewer.js']],
  ['/xeriteler/xosrov-sirin/', ['maplibre-gl', '/shared/story-map.js', '/shared/viewer.js']],
  ['/xeriteler/yeddi-gozel/', ['maplibre-gl', '/shared/story-map.js', '/shared/viewer.js']],
  ['/atlas/ehali/', ['maplibre-gl', "'units.geojson'"]],
]) await page(BASE + path, musts);

console.log('Data');
const authors = (await get(`${BASE}/xerite/data/authors.json`, 'json')).body ?? [];
check(authors.length >= 300, `literary map: ${authors.length} authors placed (≥ 300)`);
check(authors.every((a) => a.slug && (a.birth || a.death) && [a.birth, a.death].every((p) => !p || (Number.isFinite(p.lat) && Number.isFinite(p.lng)))), 'every placed author has coordinates');
const gallery = (await get(`${BASE}/qalereya/data/gallery.json`, 'json')).body ?? { items: [], poems: [] };
check(gallery.items.length >= 700, `gallery: ${gallery.items.length} pictures (≥ 700)`);
check(gallery.poems.length >= 7 && gallery.poems.every((p) => p.az && p.ru && p.en && p.scenes.every((s) => s.az && s.ru && s.en)), `gallery: ${gallery.poems.length} poems, every poem and scene named in az, ru, en`);
check(gallery.items.filter((x) => x.w).length >= gallery.items.length * 0.95, 'gallery: nearly every picture has a known size (scripts/dims.mjs)');
const catalogue = (await get(`${BASE}/qalereya/data/manuscripts.json`, 'json')).body ?? { manuscripts: [] };
check(catalogue.manuscripts.filter((m) => m.lat != null).length >= 10, `workshops: ${catalogue.manuscripts.filter((m) => m.lat != null).length} manuscripts with a city`);

for (const story of ['iskender', 'xosrov-sirin', 'yeddi-gozel']) {
  const route = (await get(`${BASE}/xeriteler/${story}/route.json`, 'json')).body ?? { stops: [], parts: [] };
  const poemOf = Object.fromEntries((route.parts ?? []).map((p) => [p.id, p.poem]));
  const lost = route.stops.flatMap((s) => s.scenes.filter((id) => !gallery.poems.find((p) => p.slug === poemOf[s.part])?.scenes.some((x) => x.id === id)).map((id) => `${s.id}/${id}`));
  check(route.stops.length >= 10 && lost.length === 0, `story map ${story}: ${route.stops.length} stops${lost.length ? `, scenes missing from the gallery: ${lost.join(', ')}` : ', every scene in the gallery'}`);
}
const units = (await get(`${BASE}/atlas/ehali/data/units.geojson`, 'json')).body ?? { features: [] };
const withPop = units.features.filter((f) => Object.keys(f.properties.pop ?? {}).length);
check(units.features.length >= 130 && withPop.length >= 120, `population map: ${units.features.length} units, ${withPop.length} with census figures`);
console.log('Pictures load (a sample of thumbnails, at their hosts)');
const byHost = new Map();
for (const x of gallery.items) {
  const url = x.thumb.startsWith('thumbs/') ? `${BASE}/qalereya/${x.thumb}` : x.thumb;
  const host = new URL(url).host;
  if (!byHost.has(host)) byHost.set(host, []);
  byHost.get(host).push(url);
}
for (const [host, urls] of byHost) for (const url of sample(urls, 2)) {
  const r = await get(url, 'none');
  check(r.status === 200 && /^image\//.test(r.type), `${host}: ${r.status || r.error} ${r.type ?? ''}`);
}

console.log('kitabxana.az pages show the hub');
const poem = sample(gallery.poems, 1)[0];
await page(`${KX}/collections/${poem.slug}`, ['class="gallery-heading"', 'class="gallery-hub"', `qalereya/?p=${poem.slug}`]);
const chapter = sample(gallery.items.filter((x) => x.chapter), 1)[0]?.chapter;
if (chapter) await page(`${KX}/works/${chapter}`, ['class="gallery-heading"']);
const author = sample(authors.filter((a) => a.birth), 1)[0];
await page(`${KX}/authors/${author.slug}`, [`xerite/?author=${author.slug}`]);
await page(`${KX}/ru/authors/${author.slug}`, [`xerite/?author=${author.slug}&amp;lang=ru`]);

console.log('Museum images through kitabxana.az (next/image allowlist)');
const KX_HOSTS = ['images.metmuseum.org', 'azadbilik.org/qalereya/thumbs', 'upload.wikimedia.org', 'openaccess-cdn.clevelandart.org', 'viewer.cbl.ie'];
const artworks = (await get(`${KX}/api/collections/${gallery.poems[0].slug}/artworks`, 'json')).body ?? [];
const all = [...artworks];
for (const p of gallery.poems.slice(1)) all.push(...((await get(`${KX}/api/collections/${p.slug}/artworks`, 'json')).body ?? []));
for (const host of KX_HOSTS) {
  const a = all.find((x) => (x.imageSmallUrl ?? x.imageUrl)?.includes(host));
  if (!a) { console.log(`  skip  no artwork from ${host}`); continue; }
  const r = await get(`${KX}/_next/image?url=${encodeURIComponent(a.imageSmallUrl ?? a.imageUrl)}&w=384&q=75`, 'none');
  check(r.status === 200 && /^image\//.test(r.type), `${host} via next/image: ${r.status || r.error}`);
}

console.log('Links between the hub and kitabxana.az resolve (samples)');
for (const p of gallery.poems) {
  const r = await get(`${KX}/api/collections/${p.slug}`, 'none');
  check(r.status === 200, `gallery poem ${p.slug} on kitabxana: ${r.status || r.error}`);
}
for (const x of sample(gallery.items.filter((x) => x.chapter), 8)) {
  const r = await get(`${KX}/api/works/${x.chapter}`, 'none');
  check(r.status === 200, `gallery chapter ${x.chapter}: ${r.status || r.error}`);
}
for (const a of sample(authors, 8)) {
  const r = await get(`${KX}/api/authors/${a.slug}`, 'none');
  check(r.status === 200, `map author ${a.slug}: ${r.status || r.error}`);
}

console.log(failures ? `\n${failures} failed` : '\nall good');
process.exit(failures ? 1 : 0);
