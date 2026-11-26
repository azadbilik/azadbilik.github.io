// Lays out the "Force" view of the places network at build time (ForceAtlas2, scripts/graph-layout.mjs), so
// the page shows it settled at once: data/net-pos.bin, Int16 x, y per place in insanlar.json's order (places
// in no flow get 0, 0). The graph is every person's birthplace → place of death (all eras, everyone); the
// page's filters then only hide and show. The "Geography" view needs no layout. Run after build.mjs (which
// calls it); deterministic.
import { readFileSync, writeFileSync } from 'node:fs';
import { forceLayout, quantise } from '../../../scripts/graph-layout.mjs';

const D = JSON.parse(readFileSync(new URL('../data/insanlar.json', import.meta.url), 'utf8'));
const BP = 6, DP = 7, n = D.places.length, w = new Map();
for (const r of D.people) {
  if (r[BP] < 0 || r[DP] < 0 || r[BP] === r[DP]) continue;
  const a = Math.min(r[BP], r[DP]), b = Math.max(r[BP], r[DP]), k = a * 1e5 + b;
  w.set(k, (w.get(k) ?? 0) + 1);
}
const inFlow = new Uint8Array(n);
for (const k of w.keys()) { inFlow[Math.floor(k / 1e5)] = 1; inFlow[k % 1e5] = 1; }
const edges = [...w].map(([k, c]) => [Math.floor(k / 1e5), k % 1e5, Math.log2(1 + c)]);
const xy = quantise(await forceLayout(n, edges, { include: inFlow, iterations: 1500, settings: { slowDown: 1, scalingRatio: 3, gravity: 0.05, strongGravityMode: true, outboundAttractionDistribution: true } }));
writeFileSync(new URL('../data/net-pos.bin', import.meta.url), Buffer.from(xy.buffer));
console.log(`layout: net-pos.bin ${(xy.byteLength / 1024).toFixed(0)} KB, ${edges.length} place pairs`);
