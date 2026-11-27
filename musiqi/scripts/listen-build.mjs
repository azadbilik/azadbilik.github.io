// Catalogue of /musiqi/dinle/ (the listening page): every musician of the music pages who has something to play, sorted by period,
// genre and school, plus the stage and symphonic works with recordings in the Apple Music catalogue.
//   node scripts/listen-build.mjs   (cache only, no requests) -> dinle/data/catalog.json
// Reads: data/apple.json (who is matched, and how), data/.cache/apple-match.json (their albums and tracks), data/.cache/apple-works.json
// (scripts/apple-works.mjs), data/.cache/itunes/ (album artwork), data/recordings.json + the sub-pages' recordings.json (public-domain,
// full length), musicians.json, composers.json, jazz.json, estrada.raw.json, lineage.json (names, dates, roles, teachers).
// Only URLs are stored: Apple previews stream from Apple and link back to the track; nothing of the audio is copied.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
const R = (f) => new URL(f, import.meta.url);
const J = async (f, d) => { try { return JSON.parse(await readFile(R(f), 'utf8')); } catch (e) { if (d !== undefined) return d; throw e; } };

const APPLE = (await J('../data/apple.json')).people, MATCH = await J('../data/.cache/apple-match.json');
const SPOT = await J('../data/spotify.json'), YT = await J('../data/youtube.json');
const WORKS = await J('../data/.cache/apple-works.json', {});
const MUS = await J('../data/musicians.json'), COMP = await J('../bestekarlar/data/composers.json'), JAZZ = await J('../caz/data/jazz.json');
const EST = await J('../estrada/data/estrada.raw.json'), LIN = await J('../silsile/data/lineage.json');
const PD = [...await J('../data/recordings.json'), ...await J('../bestekarlar/data/recordings.json'), ...await J('../estrada/data/recordings.json')];

// Album artwork by collection id, from every cached iTunes answer
const ART = {};
for (const f of await readdir(R('../data/.cache/itunes/'))) {
  const j = JSON.parse(await readFile(R('../data/.cache/itunes/' + f), 'utf8'));
  for (const x of j.results ?? []) if (x.collectionId && x.artworkUrl100) ART[x.collectionId] ??= x.artworkUrl100;
}
for (const t of Object.values(WORKS).flat()) if (t.albumId && t.art) ART[t.albumId] ??= t.art;
// https://…/100x100bb.jpg -> a path template the page sizes itself ({s} = 120, 300…)
const art = (id) => ART[id]?.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/{s}x{s}bb.jpg') ?? '';

// ---- people: names, dates, roles
const P = new Map();
const put = (p, role) => {
  if (!/^Q\d+$/.test(p.qid ?? '')) return;
  const o = P.get(p.qid) ?? { q: p.qid, roles: new Set() };
  for (const k of ['az', 'ru', 'en']) if (p[k] && !o[k]) o[k] = String(p[k]).replace(/,\s.*$/, (m) => (k === 'ru' ? '' : m)).trim();
  o.born ??= p.born; o.died ??= p.died; if (p.image && !o.img) o.img = p.image;
  if (role) o.roles.add(role); for (const r of p.roles ?? []) o.roles.add(r);
  P.set(p.qid, o);
};
// A Russian label «Фамилия, Имя Отчество» reads «Имя Фамилия»
const ruName = (s) => { const m = /^([^,]+),\s*(\S+)/.exec(s ?? ''); return m ? `${m[2]} ${m[1]}` : s; };
MUS.forEach((p) => put({ ...p, az: p.az, ru: p.ru, en: p.en }));
LIN.people.forEach((p) => put({ ...p, ru: ruName(p.ru) }));
COMP.people.forEach((p) => put({ ...p, ru: ruName(p.ru) }, 'composer'));
JAZZ.people.forEach((p) => put(p, 'jazz'));
EST.people.forEach((p) => put(p, p.kind === 'composer' ? 'songwriter' : p.kind === 'ensemble' ? 'estrada' : 'estrada'));
for (const r of PD) if (r.performer?.qid) put(r.performer);

// Teachers from abroad on the composers' network (Shostakovich taught Garayev…) are not Azerbaijani music: not in the catalogue
const ABROAD = new Set(COMP.people.filter((p) => !p.place && !/[əıöüşçğ]/i.test(p.az ?? '')).map((p) => p.qid).concat(['Q80135', 'Q348282']));
// Genre by hand where the role misleads: Aygün Kazımova is a pop singer (on Wikidata also a composer)
const GENRE_FIX = { Q2361757: ['pop'] };

