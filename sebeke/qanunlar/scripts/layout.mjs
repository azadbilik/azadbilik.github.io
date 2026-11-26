// Lays out the network at build time (ForceAtlas2, scripts/graph-layout.mjs) so the page shows it settled
// at once. The normative core (Constitution, codes, laws, decrees, Cabinet decisions, tied to each other) is
// laid out first, alone; every other act is then placed around it with the core held still, so the "all
// acts" switch adds to the picture without moving it.
//   data/pos.bin     Int16 x, y per node, in qanunlar.json's node order
//   data/labels.json short titles of the 3,000 most amended / implemented acts: the graph's labels before
//                    titles.json (9 MB) is loaded
// Run after build.mjs (which calls it); deterministic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forceLayout, quantise } from '../../../scripts/graph-layout.mjs';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const D = JSON.parse(fs.readFileSync(path.join(OUT, 'qanunlar.json'), 'utf8'));
const N = D.nodes.id.length, E = D.edges, CORE = new Set([0, 1, 2, 3, 5]);
const cat = (i) => D.types[D.nodes.tn[i]][1];
const core = new Uint8Array(N), edges = [];
for (let k = 0; k < E.length; k += 3) {
  const s = E[k], d = E[k + 1]; edges.push([s, d, 1]);
  if (CORE.has(cat(s)) && CORE.has(cat(d))) core[s] = core[d] = 1;
}
const xy = quantise(await forceLayout(N, edges, { core, iterations: 900, settings: { slowDown: 1, strongGravityMode: true, gravity: 0.02, scalingRatio: 2, outboundAttractionDistribution: false, edgeWeightInfluence: 1 } }));
fs.writeFileSync(path.join(OUT, 'pos.bin'), Buffer.from(xy.buffer));

// labels: the acts most often amended or implemented (the graph sizes and ranks its labels by that)
const T = JSON.parse(fs.readFileSync(path.join(OUT, 'titles.json'), 'utf8'));
const score = new Float64Array(N);
for (let k = 0; k < E.length; k += 3) score[E[k + 1]] += E[k + 2] === 0 ? 1 : 0.5;
export const shortTitle = (s) => s.replace(/\s+/g, ' ').trim().replace(/^Azərbaycan Respublikasının\s+|^Azərbaycan Respublikası\s+/u, '')
  .replace(/\s*\(QÜVVƏDƏN DÜŞÜB\)\s*$/u, ', köhnə').replace(/["“”„]/g, '«').replace(/«([^«]*)«/g, '«$1»');
const top = [...score.keys()].sort((a, b) => score[b] - score[a] || a - b).slice(0, 3000);
const labels = Object.fromEntries(top.map((i) => [i, shortTitle(T.title[i]).slice(0, 40)]));
fs.writeFileSync(path.join(OUT, 'labels.json'), JSON.stringify(labels));
console.log(`layout: pos.bin ${(xy.byteLength / 1024).toFixed(0)} KB (${N} nodes, ${core.reduce((a, v) => a + v, 0)} in the core), labels.json ${(JSON.stringify(labels).length / 1024).toFixed(0)} KB`);
