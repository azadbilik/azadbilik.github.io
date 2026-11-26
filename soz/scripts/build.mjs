// Builds data/vocab.json for «Söz ehtiyatı»: how many different words each poet uses in the
// first N words of their verse, after The Pudding's «The Largest Vocabulary in Hip Hop».
//
// Reads the kitabxana.az library database (local PostgreSQL) and the glossary's Arabic–Persian
// dictionary from a checkout of the kitabxana repo. Nothing secret is written anywhere: the
// connection string is read at run time from DATABASE_URL, or else from <repo>/apps/api/.env.
//
//   KITABXANA_REPO=~/irs-az node scripts/build.mjs      (needs psql on the PATH)
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const N = 10000;              // words per poet in the sample
const RARE = 8;               // words of their own shown per poet
const repo = process.env.KITABXANA_REPO ?? join(homedir(), 'irs-az');

let url = process.env.DATABASE_URL;
if (!url) {
  const env = await readFile(join(repo, 'apps/api/.env'), 'utf8');
  url = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
}
if (!url) throw new Error('No DATABASE_URL');
url = url.replace(/[?&]schema=[^&]*/, '');   // Prisma's parameter, unknown to psql

const sql = (q) => execFileSync('psql', [url, '-At', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8', maxBuffer: 1 << 30 })
  .split('\n').filter(Boolean).map((l) => JSON.parse(l));

// Readers' rule (VISIBLE_WORK in works.service.ts): published works of published authors.
// Verse only, written in Azerbaijani in the Latin script, with a text of its own (no translations)
const VISIBLE = `w.status = 'PUBLISHED' AND a.status = 'PUBLISHED' AND w."originalLang" = 'AZ_LATIN' AND w.body <> '' AND w.genre = 'POEM'`;
const authors = sql(`SELECT row_to_json(x) FROM (
  SELECT a.id, a.slug, a."nameAz" AS az, a."nameRu" AS ru, a."nameEn" AS en, a."bornYear" AS born, a."diedYear" AS died, a.period, a.type
  FROM "Author" a WHERE EXISTS (SELECT 1 FROM "Work" w WHERE w."authorId" = a.id AND ${VISIBLE})) x`);
// A fixed order: by book (collection), then the work's place in it; loose works last
const works = sql(`SELECT row_to_json(x) FROM (
  SELECT w."authorId" AS a, w.body, split_part(coalesce(w."sourceId", ''), '-', 1) AS src
  FROM "Work" w JOIN "Author" a ON a.id = w."authorId" LEFT JOIN "Collection" c ON c.id = w."collectionId"
  WHERE ${VISIBLE}
  ORDER BY w."authorId", c.order NULLS LAST, c.year NULLS LAST, c.slug NULLS LAST, w.order NULLS LAST, w.year NULLS LAST, w.slug) x`);

// Markdown to plain words: footnote texts, headings' marks, emphasis, links' targets and tags go
const plain = (md) => md
  .replace(/^\[\^[^\]]+\]:.*$/gm, '')
  .replace(/\[\^[^\]]+\]/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/^\s{0,3}(#{1,6}|>|[-*+]\s|\d+\.\s)/gm, ' ')
  .replace(/[*_~`]+/g, ' ');
// Lower case by Azerbaijani rules (İ → i, I → ı); a word is letters, with apostrophes inside it
const LET = 'a-zçəğıöşüâîûäëïéè';
const WORD = new RegExp(`[${LET}]+(?:’[${LET}]+)*`, 'g');
const tokens = (md) => plain(md).normalize('NFC').toLocaleLowerCase('az').replace(/[ʼ'`ʻ‘′]/g, '’').match(WORD) ?? [];

// Scans read by OCR (or a scan's decoded text layer), proofread; the rest were typed (Wikisource and others)
const SCANNED = new Set(['anl', 'turuz', 'halle', 'archive', 'preslib', 'kxn']);

const byAuthor = new Map(authors.map((a) => [a.id, { ...a, sample: [], total: 0, scanned: 0 }]));
for (const w of works) {
  const a = byAuthor.get(w.a);
  const words = tokens(w.body);
  a.total += words.length;
  const room = N - a.sample.length;
  if (room <= 0) continue;
  const take = words.slice(0, room);
  a.sample.push(...take);
  if (SCANNED.has(w.src)) a.scanned += take.length;
}

// The glossary's dictionary («Ərəb və fars sözləri lüğəti», 2005) and a simplified form of its
// lookup (apps/api/src/glossary/lookup.ts): the word as written, or its stem under common suffixes
const efsl = JSON.parse(await readFile(join(repo, 'apps/api/src/glossary/efsl.json'), 'utf8'));
const key = (w) => w.replace(/’/g, '').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
const heads = new Set(efsl.flatMap((e) => e.h.map(key)));
const PLACES = [
  ['lıq', 'lik', 'luq', 'lük', 'lığ', 'liy', 'luğ', 'lüy', 'lı', 'li', 'lu', 'lü', 'sız', 'siz', 'suz', 'süz', 'dakı', 'dəki', 'kı', 'ki', 'ca', 'cə'],
  ['lar', 'lər'],
  ['ımız', 'imiz', 'umuz', 'ümüz', 'ınız', 'iniz', 'unuz', 'ünüz', 'mız', 'miz', 'muz', 'müz', 'nız', 'niz', 'nuz', 'nüz',
    'ım', 'im', 'um', 'üm', 'ın', 'in', 'un', 'ün', 'sı', 'si', 'su', 'sü', 'm', 'n', 'ı', 'i', 'u', 'ü'],
  ['ndan', 'ndən', 'dan', 'dən', 'nda', 'ndə', 'da', 'də', 'nın', 'nin', 'nun', 'nün', 'ın', 'in', 'un', 'ün', 'na', 'nə', 'ya', 'yə',
    'nı', 'ni', 'nu', 'nü', 'yı', 'yi', 'yu', 'yü', 'a', 'ə', 'ı', 'i', 'u', 'ü', 'yla', 'ylə', 'la', 'lə'],
  ['dır', 'dir', 'dur', 'dür', 'dı', 'di', 'du', 'dü', 'ydı', 'ydi', 'ydu', 'ydü', 'yam', 'yəm', 'am', 'əm', 'san', 'sən'],
];
function stems(word) {
  const found = new Set();
  const walk = (w, before) => {
    for (let place = 0; place < before; place++) for (const s of PLACES[place]) {
      if (!w.endsWith(s) || w.length - s.length < 3) continue;
      const stem = w.slice(0, -s.length);
      found.add(stem);
      if (/[aıou]ğ$/.test(stem)) found.add(`${stem.slice(0, -1)}q`);
      if (/[əeiöü]y$/.test(stem)) found.add(`${stem.slice(0, -1)}k`);
      walk(stem, place);
    }
  };
  walk(word, PLACES.length);
  return found;
}
const EVERYDAY = new Set(`bir biri bu o nə mən sən biz siz mənim sənin məni səni mənə sənə da də ki və ya ha indi deyə niyə bütün
  kişi qara sarı su al ala ac dur bala balaca ana ata sanki bacı qarı xala qala bakı dərin kənd qulluq
  var yox az çox ol et de gəl get gör bil ver at ad il ay gün əl əli baş yan`.split(/\s+/));
const NOT_A_STEM = new Set(`bir mən sən mənim sənin dey sal qal qaz gəz dal ara əli əlim kəsi xal qar sar bak bac kən kiş büt nik amm
  kərb san qul dər bəs ol et de gəl get gör bil ver var yox yan yat tut qoy qaç düş çıx gir dön at ad il ay
  an in on üz öz iç dil`.split(/\s+/));
const loanCache = new Map();
function isLoan(word) {
  if (loanCache.has(word)) return loanCache.get(word);
  const k = key(word);
  let hit = false;
  if (k.length >= 2 && !EVERYDAY.has(k)) hit = heads.has(k) || [...stems(k)].some((s) => !NOT_A_STEM.has(s) && heads.has(s));
  loanCache.set(word, hit);
  return hit;
}

// Era by birth year (before 1760 classical, to 1869 the 19th century, to 1945 the 20th, then today's), or by the century the library gives when the year is unknown
const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const roman = (s) => [...s].reduce((n, c, i, a) => n + (ROMAN[c] < (ROMAN[a[i + 1]] ?? 0) ? -ROMAN[c] : ROMAN[c]), 0);
function era(a) {
  if (/xalq/i.test(a.period ?? '') || a.type === 'FOLK') return 'folk';
  const c = a.born ? Math.floor((a.born + 20) / 100) + 1 : roman(a.period?.match(/\b[IVXLC]+\b/)?.[0] ?? '') || null;
  const y = a.born ?? (c ? (c - 1) * 100 : null);
  if (y == null) return 'unknown';
  if (y < 1760) return 'classical';
  if (y < 1870) return 'c19';
  if (y < 1946) return 'c20';
  return 'modern';
}

const all = [...byAuthor.values()];
const ranked = all.filter((a) => a.sample.length >= N);
// Words only one ranked poet uses within the samples: their own, shown by how often they use them
const users = new Map();
for (const a of ranked) for (const w of new Set(a.sample)) users.set(w, (users.get(w) ?? 0) + 1);

const out = all.map((a) => {
  const counts = new Map();
  for (const w of a.sample) counts.set(w, (counts.get(w) ?? 0) + 1);
  const isRanked = a.sample.length >= N;
  const row = {
    slug: a.slug, az: a.az, ru: a.ru || null, en: a.en || null, born: a.born, died: a.died, era: era(a),
    words: a.total, sample: a.sample.length, distinct: counts.size,
  };
  if (!isRanked) return row;
  const loanTokens = a.sample.filter(isLoan).length;
  // Their own words, less the poet's name in the last couplet («Vaqifəm», «Ələsgərəm»)
  const name = a.az.toLocaleLowerCase('az').split(/[\s-]+/).filter((p) => p.length >= 4);
  const own = [...counts].filter(([w]) => users.get(w) === 1 && w.length >= 4 && !name.some((p) => w.startsWith(p)))
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'az'));
  return {
    ...row, ranked: true,
    loan: +(loanTokens / a.sample.length).toFixed(4),
    loanTypes: +([...counts.keys()].filter(isLoan).length / counts.size).toFixed(4),
    once: [...counts.values()].filter((c) => c === 1).length,
    ownCount: own.length,
    own: own.slice(0, RARE).map(([w]) => w),
    scanned: +(a.scanned / a.sample.length).toFixed(2),
  };
}).sort((x, y) => (y.ranked ? 1 : 0) - (x.ranked ? 1 : 0) || (x.ranked ? y.distinct - x.distinct : y.words - x.words));

const data = {
  built: new Date().toISOString().slice(0, 10), n: N,
  ranked: ranked.length, poets: all.length,
  authors: out,
};
await writeFile(new URL('../data/vocab.json', import.meta.url), JSON.stringify(data) + '\n');
console.log(`${all.length} poets with Azerbaijani verse; ${ranked.length} have ${N} words or more`);
for (const a of out.filter((a) => a.ranked)) console.log(String(a.distinct).padStart(6), (a.loan * 100).toFixed(1).padStart(5) + '%', a.era.padEnd(9), String(a.scanned).padEnd(4), a.az, '·', a.own.slice(0, 4).join(' '));