// ---- genres (the first is the main one)
const GORDER = ['mugham', 'instr', 'ashiq', 'classic', 'estrada', 'pop', 'jazz'];
const genresOf = (o) => {
  if (GENRE_FIX[o.q]) return GENRE_FIX[o.q];
  const g = new Set();
  if (o.roles.has('jazz')) g.add('jazz');
  if (o.roles.has('singer') || o.roles.has('estrada') || o.roles.has('songwriter')) g.add('estrada');
  if (o.roles.has('composer')) g.add('classic');
  if (o.roles.has('khanende')) g.add('mugham');
  if (o.roles.has('tar')) g.add('instr');
  if (o.roles.has('ashik')) g.add('ashiq');
  return [...g];
};
// ---- periods: the years a musician was at work (from 18 to death, or to now) against three spans of recorded music
const PERIODS = [['early', 0, 1920], ['soviet', 1920, 1991], ['indep', 1991, 2100]];
const periodsOf = (o, pdOnly) => {
  if (!o.born) return [];
  const a = o.born + 18, b = o.died ?? 2026;
  const out = PERIODS.filter(([, s, e]) => a < e && b > s).map(([k]) => k);
  // the gramophone era only counts for someone who recorded then: a free recording of the time, or born by 1890
  return out.filter((k) => k !== 'early' || pdOnly || o.born <= 1890);
};

// ---- tracks
const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const yr = (d) => (d || '').slice(0, 4);
const ALB = new Map(); // album table: id -> [name, year, url, art]
const alb = (id, name, date, url) => { if (!id) return -1; if (!ALB.has(id)) ALB.set(id, [ALB.size, name, yr(date), url ?? '', art(id)]); return ALB.get(id)[0]; };
// track: [title, by, albumIndex, previewUrl | fullUrl, page, seconds, kind] kind 0 = Apple preview, 1 = public domain full length
const appleTracks = (q, max) => {
  const m = MATCH[q]; if (!m) return [];
  const seen = new Set(), out = [];
  const pool = [...(m.songs ?? []), ...(m.extra ?? [])].filter((x) => x.preview && x.url && (x.ms ?? 99999) > 40000);
  const used = new Set();
  for (const pass of [0, 1]) for (const x of pool) {
    if (out.length >= max) break; const k = norm(x.name); if (!k || seen.has(k)) continue;
    if (pass === 0 && used.has(x.albumId)) continue; // one per album first, for variety
    seen.add(k); used.add(x.albumId);
    const al = m.albums?.find((a) => a.id === x.albumId);
    out.push([x.name, x.by ?? '', alb(x.albumId, x.album, al?.date ?? x.date, al?.url), x.preview, x.url, Math.round((x.ms ?? 0) / 1000), 0]);
  }
  return out;
};
const pdTitle = (r) => ({ az: r.title?.az, ru: r.title?.ru, en: r.title?.en });
const pdTrack = (r, by) => [pdTitle(r), by, -1, r.mp3 || r.ogg, r.commons, 0, 1, r.year ?? ''];

// ---- artists
const A = [];
const pdBy = new Map(); for (const r of PD) { const q = r.performer?.qid; if (/^Q\d+$/.test(q ?? '')) (pdBy.get(q) ?? pdBy.set(q, []).get(q)).push(r); }
for (const o of P.values()) {
  if (ABROAD.has(o.q)) continue;
  const ap = APPLE[o.q], pd = pdBy.get(o.q) ?? [];
  if (!ap && !pd.length) continue;
  const g = genresOf(o); if (!g.length) continue;
  const tracks = [...pd.map((r) => pdTrack(r, o.az)), ...(ap ? appleTracks(o.q, 10) : [])];
  const albums = (MATCH[o.q]?.albums ?? []).filter((a) => a.url && a.date).sort((x, y) => x.date.localeCompare(y.date));
  const seenA = new Set(), al = [];
  for (const a of albums) { const k = norm(a.name); if (!k || seenA.has(k)) continue; seenA.add(k); al.push(alb(a.id, a.name, a.date, a.url)); }
  if (!tracks.length && !al.length) continue;
  const img = o.img ? o.img.replace(/\?width=\d+$/, '') : '';
  A.push({
    q: o.q, az: o.az, ru: o.ru, en: o.en, b: o.born, d: o.died, g: g.sort((x, y) => GORDER.indexOf(x) - GORDER.indexOf(y)), p: periodsOf(o, pd.length > 0),
    img, art: tracks.find((t) => t[2] >= 0 && ALB.get([...ALB.keys()][t[2]])?.[4])?.[2] ?? al[0] ?? -1,
    ...(ap ? { am: ap.url } : {}), ...(SPOT[o.q]?.a ? { sp: SPOT[o.q].a } : {}), ...(YT[o.q]?.url ? { yt: YT[o.q].url } : {}),
    ...(ap?.note ? { note: ap.note } : {}),
    t: tracks, al: al.slice(-24),
  });
}
const has = new Set(A.map((a) => a.q));

