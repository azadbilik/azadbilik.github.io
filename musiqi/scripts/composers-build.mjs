// Builds bestekarlar/data/composers.json (what the page reads) from composers.raw.json (Wikidata,
// scripts/composers.mjs), the hand-read teacher sentences (composers.text.spec.json over
// composers.candidates.json, scripts/people-text.mjs) and the library links (kx-links.json).
//   node scripts/composers-build.mjs        (checks that each kitabxana.az link answers)
import { readFile, writeFile } from 'node:fs/promises';
const dir = new URL('../bestekarlar/data/', import.meta.url);
const J = async (f) => JSON.parse(await readFile(new URL(f, dir), 'utf8'));
const raw = await J('composers.raw.json'), cand = await J('composers.candidates.json'), spec = await J('composers.text.spec.json'), kx = await J('kx-links.json');

// Everyone Wikidata gives as a composer born in or tied to Azerbaijan, except five (Armenian, Dagestani, Russian or Swiss-based composers born in Baku or Dagestan) whose Azerbaijani tie is only the birthplace
const people = new Map([...raw.people, ...raw.extra].map((p) => [p.qid, p]));
const byName = new Map([...people.values()].map((p) => [p.az ?? p.en, p.qid]));
const OUT = new Set(['Avet Terterian', 'Murad Kajlayev', 'Timur Kogan', 'Alexandre Rabinovitch-Barakovsky', 'Alexey Ekimyan', 'Mstislav Rostropoviç', 'Bella Davidoviç']);
const inScope = (q) => { const p = people.get(q); return p && !OUT.has(p.az ?? p.en); };

// Stage and orchestral works
const type = (w) => {
  const t = [...w.classes, ...w.genres].join(' ').toLowerCase(), n = (w.az ?? w.en ?? '').toLowerCase();
  if (/ballet|choreograph/.test(t) || /\(balet|balet\)/.test(n)) return 'ballet';
  if (/operetta/.test(t) || (/comedy/.test(t) && /dramatico/.test(t))) return 'musical';
  if (/symphonic mugham|symphon|cantata|oratory|oratorio|concerto/.test(t) || /simfoni|kantata|poema|uvertüra/.test(n)) return 'orchestral';
  if (/dramatico-musical/.test(t) || /opera/.test(t)) return 'opera';
  return null;
};
const STAGE = ['opera', 'musical', 'ballet', 'orchestral'];
const clean = (s) => (s ?? '').replace(/\s*\((opera|balet|mahnı|film)[^)]*\)\s*$/i, '').replace(/\s*\(balet, [^)]*\)$/, '').trim();
const works = [];
for (const w of raw.works) {
  if (w.classes.every((c) => /film|series|single|song|album|hymn/.test(c))) continue;
  const ty = type(w);
  if (!ty || !(w.az || w.en || w.ru)) continue;
  const comps = w.composers.filter(inScope);
  if (!comps.length || (w.year == null && !w.premiere)) continue;
  // Titles that are only a film's or someone else's: drop the one drama film scored
  if (w.genres.includes('drama film')) continue;
  // The same ballet under two Wikidata items (Galin gayasi / Gəlin qayası) is kept once
  const kxl = [...(kx.byWork[w.qid] ?? []), ...(w.base ?? []).flatMap((b) => kx.byBase[b.qid] ?? [])];
  works.push({
    qid: w.qid, type: ty,
    az: clean(w.az), ru: w.ru, en: w.en,
    composers: comps, year: w.premiere ?? w.year, date: w.premiereDate && !w.premiereDate.endsWith('-01-01') ? w.premiereDate : undefined,
    dated: w.premiere ? 'premiere' : 'other', // premiere (P1191) or the first date on the item (publication, inception)
    ref: !!w.premiereRef, base: (w.base ?? []).map((b) => ({ qid: b.qid, az: b.az, ru: b.ru, en: b.en, author: b.authorName?.az ?? b.authorName?.en })), librettists: w.librettists,
    kx: kxl.length ? kxl : undefined, wiki: w.wiki,
  });
}
// Duplicates: same composers, same year, same Latin-folded title
const fold = (s) => (s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ı/g, 'i').replace(/[^a-z]/g, '');
const seen = new Map(), uniq = [];
for (const w of works.sort((a, b) => a.year - b.year || (a.date ? 0 : 1) - (b.date ? 0 : 1))) {
  const k = fold(w.az ?? w.en) + w.composers.join();
  if (seen.has(k)) continue;
  // Same title, same composer, different year (Galin gayasi 1974 vs Gəlin qayası 1972): the later romanisation item is dropped
  seen.set(k, 1); uniq.push(w);
}
// «Gəlin qayası» is on Wikidata twice (1972 with a premiere date; 1974, a Latin-script duplicate with no date of its own): the first is kept
const DROP = new Set(['Q54913245']);
const works2 = uniq.filter((w) => !DROP.has(w.qid));

