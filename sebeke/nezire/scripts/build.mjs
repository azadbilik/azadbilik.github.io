// Builds data/nezire.json for «Nəzirə şəbəkəsi»: who answered whose poem, found three ways in the
// texts of the kitabxana.az library: by name in a title, by verbatim lines, by shared radif + qafiyə.
//
// Reads the kitabxana.az library database (local PostgreSQL, read only). The connection string is
// read at run time from DATABASE_URL, or else from <repo>/apps/api/.env; it is never written anywhere.
//
//   KITABXANA_REPO=~/irs-az node scripts/build.mjs [--eval=<file>]     (needs psql on the PATH)
//
// --eval=<file> also writes samples of each method, for checking by hand.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.env.KITABXANA_REPO ?? join(homedir(), 'irs-az');
let url = process.env.DATABASE_URL;
if (!url) {
  const env = await readFile(join(repo, 'apps/api/.env'), 'utf8');
  url = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
}
if (!url) throw new Error('No DATABASE_URL');
url = url.replace(/[?&]schema=[^&]*/, '');
const sql = (q) => execFileSync('psql', [url, '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8', maxBuffer: 1 << 30 })
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

// ---------------------------------------------------------------- texts
// Readers' rule (VISIBLE_WORK in works.service.ts): published works of published authors.
// Verse in Azerbaijani (Latin script) with a text of its own.
const rows = sql(`SELECT row_to_json(x) FROM (
  SELECT w.slug, w."titleAz" AS t, w.body, w.year, a.slug AS aslug, a."nameAz" AS an, a."nameRu" AS ru, a."nameEn" AS en,
         a."bornYear" AS born, a."diedYear" AS died, a.type AS atype, a.period
  FROM "Work" w JOIN "Author" a ON a.id = w."authorId"
  WHERE w.status = 'PUBLISHED' AND a.status = 'PUBLISHED' AND w.genre = 'POEM' AND w."originalLang" = 'AZ_LATIN' AND w.body <> ''
  ORDER BY w.slug) x`);

