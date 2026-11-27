// Shared by apple.mjs and apple-works.mjs: transliteration-tolerant name matching and the iTunes Search/Lookup API
// with a disk cache (data/.cache/itunes/, git-ignored) and a 3.3 s gap between requests (Apple allows ~20 a minute).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const R = (f) => new URL(f, import.meta.url);
export const BUILD = process.argv.includes('--build');

// ---- name matching
const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 's', ч: 'j', ш: 's', щ: 's', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'iu', я: 'ia', ә: 'a', ғ: 'g', қ: 'g', ҹ: 'j', ү: 'u', ө: 'o', һ: 'h', ҝ: 'g', ј: 'j', ӏ: '', ң: 'n', ў: 'u' };
export const simple = (s) => String(s).toLowerCase().replace(/ı/g, 'i').replace(/ə/g, 'a').replace(/[а-яёәғқҹүөһҝјңў]/g, (c) => CYR[c] ?? c).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
  .replace(/dzh|zh|ch|sh|dj|c/g, 'j').replace(/gh|q|k/g, 'g').replace(/kh|x/g, 'h').replace(/w|f/g, 'v').replace(/ph/g, 'v').replace(/y/g, 'i').replace(/[sz]/g, 's').replace(/[pb]/g, 'b').replace(/[td]/g, 'd').replace(/([a-z])\1+/g, '$1').replace(/[^a-z0-9]/g, '');
export const toks = (s) => String(s).replace(/\(.*?\)/g, ' ').replace(/[,.;:&]/g, ' ').split(/\s+/).map(simple).filter((t) => t.length > 0 && !/^(ogli|oglu|oglı|ogly|ibn|bin|abdul|the|and)$/.test(t));
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
export const tokEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 5 && lev(a, b) <= 1) || (Math.min(a.length, b.length) >= 9 && lev(a, b) <= 2);
// every token of the Apple name must match a distinct token of the label, and the labels' surname (last token) must be among them; one-word Apple names must equal a one-word label
export const nameFits = (apple, label) => {
  const A = toks(apple), L = toks(label); if (!A.length || !L.length) return false;
  if (A.length === 1) return L.length === 1 && tokEq(A[0], L[0]);
  if (A.length < Math.min(2, L.length)) return false;
  const free = [...L]; let hitLast = false;
  for (const a of A) { const i = free.findIndex((l) => tokEq(a, l)); if (i < 0) return false; if (free[i] === L[L.length - 1] || free[i] === L[0]) hitLast = true; free.splice(i, 1); }
  return hitLast && A.length >= Math.min(L.length, 2);
};

// ---- API with cache and a 3.3 s gap
let last = 0; export const hits = { n: 0 };
const api = async (url) => {
  const f = R('../data/.cache/itunes/' + createHash('sha1').update(url).digest('hex') + '.json');
  try { return JSON.parse(await readFile(f, 'utf8')); } catch {}
  if (BUILD) return { resultCount: 0, results: [] };
  for (let tries = 0; tries < 6; tries++) {
    const wait = last + 3300 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); hits.n++;
    const r = await fetch(url, { headers: { 'User-Agent': 'azadbilik-musiqi/0.3' } });
    if (r.ok) { const j = await r.json(); await mkdir(R('../data/.cache/itunes/'), { recursive: true }); await writeFile(f, JSON.stringify(j)); return j; }
    if (r.status === 403 || r.status === 429 || r.status >= 500) { console.log('  wait', r.status); await new Promise((r) => setTimeout(r, 30000 * (tries + 1))); continue; }
    throw new Error(r.status + ' ' + url);
  }
  throw new Error('gave up ' + url);
};
const B = 'https://itunes.apple.com/';
const qs = (o) => new URLSearchParams(o).toString();
export const search = (term, country, entity = 'musicArtist', limit = 8) => api(B + 'search?' + qs({ term, entity, country, limit }));
export const lookup = (id, country, entity, limit = 200) => api(B + 'lookup?' + qs({ id, country, entity, limit }));
