// Builds silsile/data/lineage.json (what /musiqi/silsile/ reads) and lineage.quickstatements.txt
// from silsile/data/lineage.candidates.json (scripts/lineage.mjs: Wikidata links, people, candidate
// sentences) and silsile/data/lineage.text.json (the sentences read by hand: who taught whom).
//
//   node scripts/lineage-build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const read = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const cand = await read('../silsile/data/lineage.candidates.json');
const text = await read('../silsile/data/lineage.text.json');
const mus = new Set((await read('../data/musicians.json')).map((m) => m.qid));
const P = new Map(cand.people.map((p) => [p.qid, p]));
// Armenian and Ottoman masters the music map does not carry (Naghash Hovnatan's family, Dede Efendi's pupils)
const NOT_HERE = new Set(['Q2038818', 'Q4059718', 'Q4330728', 'Q3056892', 'Q2073149', 'Q136126071']);
const named = (q) => { const p = P.get(q); return p && (p.az || p.en || p.ru); };

const links = [];
for (const l of cand.wikidata) {
  if (NOT_HERE.has(l.teacher) || NOT_HERE.has(l.student) || !named(l.teacher) || !named(l.student)) continue;
  links.push({ t: l.teacher, s: l.student, src: 'wikidata' });
}
const onWd = new Set(links.map((l) => `${l.t}>${l.s}`));
for (const l of text.links) {
  if (onWd.has(`${l.t}>${l.s}`)) { links.find((x) => x.t === l.t && x.s === l.s).sentence = l.sentence; continue; } // also stated on Wikidata: kept as a Wikidata link
  links.push({ t: l.t, s: l.s, src: 'text', lang: l.lang, article: l.article, sentence: l.sentence });
}
const ids = new Set(links.flatMap((l) => [l.t, l.s]));
const people = [...ids].map((q) => {
  const p = P.get(q);
  const o = { qid: q, az: p.az, ru: p.ru, en: p.en, born: p.born ?? null, died: p.died ?? null, roles: p.roles ?? roleFrom(p.occ), place: p.place, kitabxana: p.kitabxana, wiki: p.wiki };
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
});
function roleFrom(occ = []) {
  const r = [];
  if (occ.some((o) => /khanan?da|singer/i.test(o))) r.push('khanende');
  if (occ.some((o) => /tar player/i.test(o))) r.push('tar');
  if (occ.includes('ashik')) r.push('ashik');
  return r;
}
const wd = links.filter((l) => l.src === 'wikidata').length, tx = links.length - wd;
const out = { built: cand.built, stats: { people: people.length, links: links.length, wd, tx, base: mus.size, candidates: cand.candidates.length }, people, links };
await writeFile(new URL('../silsile/data/lineage.json', import.meta.url), JSON.stringify(out) + '\n');

// QuickStatements (V1, tab-separated) for the text links Wikidata lacks: «student P1066 teacher», sourced
// with the Wikipedia article's URL (S4656, Wikimedia import URL). Run by hand, after a look.
const have = new Set(cand.wikidata.flatMap((l) => [`${l.teacher}>${l.student}`]));
const qs = text.links.filter((l) => !have.has(`${l.t}>${l.s}`) && /^Q\d+$/.test(l.t) && /^Q\d+$/.test(l.s))
  .map((l) => `${l.s}\tP1066\t${l.t}\tS4656\t"${l.article}"`);
await writeFile(new URL('../silsile/data/lineage.quickstatements.txt', import.meta.url), qs.join('\n') + '\n');
console.log(out.stats, `${qs.length} QuickStatements lines`);