// Teacher links: Wikidata (kept when both ends are composers or teachers we have), then text
const links = [];
const add = (l) => { if (!inScope(l.t) || !inScope(l.s)) return; if (!people.has(l.t) || !people.has(l.s)) return; const k = l.t + '>' + l.s, o = links.find((x) => x.t + '>' + x.s === k); if (o) { o.src = o.src === 'wikidata' ? 'wikidata' : l.src; if (l.src === 'text') { o.sentence ??= l.sentence; o.article ??= l.article; o.lang ??= l.lang; } return; } links.push(l); };
for (const l of raw.links) add({ t: l.t, s: l.s, src: 'wikidata', ref: l.ref });
const missing = [];
for (const [i, tn, sn] of spec.links) {
  const t = byName.get(tn), s = byName.get(sn), c = cand.found[i];
  if (!t || !s || !c) { missing.push([i, tn, sn]); continue; }
  add({ t, s, src: 'text', sentence: c.sentence.length > 260 ? c.sentence.slice(0, 257) + '…' : c.sentence, article: c.article, lang: c.lang });
}
if (missing.length) console.log('unresolved spec links:', JSON.stringify(missing));
// A text link already on Wikidata keeps the Wikidata mark but gains the sentence; the reverse (text says t→s, Wikidata s→t) is flagged
for (const l of links) if (links.some((x) => x.t === l.s && x.s === l.t)) console.log('conflicting direction', l.t, l.s);

// People shown: composers with a stage work, or in a teacher link; plus nobody else
const used = new Set([...works2.flatMap((w) => w.composers), ...links.flatMap((l) => [l.t, l.s])]);
const out = [...used].map((q) => people.get(q)).filter(Boolean).map((p) => ({
  qid: p.qid, az: p.az, ru: p.ru, en: p.en, born: p.born, died: p.died, place: p.place?.az ?? p.place?.en, wiki: p.wiki, kitabxana: p.kitabxana, offmap: p.offlist || undefined,
}));
// Library pages must answer
const paths = new Set(works2.flatMap((w) => (w.kx ?? []).map((k) => k.path)).concat(out.filter((p) => p.kitabxana).map((p) => 'authors/' + p.kitabxana)));
for (const p of paths) { const r = await fetch('https://kitabxana.az/' + p, { method: 'HEAD' }); if (r.status !== 200) console.log('LIBRARY LINK BROKEN', p, r.status); }
const stats = { people: out.filter((p) => !p.offmap).length, links: links.length, wd: links.filter((l) => l.src === 'wikidata').length, tx: links.filter((l) => l.src === 'text').length, works: works2.length, byType: Object.fromEntries(STAGE.map((t) => [t, works2.filter((w) => w.type === t).length])), withLibrary: works2.filter((w) => w.kx).length, unreffed: works2.filter((w) => w.dated === 'premiere' && !w.ref).length };
await writeFile(new URL('composers.json', dir), JSON.stringify({ built: raw.built, stats, people: out, links, works: works2 }));
console.log(stats);
