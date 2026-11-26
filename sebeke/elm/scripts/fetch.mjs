// Fetches every OpenAlex work with an author affiliated to an institution whose country_code is AZ.
// Raw pages are cached gzipped in data/raw/ (git-ignored) so a re-run resumes. No API key, no email sent.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const raw = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');
mkdirSync(raw, { recursive: true });
const SELECT = 'id,publication_year,type,authorships,primary_topic,primary_location,cited_by_count';
const F = 'institutions.country_code:AZ';
// OpenAlex pages without a key only to 10,000 results, so the query is cut into slices under that.
const slices = [];
slices.push('publication_year:1700-1989');
for (let y = 1990; y <= 2024; y++) slices.push(`publication_year:${y}`);
for (const y of [2025, 2026]) for (let m = 1; m <= 12; m++) {
  const mm = String(m).padStart(2, '0'), end = new Date(Date.UTC(y, m, 0)).getUTCDate();
  slices.push(`from_publication_date:${y}-${mm}-01,to_publication_date:${y}-${mm}-${end}`);
}
slices.push('publication_year:2027');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let tries = 0; ; ) {
    try {
      const res = await fetch(url);
      if (res.ok) return [await res.json(), res];
      if (!(res.status === 429 || res.status >= 500)) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 300));
    } catch (e) { if (String(e.message).startsWith('HTTP')) throw e; } // network or truncated-body errors: retry
    if (++tries >= 8) throw new Error('giving up on ' + url);
    await sleep(3000 * tries);
  }
}
let si = 0;
for (const sl of slices) {
  si++;
  const tag = String(si).padStart(3, '0');
  if (existsSync(join(raw, `s${tag}.done`))) continue;
  for (let page = 1; ; page++) {
    const f = join(raw, `s${tag}-p${String(page).padStart(2, '0')}.json.gz`);
    if (existsSync(f)) continue;
    const [j, res] = await get(`https://api.openalex.org/works?filter=${F},${sl}&per-page=200&page=${page}&select=${SELECT}`);
    if (page === 1 && j.meta.count > 10000) throw new Error('slice too big: ' + sl + ' ' + j.meta.count);
    if (!j.results.length) break;
    writeFileSync(f, gzipSync(JSON.stringify(j.results)));
    if (page * 200 >= j.meta.count) break;
    await sleep(120);
  }
  writeFileSync(join(raw, `s${tag}.done`), sl);
  console.log('slice', si, '/', slices.length, sl);
}
console.log('done');
