// Builds caz/data/jazz.json from jazz.raw.json (scripts/jazz.mjs), the hand-read sentences (jazz.text.spec.json over
// jazz.candidates.json, scripts/people-text.mjs) and the free-recordings list (recordings.json, if present).
//   node scripts/jazz-build.mjs
import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../caz/data/', import.meta.url);
const J = async (f, d) => JSON.parse(await readFile(new URL(f, dir), 'utf8').catch(() => JSON.stringify(d)));
const raw = await J('jazz.raw.json'), cand = await J('jazz.candidates.json'), spec = await J('jazz.text.spec.json'), rec = await J('recordings.json', []);
const people = new Map([...raw.people, ...raw.extra].map((p) => [p.qid, p]));
const byName = new Map([...people.values()].map((p) => [p.az ?? p.en, p.qid]));
const links = raw.links.map((l) => ({ ...l, kind: 'teacher' }));
const missing = [];
for (const [idx, tn, sn, kind] of spec.links) {
  const t = byName.get(tn), s = byName.get(sn), cs = idx.map((i) => cand.found[i]);
  if (!t || !s || cs.some((c) => !c)) { missing.push([idx, tn, sn]); continue; }
  const sentence = cs.map((c) => c.sentence.length > 230 ? c.sentence.slice(0, 227) + '…' : c.sentence).join(' ⟷ ');
  links.push({ t, s, src: 'text', kind, sentence, article: cs[0].article, lang: cs[0].lang });
}
if (missing.length) console.log('unresolved', JSON.stringify(missing));
// Wikidata teachers whose pupil is not an Azerbaijani musician on the page (Johansson, Şaroyev stay: they teach one)
const used = new Set(links.flatMap((l) => [l.t, l.s]));
const out = [...people.values()].filter((p) => used.has(p.qid) || !p.offmap).map(({ wiki, ...p }) => ({ ...p, wiki }));
const albums = raw.albums.map((a) => ({ qid: a.qid, az: a.az, ru: a.ru, en: a.en, year: a.year, performers: a.performers }));
const events = [{ qid: 'Q3070244', year: 2005, az: 'Bakı Beynəlxalq Caz Festivalı', ru: 'Бакинский международный джазовый фестиваль', en: 'Baku International Jazz Festival', note: 'inception (P571) on Wikidata' }];
const stats = { people: out.filter((p) => !p.offmap).length, links: links.length, wd: links.filter((l) => l.src === 'wikidata').length, tx: links.filter((l) => l.src === 'text').length, albums: albums.length, recordings: rec.filter((r) => r.verdict === 'playable').length };
await writeFile(new URL('jazz.json', dir), JSON.stringify({ built: raw.built, stats, people: out, links, albums, events, recordings: rec }));
console.log(stats);
