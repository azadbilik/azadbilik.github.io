// Catalogue of /musiqi/ (the listening page): every musician of the music pages who has something to play, sorted by period,
// genre and school, plus the stage and symphonic works with recordings in the Apple Music catalogue.
//   node scripts/listen-build.mjs   (cache only, no requests) -> data/catalog.json
// Reads: data/apple.json (who is matched, and how), data/.cache/apple-match.json (their albums and tracks), data/.cache/apple-works.json
// (scripts/apple-works.mjs), data/.cache/itunes/ (album artwork), data/recordings.json + the sub-pages' recordings.json (public-domain,
// full length), musicians.json, composers.json, jazz.json, estrada.raw.json, lineage.json (names, dates, roles, teachers).
// Only URLs are stored: Apple previews stream from Apple and link back to the track; nothing of the audio is copied.
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { toks, tokEq, nameFits } from './apple-lib.mjs';
const R = (f) => new URL(f, import.meta.url);
const J = async (f, d) => { try { return JSON.parse(await readFile(R(f), 'utf8')); } catch (e) { if (d !== undefined) return d; throw e; } };

const APPLE = (await J('../data/apple.json')).people, MATCH = await J('../data/.cache/apple-match.json');
const SPOT = await J('../data/spotify.json'), YT = await J('../data/youtube.json');
const WORKS = await J('../data/.cache/apple-works.json', {});
const YTS = await J('../data/.cache/youtube-search.json', {});
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
// A Russian label «Фамилия, Имя Отчество» reads «Имя Фамилия»
const ruName = (s) => { const m = /^([^,]+),\s*(\S+)/.exec(s ?? ''); return m ? `${m[2]} ${m[1]}` : s; };
const P = new Map();
const put = (p, role) => {
  if (!/^Q\d+$/.test(p.qid ?? '')) return;
  const o = P.get(p.qid) ?? { q: p.qid, roles: new Set() };
  for (const k of ['az', 'ru', 'en']) if (p[k] && !o[k]) o[k] = (k === 'ru' ? ruName(String(p[k])) : String(p[k])).trim();
  o.born ??= p.born; o.died ??= p.died; if (p.image && !o.img) o.img = p.image;
  if (role) o.roles.add(role); for (const r of p.roles ?? []) o.roles.add(r);
  P.set(p.qid, o);
};
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


// ---- YouTube (scripts/youtube-search.mjs): only channels that own or hold what they publish. Everyone else's re-uploads are left out,
// however many there are. Each entry was checked on the channel's own page (name, description, verification).
const CHANNELS = {
  'UCVf7OL0jKiO1OMHN_qaNf0w': 'AzTV', 'UCMe0z0ZssfH8XWae5OmmvOQ': 'Mədəniyyət TV (AzTV)', 'UC-L_D0EfftoZd4lrnxCvjVw': null, // AzTV Media: not verified, left out
  'UCCYhaH52lUEmfUjX-_OBAHg': 'İctimai TV', 'UC32wbto996-uERamldVJFfA': 'İctimai Radio', 'UC0eXaduoVL4Go-zgSDmGkWw': 'ATV Music', 'UCQc52wTKn4SIaDCNv_cl1Ag': 'MUSZON (RAST Production, ATV)',
  'UC2cSaCEcwSOUnlmPDvMSPmA': 'Opera və Balet Teatrı', 'UC82pjhw4iqEsYDq1uimAIjg': 'Opera və Balet Teatrı', 'UC0RriMLFgy7r5LhE0EG_9rA': 'Dövlət Filarmoniyası',
  'UCAfV4u1ITzYiqNQDOOceacw': 'Musiqili Teatr', 'UC2d297P1TvzsFcaTg8T0TLQ': 'Musiqi Mədəniyyəti Muzeyi', 'UC9JgonaCybjR8TDeD4oGOJQ': 'Gəncə Filarmoniyası',
  'UCqtTk35tEY4EyJGq7bOUGEQ': 'Azərbaycanfilm', 'UCYBRECI7vtfsY-7CKuwYWoQ': 'Heydər Əliyev Fondu', 'UCm28E3X-Fssx6PNkKi5IVig': 'Naxçıvan Mədəniyyət Nazirliyi',
  'UCiVZttFkdEwMi3QXpRqFTzQ': 'Gosteleradiofond', 'UC7QX724vt3YwVnkMwtmdqNA': 'Gosteleradiofond (Музыка на советском ТВ)', 'UC7FDlGcSUqeSZHh1LRMM1OQ': 'Gosteleradiofond (фильмы, спектакли)',
  'UCxy25YRKhbBkMGsB3L0HS1w': 'Fikrət Əmirov (rəsmi)',
};
// …plus YouTube's own «X - Topic» channels (generated from licensed releases). An official artist channel (the note badge) counts only
// for that artist's own videos: many such channels also carry other people's operas and covers.
const official = (v, o) => (CHANNELS[v.cid] ?? null) || (/ - Topic$/.test(v.ch) ? v.ch : null)
  || (v.badges.includes('BADGE_STYLE_TYPE_VERIFIED_ARTIST') && o && [o.az, o.ru && ruName(o.ru), o.en].filter(Boolean).some((n) => nameFits(v.ch.replace(/\s+(official|rəsmi)$/i, ''), n)) ? v.ch : null);