// ---------------------------------------------------------------- normalising
// A letter-for-letter fold (every step keeps one character for one), so a position in the folded line is the same in the original's letters
const fold = (s) => s.normalize('NFC').toLocaleLowerCase('az')
  .replace(/[âä]/g, 'a').replace(/[îï]/g, 'i').replace(/û/g, 'u')
  .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
  .replace(/[ʼ'`ʻ‘′’“”«»"]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
const isText = (l) => l && !/^[#\[>*|]/.test(l) && !/^[-–—]{3,}$/.test(l);
const cleanLine = (l) => l.replace(/\[\^[^\]]+\]/g, '').replace(/[*_]+/g, '').trim();

// ---------------------------------------------------------------- poets
const poets = new Map();
for (const r of rows) {
  if (!poets.has(r.aslug)) poets.set(r.aslug, { slug: r.aslug, az: r.an, ru: r.ru, en: r.en, born: r.born, died: r.died, folk: r.atype === 'FOLK' || /xalq|adsız/i.test(r.an), years: [] });
  if (r.year) poets.get(r.aslug).years.push(r.year);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
// When a poet lived, for who answers whom: birth year, else death − 55, else the median year of their dated poems
for (const p of poets.values()) p.date = p.born ?? (p.died ? p.died - 55 : (p.years.length ? median(p.years) - 25 : null));

// ---------------------------------------------------------------- poems
const poems = rows.map((r, i) => {
  const lines = r.body.split('\n').map(cleanLine).filter(isText);
  const stanzas = r.body.split(/\n\s*\n/).map((s) => s.split('\n').map(cleanLine).filter(isText)).filter((s) => s.length);
  return { i, slug: r.slug, t: r.t, aslug: r.aslug, an: r.an, year: r.year, lines, stanzas, body: r.body };
});

// ---------------------------------------------------------------- method 1: a poet named in a title or subtitle
const STOP = new Set(['Şairləri', 'Şairi', 'Leyli', 'Zaman', 'Aşiq', 'Xanım', 'Şair', 'Abdulla', 'Şirvani', 'Xan', 'Bəy', 'Ağa', 'Məhəmməd', 'Mirzə', 'Molla', 'Aşıq', 'Seyid', 'Hacı', 'Mir', 'Əli', 'Əliağa', 'Qazi', 'Xəstə', 'Usta', 'Sarı', 'Şah', 'Xalq', 'Adsız', 'Dədə', 'Təbrizi', 'Ordubadi', 'Kazım', 'Abbas']);
const aliasMap = new Map();
for (const p of poets.values()) {
  const toks = p.az.split(/\s+/);
  const c = new Set([toks.at(-1)]);
  for (const t of toks) if (t.length >= 5) c.add(t);
  for (const a of c) if (!STOP.has(a) && a.length >= 4 && /^\p{Lu}/u.test(a)) (aliasMap.get(a) ?? aliasMap.set(a, new Set()).get(a)).add(p.slug);
}
// Pen names the library keeps in a different place from the name
const PEN = { 'Abbas Ağa Qüdsi': 'bakixanov', 'Seyid Əzim': 'seyid-ezim' };
const nPoems = new Map(); for (const p of poems) nPoems.set(p.aslug, (nPoems.get(p.aslug) ?? 0) + 1);
// An alias shared by several poets («Sabir», «Yaqub») goes to the one with far the most poems in the library, or to nobody
for (const [a, set] of aliasMap) {
  if (set.size < 2) continue;
  const r = [...set].sort((x, y) => nPoems.get(y) - nPoems.get(x));
  if (nPoems.get(r[0]) >= 3 * nPoems.get(r[1])) aliasMap.set(a, new Set([r[0]])); else aliasMap.delete(a);
}
// Titles read wrongly by the rule (checked by hand): «Məhəmməd bəy Arif» is not Hüseyn Arif, «vasitəsilə» names a go-between (Nəvvab), «Nəzminin» is nəzm (a poem), not the poet Nəzmi
const NOT_THE_POET = /Məhəmməd bəy Arif|Nəvvab Möhsün|Nəzminin/;
const KEY = /(?<![a-zəıöüçşğ])(nəzirə|təxmis|təsdis|tərbi|beştətmə|bənzətmə|tətəbbö|cavab)(?![a-zəıöüçşğ]*[a-zəıöüçşğ]{3})/i;   // «müxəmməs» alone names a form, not a model
const aliasRe = new RegExp('(?<![A-Za-zƏəİıÖöÜüÇçŞşĞğ])(' + [...aliasMap.keys(), ...Object.keys(PEN)].sort((a, b) => b.length - a.length).join('|') + ')[a-zəıöüçşğ]{0,5}(?![A-Za-zƏəİıÖöÜüÇçŞşĞğ])', 'gu');
const explicit = [];
for (const p of poems) {
  // the title, and any italic or bracketed note under it: «*Füzuliyi-nalanın əş'arını təsdis*»
  const heads = [p.t, ...p.body.split('\n').slice(0, 4).filter((l) => l.length < 90 && /^\s*(\*[^*]+\*|\([^)]+\))\s*$/.test(l)).map((l) => l.trim())];
  for (const h of heads) {
    if (!KEY.test(h) || NOT_THE_POET.test(h)) continue;
    const hit = new Set();
    for (const m of h.matchAll(aliasRe)) for (const s of (PEN[m[1]] ? [PEN[m[1]]] : (aliasMap.get(m[1]) ?? []))) if (s && s !== p.aslug) hit.add(s);
    if (hit.size === 1) explicit.push({ a: p.i, target: [...hit][0], head: h });
  }
}

// ---------------------------------------------------------------- method 2 and 3 helpers
const vowels = (l) => (fold(l).match(/[aeiou]/g) ?? []).length;

// Quoted lines. A line counts when it is at least three words and 14 letters; each poem keeps its set of folded lines
const lineKey = (l) => fold(l);
const lineSets = poems.map((p) => {
  const m = new Map();
  for (const l of p.lines) { const k = lineKey(l); if (k.split(' ').length >= 3 && k.length >= 14 && !m.has(k)) m.set(k, l); }
  return m;
});
const lineIdx = new Map();
lineSets.forEach((m, i) => { for (const k of m.keys()) (lineIdx.get(k) ?? lineIdx.set(k, []).get(k)).push(i); });
const shared = new Map();
for (const [, ws] of lineIdx) {
  if (ws.length < 2 || ws.length > 6) continue;
  for (let a = 0; a < ws.length; a++) for (let b = a + 1; b < ws.length; b++) {
    if (poems[ws[a]].aslug === poems[ws[b]].aslug) continue;
    const k = ws[a] * 100000 + ws[b];
    shared.set(k, (shared.get(k) ?? 0) + 1);
  }
}
const quoteLinks = [];
let dupes = 0, debates = 0;
for (const [k, s] of shared) {
  if (s < 3) continue;
  const a = Math.floor(k / 100000), b = k % 100000;
  const na = lineSets[a].size, nb = lineSets[b].size;
  const ca = s / na, cb = s / nb;
  if (ca > 0.6 && cb > 0.6) { dupes++; continue; }       // the same text under two names
  // Who quotes whom: the later poet's poem quotes the earlier one's. With no dates to tell (folk poets, or two of an age) the longer poem is the quoter
  const d = direction(poems[a], poems[b]);
  const [q, m] = d === 1 ? [a, b] : d === -1 ? [b, a] : na >= nb ? [a, b] : [b, a];
  const nq = q === a ? na : nb, nm = q === a ? nb : na;
  if (d === null && nq < 1.5 * nm) continue;              // undated and the same size: two versions of one song, not an answer
  if (/deyişmə|görüşü/i.test(poems[a].t + ' ' + poems[b].t)) { debates++; continue; }   // a debate of two aşıqs holds both their poems: not an answer
  const named = explicit.some((e) => e.a === q);
  if (!named && nq <= 30 && nm <= 30 && (s < 6 || poems[a].t === poems[b].t || nq < 1.5 * nm)) continue;   // short songs of one size with lines in common: variants of a song
  if ([a, b].some((x) => poems[x].lines.filter((l) => /^[\p{L} .]{3,30}:$/u.test(l)).length >= 2)) { debates++; continue; }   // speakers' names as lines: a debate
  if (!(s / nq >= 0.2 && (s / nm >= 0.3 || s / nq >= 0.3)) || nq > 150) continue;
  const ev = [...lineSets[m].keys()].filter((x) => lineSets[q].has(x)).map((x) => lineSets[q].get(x));
  quoteLinks.push({ q, m, s, nq, nm, ev });
}

// Radif + qafiyə. Per poem: the longest ending (letters only, spaces ignored) shared by at least 70% of the lines
// that rhyme (the first line and every second line of two-line stanzas)
const radifLen = (E) => {                                  // E: arrays of words; the radif is the longest shared word-run at the end
  const n = E.length;
  let best = '';
  for (let k = 1; k <= 4; k++) {
    const c = new Map();
    for (const e of E) if (e.length > k) { const key = e.slice(-k).join(''); c.set(key, (c.get(key) ?? 0) + 1); }
    const top = [...c].sort((x, y) => y[1] - x[1])[0];
    if (top && top[1] >= 0.7 * n) best = top[0]; else break;
  }
  return best.length;
};
function signature(p) {
  const cp = p.stanzas.filter((s) => s.length === 2);
  if (cp.length < 5 || cp.length < p.stanzas.length * 0.8) return null;
  const ends = [cp[0][0], ...cp.map((s) => s[1])];
  const E = ends.map((l) => fold(l)).filter(Boolean);
  const n = E.length;
  if (n < 5) return null;
  const ES = E.map((e) => e.replace(/ /g, ''));
  let S = '';
  for (let len = 14; len >= 2; len--) {
    const c = new Map();
    for (const e of ES) if (e.length >= len) { const t = e.slice(-len); c.set(t, (c.get(t) ?? 0) + 1); }
    const top = [...c].sort((x, y) => y[1] - x[1])[0];
    if (top && top[1] >= 0.7 * n) { S = top[0]; break; }
  }
  if (S.length < 2) return null;
  const r = Math.min(radifLen(E.map((e) => e.split(' '))), S.length);
  const stems = new Set(ES.filter((e) => e.endsWith(S) && e.length > S.length + 1).map((e) => e.slice(Math.max(0, e.length - S.length - 4), e.length - S.length)));
  const syl = median(cp.map((s) => vowels(s[1])));
  return { S, r, stems, syl, n };
}
const sigPoems = [];
for (const p of poems) { const s = signature(p); if (s) { p.sig = s; sigPoems.push(p); } }
const suffixCount = new Map();
for (const p of sigPoems) for (let k = 3; k <= p.sig.S.length; k++) { const t = p.sig.S.slice(-k); suffixCount.set(t, (suffixCount.get(t) ?? 0) + 1); }
const lcs = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++; return i; };

// Who is the later poet: by date, undirected inside 8 years
function direction(pa, pb) {
  const a = poets.get(pa.aslug), b = poets.get(pb.aslug);
  if (a.date == null || b.date == null || a.folk || b.folk) return null;
  if (Math.abs(a.date - b.date) < 8) return 0;
  return a.date > b.date ? 1 : -1;       // 1: pa is later (answers pb)
}
const formalLinks = [];
for (let i = 0; i < sigPoems.length; i++) for (let j = i + 1; j < sigPoems.length; j++) {
  const A = sigPoems[i], B = sigPoems[j];
  if (A.aslug === B.aslug) continue;
  const m = lcs(A.sig.S, B.sig.S);
  if (m < 4) continue;
  if (m < 0.8 * Math.min(A.sig.S.length, B.sig.S.length) && m < 7) continue;
  const r = Math.min(A.sig.r, B.sig.r, m);
  const q = m - r;                                         // letters of the qafiyə that agree
  if (r > 0 ? q < 2 : m < 6) continue;
  if (Math.abs(A.sig.syl - B.sig.syl) > 2) continue;       // not the same line length: not the same metre
  const c = suffixCount.get(A.sig.S.slice(-m)) ?? 0;       // poems that end this way: the rarer, the likelier an answer
  const sh = [...A.sig.stems].filter((x) => B.sig.stems.has(x)).length;
  formalLinks.push({ a: A.i, b: B.i, m, r, q, c, sh });
}

// ---------------------------------------------------------------- put the three together
const pairKey = (a, b) => a * 100000 + b;
const links = new Map();   // key "answer|model" (poem indexes) -> link
const addLink = (ans, mod, k, info) => {
  const key = pairKey(ans, mod);
  const l = links.get(key) ?? links.set(key, { a: ans, b: mod, k: {}, }).get(key);
  l.k[k] = info;
};
const dirOf = (i, j) => direction(poems[i], poems[j]);
let undirectedQuotes = 0, wrongWay = 0;
for (const q of quoteLinks) addLink(q.q, q.m, 'q', { n: q.s, of: q.nm, ev: q.ev.slice(0, 8) });
for (const f of formalLinks) {
  const d = dirOf(f.a, f.b);
  if (d == null) continue;
  const [ans, mod] = d === -1 ? [f.b, f.a] : [f.a, f.b];
  addLink(ans, mod, 'f', { m: f.m, r: f.r, c: f.c, sh: f.sh, und: d === 0 ? 1 : 0 });
}
// Named poets: the title gives the poet; the poem is found among that poet's poems by quoted lines, else the best formal match
const byPoet = new Map();
for (const p of poems) (byPoet.get(p.aslug) ?? byPoet.set(p.aslug, []).get(p.aslug)).push(p.i);
const namedOnly = [];
for (const e of explicit) {
  const mine = [...links.values()].filter((l) => l.a === e.a && poems[l.b].aslug === e.target);
  const best = mine.sort((x, y) => (y.k.q ? 1 : 0) - (x.k.q ? 1 : 0) || (x.k.f?.c ?? 99) - (y.k.f?.c ?? 99))[0];
  if (best) { best.k.e = { head: e.head }; continue; }
  // no dated link: a formal match with the named poet's poem, the titled poem answering (as «X-ə nəzirə» says)
  const raw = formalLinks.filter((f) => (f.a === e.a && poems[f.b].aslug === e.target) || (f.b === e.a && poems[f.a].aslug === e.target)).sort((x, y) => y.m - x.m)[0];
  if (raw && raw.m >= 7) { const mod = raw.a === e.a ? raw.b : raw.a; addLink(e.a, mod, 'f', { m: raw.m, r: raw.r, c: raw.c, sh: raw.sh, und: 1 }); links.get(pairKey(e.a, mod)).k.e = { head: e.head }; continue; }
  namedOnly.push(e);
}
// a named poem with no match found: still a link between the poets
// ---------------------------------------------------------------- score and keep
// tiers: A = named in a title, or lines quoted; B = same radif + qafiyə, rare (<= 4 poems end this way) and long (>= 9 letters), or 7+ letters with rhyme words in common;
// C = a weaker echo of the same kind (6+ letters, <= 12 poems); D = the rest, dropped
const tier = (l) => {
  if (l.k.e || l.k.q) return 'A';
  const f = l.k.f;
  if (f && f.m >= 9 && f.c <= 4) return 'B';
  if (f && f.m >= 7 && f.c <= 6 && f.sh >= 2) return 'B';
  return f && f.m >= 6 && f.c <= 12 ? 'C' : 'D';
};
const all = [...links.values()].map((l) => ({ ...l, tier: tier(l) }));
const kept = all.filter((l) => l.tier !== 'D');

// ---------------------------------------------------------------- output
const usedPoems = new Set(), usedPoets = new Set();
for (const l of kept) { usedPoems.add(l.a); usedPoems.add(l.b); }
for (const e of namedOnly) { usedPoems.add(e.a); }
const poemList = [...usedPoems].sort((x, y) => x - y);
const pIdx = new Map(poemList.map((x, i) => [x, i]));
for (const i of poemList) usedPoets.add(poems[i].aslug);
for (const e of namedOnly) usedPoets.add(e.target);
const poetList = [...usedPoets].sort();
const aIdx = new Map(poetList.map((s, i) => [s, i]));
const out = {
  built: new Date().toISOString().slice(0, 10),
  stats: { poems: poems.length, signed: sigPoems.length, dupes, debates, explicit: explicit.length, quoteLinks: quoteLinks.length, formalCandidates: formalLinks.length },
  poets: poetList.map((s) => { const p = poets.get(s); return { slug: s, az: p.az, ru: p.ru ?? undefined, en: p.en ?? undefined, born: p.born ?? undefined, died: p.died ?? undefined, date: p.date ?? undefined }; }),
  poems: poemList.map((i) => { const p = poems[i]; return { slug: p.slug, t: p.t, p: aIdx.get(p.aslug), m: p.stanzas[0]?.slice(0, 2) ?? [] }; }),
  links: kept.map((l) => ({ a: pIdx.get(l.a), b: pIdx.get(l.b), tier: l.tier, k: l.k })),
  named: namedOnly.map((e) => { const d = direction(poems[e.a], { aslug: e.target }); return { a: pIdx.get(e.a), to: aIdx.get(e.target), head: e.head, ...(d === -1 ? { rev: 1 } : {}), ...(d === 0 ? { und: 1 } : {}) }; }),
};
await writeFile(join(here, '../data/nezire.json'), JSON.stringify(out));
console.log(out.stats, { kept: kept.length, byTier: Object.fromEntries(['A', 'B', 'C'].map((t) => [t, kept.filter((l) => l.tier === t).length])), namedOnly: namedOnly.length, poems: poemList.length, poets: poetList.length });

const evalArg = process.argv.find((x) => x.startsWith('--eval='));
if (evalArg) {
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = (a, k) => a.map((x) => [rnd(), x]).sort((x, y) => x[0] - y[0]).slice(0, k).map((x) => x[1]);
  const show = (l) => ({ A: `${poems[l.a].an} | ${poems[l.a].t} | ${poems[l.a].stanzas[0]?.slice(0, 2).join(' / ')}`, B: `${poems[l.b].an} | ${poems[l.b].t} | ${poems[l.b].stanzas[0]?.slice(0, 2).join(' / ')}`, tier: l.tier, k: l.k });
  await writeFile(evalArg.slice(7), JSON.stringify({
    q: all.filter((l) => l.k.q).map(show), b: pick(all.filter((l) => l.tier === 'B'), 100).map(show), c: pick(all.filter((l) => l.tier === 'C'), 100).map(show), e: all.filter((l) => l.k.e).map(show),
    namedOnly: namedOnly.map((e) => ({ a: poems[e.a].an + ' | ' + poems[e.a].t, target: e.target, head: e.head })),
  }, null, 1));
}
