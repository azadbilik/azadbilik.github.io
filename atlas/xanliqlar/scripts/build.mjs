// Builds the khanates map's data/khanates.geojson from data/khanates.json: each khanate north of the
// Araz as the 1897 uezds made from its lands (RISTAT, doi:10.34894/NQOASN, CC0), or, for Erivan and
// Nakhchivan, OpenHistoricalMap's outlines (CC0: data/raw/ohm-khanates.geojson); capitals as points.
// The result is approximate by construction, and the page says so.
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (u) => JSON.parse(await readFile(u, 'utf8'));
const { khanates, south } = await json(new URL('khanates.json', root));
const uezds = await json(new URL('../../1897/data/raw/uyezds-1897.geojson', import.meta.url));
const ohm = await json(new URL('raw/ohm-khanates.geojson', root));
const polys = (g) => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
const r4 = (x) => Math.round(x * 1e4) / 1e4;

const features = [];
const used = new Map();
// OpenHistoricalMap's outlines first, so the uezd-made khanates are drawn over where the two overlap
for (const k of [...khanates].sort((a, b) => !!b.ohm - !!a.ohm)) {
  let parts, from;
  if (k.ohm) {
    const f = ohm.features.find((x) => x.properties.ohm_relation === k.ohm);
    if (!f) throw new Error(`OHM outline ${k.ohm} missing`);
    parts = polys(f.geometry); from = 'ohm';
  } else {
    parts = k.uezds.flatMap((u) => {
      const f = uezds.features.find((x) => x.properties.Name_RU === u);
      if (!f) throw new Error(`uezd ${u} missing`);
      if (used.has(u)) throw new Error(`uezd ${u} given to both ${used.get(u)} and ${k.id}`);
      used.set(u, k.id);
      return polys(f.geometry);
    });
    from = '1897';
  }
  features.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: parts.map((p) => p.map((r) => r.map(([x, y]) => [r4(x), r4(y)]))) },
    properties: { id: k.id, kind: 'area', from, az: k.names[0], ru: k.names[1], en: k.names[2], color: k.color, annexed: k.annexed, wikidata: k.wikidata, uezds: k.uezds ?? null, ohm: k.ohm ?? null, note: k.note, capitalName: k.capitalName } });
}
for (const k of [...khanates, ...south]) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: k.capital },
  properties: { id: k.id, kind: 'capital', south: !khanates.includes(k), az: k.names[0], ru: k.names[1], en: k.names[2], annexed: k.annexed ?? null, wikidata: k.wikidata, color: k.color ?? null } });

await writeFile(new URL('khanates.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
console.log(`${khanates.length} khanates drawn (${khanates.filter((k) => k.ohm).length} from OpenHistoricalMap), ${south.length} more as capitals; ${used.size} uezds used`);