// Namesakes: Bülbül is not his son Polad Bülbüloğlu; Müslüm Maqomayev the composer (1885–1937) is not his grandson the singer, so only his operas
const NOT = { Q1131312: /pola[dt]|полад|o[gğ]l[uı]|огл/i }, ONLY = { Q2499809: /şah ismay|shah ismay|шах[- ]исмаил|nərgiz|nargiz|наргиз/i };
const secs = (l) => l.split(':').reduce((s, x) => s * 60 + +x, 0);
const nameToks = (o) => [o.az, o.ru && ruName(o.ru), o.en].filter(Boolean).map((n) => toks(n.replace(/\(.*?\)/g, ' ')));
// the title names the musician: their surname, and their first name too unless they go by one name
const names = (o, title) => { const T = toks(title); return nameToks(o).some((N) => N.length && (N.length <= 3 ? [N[0], N.at(-1)] : N).every((n) => T.some((t) => tokEq(t, n)))); };
const ytFor = (kind, key, fits, max = 8, owner = null) => {
  const seen = new Set(), out = [];
  for (const r of Object.values(YTS)) if (r.kind === kind && r.key === key) for (const v of r.v) {
    if (seen.has(v.id) || !v.len || secs(v.len) < 60) continue; const ch = official(v, owner); if (!ch || !fits(v)) continue;
    seen.add(v.id); out.push([v.id, v.t, ch, secs(v.len)]);
  }
  return out.slice(0, max);
};

