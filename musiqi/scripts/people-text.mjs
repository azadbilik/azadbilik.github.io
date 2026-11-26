// Candidate sentences for a network of people: every sentence of the az / ru / en Wikipedia article
// of one person that holds a cue word (teaching, or playing together) and the name of another person
// of the same list. Same method as lineage.mjs, for any list. The sentences are then read by hand.
//
//   node scripts/people-text.mjs <people.json> <out.json> [teach|collab|both]
//   people.json: [{ qid, az, ru, en, wiki: { az, ru, en } }, ...] (wiki = article titles)
//   CACHE=<dir> keeps the fetched article texts between runs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [inFile, outFile, mode = 'both'] = process.argv.slice(2);
if (!inFile || !outFile) { console.error('usage: people-text.mjs <people.json> <out.json> [teach|collab|both]'); process.exit(1); }
const UA = { 'User-Agent': 'azadbilik-musiqi/0.2 (https://github.com/azadbilik)', Accept: 'application/json' };
const cache = process.env.CACHE ?? join(tmpdir(), 'azadbilik-people-text');
await mkdir(cache, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const people = JSON.parse(await readFile(inFile, 'utf8')).filter((p) => p.qid);
const WIKI = ['az', 'ru', 'en'];

async function article(lang, title) {
  const f = join(cache, `${lang}-${title.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 80)}.txt`);
  if (existsSync(f)) return readFile(f, 'utf8');
  const u = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title.replace(/_/g, ' '))}`;
  let text = '';
  for (let k = 0; k < 3; k++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok) { const j = await r.json(); text = Object.values(j.query?.pages ?? {})[0]?.extract ?? ''; break; }
    await sleep(1500 * (k + 1));
  }
  await writeFile(f, text);
  await sleep(120);
  return text;
}
const TEACH = {
  az: /şagird|ustad|müəllim|dərs (al|keç)|yanında|tələbə|öyrən|tərbiy|yetiş|təhsil/i,
  ru: /учени|учил|учён|учёб|учител|наставник|урок|обуча|воспитан|класс[аеу]? /i,
  en: /student|pupil|studied|taught|teacher|apprentic|mentor|lessons|disciple/i,
};
const COLLAB = {
  az: /birlikdə|birgə|ilə çıxış|ilə (bir )?(ansambl|kvartet|trio|kvintet)|ansambl|kvartet|trio|kvintet|orkestr|qrup|tərəfdaş|duet|müşayiət|yazdı|səsləndir/i,
  ru: /вместе с|совместно|ансамбл|квартет|трио|квинтет|оркестр|групп|дуэт|аккомпан|выступал|записал|сотрудни/i,
  en: /together with|with whom|collaborat|ensemble|quartet|trio|quintet|orchestra|band|duet|accompan|performed with|played with|recorded with|toured/i,
};
const CUES = Object.fromEntries(WIKI.map((l) => [l, mode === 'teach' ? TEACH[l] : mode === 'collab' ? COLLAB[l] : new RegExp(TEACH[l].source + '|' + COLLAB[l].source, 'i')]));
const norm = (s) => s.normalize('NFC').toLocaleLowerCase('az').replace(/[’'`ʻ‘]/g, '').replace(/\s+/g, ' ');
const HONOR = /^(aşıq|ashiq|ashug|aşiq|xanəndə|hacı|haji|molla|mirzə|usta|şair|prof\.?|professor)\s+/i;
const names = new Map();
for (const lang of WIKI) {
  const list = [], lastCount = new Map();
  for (const p of people) {
    for (const n of new Set([p[lang], ...(p.aliases ?? [])].filter(Boolean))) {
      for (const f of new Set([norm(n), norm(n.replace(HONOR, ''))])) if (f.length >= 5) list.push({ qid: p.qid, form: f, weak: false });
      const last = norm(n.replace(HONOR, '')).split(' ').pop();
      if (last.length >= 7 && norm(n).includes(' ')) lastCount.set(last, (lastCount.get(last) ?? new Set()).add(p.qid));
    }
  }
  for (const [last, qs] of lastCount) if (qs.size === 1) list.push({ qid: [...qs][0], form: last, weak: true });
  names.set(lang, list.sort((a, b) => b.form.length - a.form.length));
}
const sentences = (t) => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25 && s.length < 700);
const found = [];
let done = 0;
for (const p of people) {
  for (const lang of WIKI) {
    const title = p.wiki?.[lang];
    if (!title) continue;
    for (const s of sentences(await article(lang, title))) {
      if (!CUES[lang].test(s)) continue;
      const low = norm(s), hits = new Map();
      for (const n of names.get(lang)) {
        if (n.qid === p.qid) continue;
        const at = low.indexOf(n.form);
        if (at < 0 || (at > 0 && /\p{L}/u.test(low[at - 1]))) continue;
        if (!hits.has(n.qid) || (hits.get(n.qid).weak && !n.weak)) hits.set(n.qid, { weak: n.weak, at });
      }
      for (const [qid, h] of hits) found.push({ subject: p.qid, other: qid, lang, article: `https://${lang}.wikipedia.org/wiki/${title}`, sentence: s, weak: h.weak });
    }
  }
  if (++done % 20 === 0) console.log(`${done}/${people.length} people read`);
}
await writeFile(outFile, JSON.stringify({ built: new Date().toISOString().slice(0, 10), mode, found }, null, 0));
console.log(`${found.length} candidate sentences from ${people.length} people`);
