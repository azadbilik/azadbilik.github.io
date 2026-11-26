// Lays out the two networks of the page at build time (ForceAtlas2, scripts/graph-layout.mjs), so the
// page shows them settled at once: the researchers into data/authors-pos.bin (Int16 x, y per author, in
// authors.json order), the institutions into elm.json (`ipos`, x, y per institution). Run after build.mjs
// (which calls it); deterministic.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forceLayout, quantise } from '../../../scripts/graph-layout.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const sum = (a) => a.reduce((s, v) => s + v, 0);

// researchers: a link's weight is its number of shared works
const A = JSON.parse(readFileSync(join(out, 'authors.json'), 'utf8'));
const lb = readFileSync(join(out, 'authors-links.bin')), mb = readFileSync(join(out, 'authors-linkmeta.bin'));
const L = new Uint32Array(lb.buffer, lb.byteOffset, lb.byteLength / 4), M = L.length / 2;
const edges = []; for (let k = 0; k < M; k++) edges.push([L[2 * k], L[2 * k + 1], Math.log2(1 + mb[2 * k])]);
const xy = quantise(await forceLayout(A.n, edges, { iterations: 1500, settings: { slowDown: 1, strongGravityMode: true, gravity: 0.02, scalingRatio: 2, outboundAttractionDistribution: false, edgeWeightInfluence: 1 } }));
writeFileSync(join(out, 'authors-pos.bin'), Buffer.from(xy.buffer));

// institutions: the whole period's joint works
const D = JSON.parse(readFileSync(join(out, 'elm.json'), 'utf8'));
const ie = D.edges.map(([a, b, y]) => [a, b, Math.log2(1 + sum(y))]);
D.ipos = [...quantise(await forceLayout(D.institutions.length, ie, { iterations: 900, settings: { scalingRatio: 6, gravity: 0.4, outboundAttractionDistribution: false } }))].map((v) => Math.round(v / 32));
writeFileSync(join(out, 'elm.json'), JSON.stringify(D));
console.log(`layout: authors-pos.bin ${(xy.byteLength / 1024).toFixed(0)} KB; elm.json ${(JSON.stringify(D).length / 1e6).toFixed(2)} MB with ipos`);
