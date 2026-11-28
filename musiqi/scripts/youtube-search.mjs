// YouTube search for the player's musicians and the stage/symphonic works of the music pages: most Melodiya-era recordings are only there.
//   node scripts/youtube-search.mjs          search (one request every 4 s, answers cached in data/.cache/youtube/, git-ignored) -> data/.cache/youtube-search.json
//   node scripts/youtube-search.mjs --build  from the cache only
// Reads the public results page (ytInitialData) and keeps, per video: id, title, channel name and id, length, the channel's badges.
// Which channels count as official is decided in scripts/listen-build.mjs (CHANNELS), not here: this only collects candidates.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const R = (f) => new URL(f, import.meta.url);
const J = async (f) => JSON.parse(await readFile(R(f), 'utf8'));
const BUILD = process.argv.includes('--build');

let last = 0;
const yt = async (q) => {
  const f = R('../data/.cache/youtube/' + createHash('sha1').update(q).digest('hex') + '.json');
  try { return JSON.parse(await readFile(f, 'utf8')); } catch {}
  if (BUILD) return [];
  const wait = last + 4000 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now();
  const r = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'az,ru;q=0.8,en;q=0.6' } });
  if (!r.ok) throw new Error(r.status + ' ' + q);
  const m = /var ytInitialData = (\{.*?\});<\/script>/s.exec(await r.text()); if (!m) throw new Error('no ytInitialData ' + q);
  const out = [];
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer) {
      const v = o.videoRenderer, own = v.ownerText?.runs?.[0];
      out.push({ id: v.videoId, t: v.title?.runs?.map((x) => x.text).join('') ?? '', ch: own?.text ?? '', cid: own?.navigationEndpoint?.browseEndpoint?.browseId ?? '', len: v.lengthText?.simpleText ?? '',
        badges: (v.ownerBadges ?? []).map((b) => b.metadataBadgeRenderer?.style).filter(Boolean), views: v.viewCountText?.simpleText ?? '', when: v.publishedTimeText?.simpleText ?? '' });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(m[1]));
  await mkdir(R('../data/.cache/youtube/'), { recursive: true }); await writeFile(f, JSON.stringify(out));
  return out;
};

const CAT = await J('../data/catalog.json'), COMP = await J('../bestekarlar/data/composers.json'), EST = await J('../estrada/data/estrada.raw.json');
const qs = new Map(); // query -> { kind, key }
const ruShort = (s) => s ? s.replace(/,.*$/, '').split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).join(' ') : '';
// Musicians at work in the Soviet era (in the catalogue or not: the estrada list's ensembles and the composers with a stage work have none on Apple)
const people = new Map();
for (const a of CAT.artists) people.set(a.q, a); // every musician of the player (first the Soviet era only; post-Soviet added 2026-11-28)
for (const p of EST.people) if (!people.has(p.qid)) people.set(p.qid, { q: p.qid, az: p.az, ru: p.ru, en: p.en });
const staged = new Set(COMP.works.flatMap((w) => w.composers));
for (const p of COMP.people) if (staged.has(p.qid) && p.az && !people.has(p.qid) && (p.died ?? 2026) > 1920) people.set(p.qid, { q: p.qid, az: p.az, ru: p.ru, en: p.en });
for (const p of people.values()) {
  const main = p.az || p.en || ruShort(p.ru); if (main) qs.set(main, { kind: 'a', key: p.q });
  const ru = ruShort(p.ru); if (ru && ru !== p.az) qs.set(ru, { kind: 'a', key: p.q });
}
for (const w of COMP.works) {
  const c = COMP.people.find((p) => p.qid === w.composers[0]);
  qs.set(`${w.az.replace(/\(.*?\)/g, '').trim()} ${c?.az?.split(' ').pop() ?? ''} ${({ opera: 'operası', ballet: 'baleti', musical: '', orchestral: '' })[w.type] ?? ''}`.trim(), { kind: 'w', key: w.qid });
}
console.log(qs.size, 'queries');
const res = {};
let i = 0;
for (const [q, k] of qs) {
  try { res[q] = { ...k, v: await yt(q) }; } catch (e) { console.log('  skip', e.message); }
  if (++i % 20 === 0) console.log(i, '/', qs.size);
}
await writeFile(R('../data/.cache/youtube-search.json'), JSON.stringify(res));
const ch = {}; for (const r of Object.values(res)) for (const v of r.v) { const c = ch[v.cid] ??= { name: v.ch, n: 0, badges: new Set() }; c.n++; v.badges.forEach((b) => c.badges.add(b)); }
console.log(Object.keys(res).length, 'answered;', Object.keys(ch).length, 'channels');
