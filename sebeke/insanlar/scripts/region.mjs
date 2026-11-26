// The region "historical Azerbaijan" as polygons built from the hub's own data:
//  - today's Republic of Azerbaijan: the 78 districts of atlas/ehali (geoBoundaries)
//  - the Iranian provinces East Azerbaijan, West Azerbaijan, Ardabil, Zanjan: atlas/ehali too
//  - the 1897 uezds/okrugs where at least 25% gave Azerbaijani ("Tatar") as native language
//    (atlas/1897, RISTAT boundaries): Erivan, Etchmiadzin, Surmali, Sharur-Daralayaz, Novobayazet,
//    Zangezur, Borchali, Zaqatala, Kaitag-Tabasaran (Derbent), and the Baku/Elisabethpol uezds
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url);
const load = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));

const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates);
const bboxOf = (polys) => {
  let a = 180, b = 90, c = -180, d = -90;
  for (const p of polys) for (const [x, y] of p[0]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
};
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));

export function buildRegion() {
  const units = [];
  for (const f of load('atlas/ehali/data/units.geojson').features) {
    const p = f.properties;
    if (p.country === 'az') units.push({ group: 'az', name: p.en, polys: polysOf(f.geometry) });
    else if (p.country === 'ir') units.push({ group: 'ir', name: p.en + ' (' + p.province + ')', polys: polysOf(f.geometry) });
  }
  for (const f of load('atlas/1897/data/units.geojson').features) {
    const p = f.properties;
    const share = (p.langs.azerbaijani ?? 0) / p.total;
    if (share >= 0.25) units.push({ group: 'oth', name: p.en + ' (1897)', polys: polysOf(f.geometry) });
  }
  // Derbent (a uezd's seat in Kyurin okrug, where Azerbaijani is only 2%): a 25 km disc around the city
  {
    const ring = [];
    for (let i = 0; i <= 36; i++) { const t = (i / 36) * 2 * Math.PI; ring.push([48.2906 + 0.3 * Math.cos(t), 42.0575 + 0.225 * Math.sin(t)]); }
    units.push({ group: 'oth', name: 'Derbent (25 km disc)', polys: [[ring]] });
  }
  for (const u of units) u.bbox = bboxOf(u.polys);
  const all = units.reduce((m, u) => [Math.min(m[0], u.bbox[0]), Math.min(m[1], u.bbox[1]), Math.max(m[2], u.bbox[2]), Math.max(m[3], u.bbox[3])], [180, 90, -180, -90]);
  return {
    units, bbox: all,
    find(x, y) {
      for (const u of units) {
        if (x < u.bbox[0] || x > u.bbox[2] || y < u.bbox[1] || y > u.bbox[3]) continue;
        if (u.polys.some((p) => inPoly(x, y, p))) return u;
      }
      return null;
    },
    touches(a, b, c, d) { return units.some((u) => !(c < u.bbox[0] || a > u.bbox[2] || d < u.bbox[1] || b > u.bbox[3])); },
  };
}