// ---- schools: a master and the students the teacher links name (Silsilə, Bəstəkarlar, Caz), with at least two who can be played
const links = [...LIN.links, ...COMP.links, ...JAZZ.links.filter((l) => (l.kind ?? 'teacher') === 'teacher')];
const kids = new Map(); for (const l of links) { if (l.t === l.s) continue; (kids.get(l.t) ?? kids.set(l.t, new Set()).get(l.t)).add(l.s); }
const desc = (q, seen = new Set()) => { for (const s of kids.get(q) ?? []) if (!seen.has(s)) { seen.add(s); desc(s, seen); } return seen; };
const name = (q) => { const o = P.get(q) ?? LIN.people.find((p) => p.qid === q); return o ? { az: o.az, ru: o.ru ? ruName(o.ru) : o.az, en: o.en ?? o.az } : null; };
let schools = [];
for (const [t] of kids) {
  if (ABROAD.has(t)) continue;
  const all = [...desc(t)].filter((q) => has.has(q));
  if (all.length < 2 || !name(t)) continue;
  schools.push({ k: t, n: name(t), m: [t, ...all].filter((q) => has.has(q)), master: t, size: all.length });
}
// a school wholly inside a larger one of the same line adds little: keep the larger, and the ten largest overall
schools.sort((a, b) => b.size - a.size);
schools = schools.filter((s, i) => !schools.slice(0, i).some((o) => o.m.includes(s.master) && s.m.every((q) => o.m.includes(q)) && s.size < 4)).slice(0, 12);
for (const a of A) a.s = schools.filter((s) => s.m.includes(a.q)).map((s) => s.k);

// ---- works
const W = [];
for (const w of COMP.works) {
  const tr = WORKS[w.qid] ?? []; if (!tr.length) continue;
  const seen = new Set(), t = [];
  for (const x of tr) {
    if ((x.ms ?? 99999) <= 40000) continue; const k = norm(x.name) + '|' + norm(x.by); if (seen.has(k)) continue; seen.add(k);
    t.push([x.name, x.by ?? '', alb(x.albumId, x.album, x.date, x.albumUrl), x.preview, x.url, Math.round((x.ms ?? 0) / 1000), 0]);
    if (t.length >= 20) break;
  }
  if (!t.length) continue;
  W.push({ q: w.qid, az: w.az, ru: w.ru ?? w.az, en: w.en ?? w.az, y: w.year, ty: w.type, c: w.composers.filter((q) => !ABROAD.has(q)), t });
}

const albums = [...ALB.values()].map(([, n, y, u, a]) => [n, y, u, a]);
const out = { built: new Date().toISOString().slice(0, 10), artists: A, works: W, schools: schools.map(({ k, n, m }) => ({ k, n, m })), albums };
await mkdir(R('../dinle/data/'), { recursive: true });
// long shared URL prefixes as short tokens; the page expands them (X in dinle/index.html)
const PRE = [[/https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\//g, '~a/'], [/https:\/\/is(\d)-ssl\.mzstatic\.com\/image\/thumb\//g, '~i$1/'], [/https:\/\/music\.apple\.com\//g, '~m/'], [/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//g, '~u/'], [/https:\/\/commons\.wikimedia\.org\/wiki\//g, '~c/']];
let json = JSON.stringify(out); for (const [re, t] of PRE) json = json.replace(re, t);
await writeFile(R('../dinle/data/catalog.json'), json);
console.log(Math.round(json.length / 1024), 'KB');
const st = (f) => A.filter(f).length;
console.log('artists', A.length, 'tracks', A.reduce((s, a) => s + a.t.length, 0), 'free', A.reduce((s, a) => s + a.t.filter((t) => t[6] === 1).length, 0), 'albums', albums.length,
  '| works', W.length, 'tracks', W.reduce((s, w) => s + w.t.length, 0), '| schools', schools.length, schools.map((s) => s.n.az + ' ' + s.m.length).join(', '));
console.log('genres', Object.fromEntries(GORDER.map((g) => [g, st((a) => a.g.includes(g))])), 'periods', Object.fromEntries(PERIODS.map(([k]) => [k, st((a) => a.p.includes(k))])));