// ---- artists
const A = [];
const pdBy = new Map(); for (const r of PD) { const q = r.performer?.qid; if (/^Q\d+$/.test(q ?? '')) (pdBy.get(q) ?? pdBy.set(q, []).get(q)).push(r); }
for (const o of P.values()) {
  if (ABROAD.has(o.q)) continue;
  const ap = APPLE[o.q], pd = pdBy.get(o.q) ?? [], yv = ytFor('a', o.q, (v) => names(o, v.t) && !NOT[o.q]?.test(v.t) && (!ONLY[o.q] || ONLY[o.q].test(v.t)), 8, o);
  if (!ap && !pd.length && !yv.length) continue;
  const g = genresOf(o); if (!g.length) continue;
  const tracks = [...pd.map((r) => pdTrack(r, o.az)), ...(ap ? appleTracks(o.q, 10) : [])];
  // albums only of a match apple.mjs kept: the raw cache also holds the namesakes it dropped (Bülbül's «Bulbul» of the 2020s)
  const albums = (ap ? MATCH[o.q]?.albums ?? [] : []).filter((a) => a.url && a.date).sort((x, y) => x.date.localeCompare(y.date));
  const seenA = new Set(), al = [];
  for (const a of albums) { const k = norm(a.name); if (!k || seenA.has(k)) continue; seenA.add(k); al.push(alb(a.id, a.name, a.date, a.url)); }
  if (!tracks.length && !al.length && !yv.length) continue;
  const img = o.img ? o.img.replace(/\?width=\d+$/, '') : '';
  A.push({
    q: o.q, az: o.az, ru: o.ru, en: o.en, b: o.born, d: o.died, g: g.sort((x, y) => GORDER.indexOf(x) - GORDER.indexOf(y)), p: periodsOf(o, pd.length > 0),
    img, art: tracks.find((t) => t[2] >= 0 && ALB.get([...ALB.keys()][t[2]])?.[4])?.[2] ?? al[0] ?? -1,
    ...(ap ? { am: ap.url } : {}), ...(SPOT[o.q]?.a ? { sp: SPOT[o.q].a } : {}), ...(YT[o.q]?.url ? { yt: YT[o.q].url } : {}),
    ...(ap?.note ? { note: ap.note } : {}),
    t: tracks, al: al.slice(-24), ...(yv.length ? { v: yv } : {}),
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
  const tr = WORKS[w.qid] ?? [];
  // a video of the work: its title (any language, or a catalogue alias) in the video's title, on an official channel
  const TT = [w.az, w.en, w.ru].filter(Boolean).map((x) => toks(x.replace(/\(.*?\)/g, ' ')).filter((t) => t.length >= 3 && !['opera', 'balet', 'simfonig'].includes(t)).slice(0, 3)).filter((x) => x.length);
  // …and the composer's surname or the kind of work (opera, ballet…) beside it, so a TV series or a namesake singer called «Tərlan» stays out;
  // Azərbaycanfilm's films of the musical comedies count as they are
  const cs = w.composers.map((q) => P.get(q)).filter(Boolean);
  const KIND = /opera|балет|balet|опер|musiqili komediya|музыкальн|simfon|симфон|süita|suite|сюит|kantata|кантат|poema|поэм|uvert|увертюр/i;
  const wv = ytFor('w', w.qid, (v) => { const T = toks(v.t); return TT.some((need) => need.every((n) => T.some((t) => tokEq(t, n))))
    && (cs.some((c) => nameToks(c).some((N) => N.length && T.some((t) => tokEq(t, N.at(-1))))) || KIND.test(v.t) || (v.cid === 'UCqtTk35tEY4EyJGq7bOUGEQ' && w.type === 'musical')); }, 6, cs[0]);
  if (!tr.length && !wv.length) continue;
  const seen = new Set(), t = [];
  for (const x of tr) {
    if ((x.ms ?? 99999) <= 40000) continue; const k = norm(x.name) + '|' + norm(x.by); if (seen.has(k)) continue; seen.add(k);
    t.push([x.name, x.by ?? '', alb(x.albumId, x.album, x.date, x.albumUrl), x.preview, x.url, Math.round((x.ms ?? 0) / 1000), 0]);
    if (t.length >= 20) break;
  }
  if (!t.length && !wv.length) continue;
  W.push({ q: w.qid, az: w.az, ru: w.ru ?? w.az, en: w.en ?? w.az, y: w.year, ty: w.type, c: w.composers.filter((q) => !ABROAD.has(q)), t, ...(wv.length ? { v: wv } : {}) });
}

const albums = [...ALB.values()].map(([, n, y, u, a]) => [n, y, u, a]);
const out = { built: new Date().toISOString().slice(0, 10), artists: A, works: W, schools: schools.map(({ k, n, m }) => ({ k, n, m })), albums };
// long shared URL prefixes as short tokens; the page expands them (X in index.html)
const PRE = [[/https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\//g, '~a/'], [/https:\/\/is(\d)-ssl\.mzstatic\.com\/image\/thumb\//g, '~i$1/'], [/https:\/\/music\.apple\.com\//g, '~m/'], [/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//g, '~u/'], [/https:\/\/commons\.wikimedia\.org\/wiki\//g, '~c/']];
let json = JSON.stringify(out); for (const [re, t] of PRE) json = json.replace(re, t);
await writeFile(R('../data/catalog.json'), json);
console.log(Math.round(json.length / 1024), 'KB');
const st = (f) => A.filter(f).length;
console.log('artists', A.length, 'tracks', A.reduce((s, a) => s + a.t.length, 0), 'free', A.reduce((s, a) => s + a.t.filter((t) => t[6] === 1).length, 0), 'albums', albums.length,
  '| works', W.length, 'tracks', W.reduce((s, w) => s + w.t.length, 0), '| schools', schools.length, schools.map((s) => s.n.az + ' ' + s.m.length).join(', '));
console.log('youtube: artists', A.filter((a) => a.v).length, 'videos', A.reduce((s, a) => s + (a.v?.length ?? 0), 0), '| only on youtube', A.filter((a) => a.v && !a.t.length).map((a) => a.az).join(', '), '| works', W.filter((w) => w.v).length, 'videos', W.reduce((s, w) => s + (w.v?.length ?? 0), 0), '| works only on youtube', W.filter((w) => !w.t.length).length);
console.log('genres', Object.fromEntries(GORDER.map((g) => [g, st((a) => a.g.includes(g))])), 'periods', Object.fromEntries(PERIODS.map(([k]) => [k, st((a) => a.p.includes(k))])));
