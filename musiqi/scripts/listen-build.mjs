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
const MUG = await J('../data/mugham.json');
const AMUG = await J('../data/.cache/apple-mugham.json', { byArtist: {}, search: [] });
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
const GENRE_FIX = { Q2361757: ['pop'], Q4060829: ['jazz', 'mugham'] }; // Sevda Ələkbərzadə sings jazz, folk and mugham (az.wikipedia)

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
// label-made remixes of old recordings are not the musician's («Azad Bir Quşdum (Slowed & Reverb)»)
const REMIX = /slowed|reverb|sped up|nightcore/i;
const appleTracks = (q, max) => {
  const m = MATCH[q]; if (!m) return [];
  const seen = new Set(), out = [];
  const pool = [...(m.songs ?? []), ...(m.extra ?? [])].filter((x) => x.preview && x.url && (x.ms ?? 99999) > 40000 && !REMIX.test(x.name));
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
  // added 2026-11-28: a musician's own channel without YouTube's badge, checked by its content; a concert series filming its own concerts
  'UChmn_-dt0yEykjiZTMTnYjA': 'Arslan Növrəsli (rəsmi)', 'UCbeeHSjo4JTW-zcUSarPztA': 'Transcordancias · Global Music Live',
  'UCtcZLsPgLJNS91fH_pQXymg': 'Ali Arshi (rəsmi)',
  'UCe54DqT48ciGag8kQWSQBbA': null, // ARB TV: tried, left out: its clips with musicians are talk-show chatter and news, not music
};
// …plus YouTube's own «X - Topic» channels (generated from licensed releases). An official artist channel (the note badge) counts only
// for that artist's own videos: many such channels also carry other people's operas and covers.
// channels that are one musician's own: their videos need not carry the name (Arslan Növrəsli's «Mozalan Uçuşu»)
const OWN = { 'UChmn_-dt0yEykjiZTMTnYjA': 'Q117750849', 'UCtcZLsPgLJNS91fH_pQXymg': 'Q135210316' };
// channels that are a namesake's, not this musician's: «Səxavət Məmmədov - Topic» carries the xanəndə (1953–1991), not the tar player (b. 1993, «Sakhavat Mammadov» on Apple)
const NOT_CH = { Q140127954: ['UCYi9_7Pem4-Xq9zdWPvAg3g'], Q12846316: ['UCpuRoVWWbUaZHHsAPuqX71g'] }; // …and the other way round: the tar player's verified channel is not the singer's
// videos left out by hand: a pickup sound test on an own channel; two whose subject could not be confirmed (Azərbaycanfilm's «Bülbül (1968)», İctimai Radio's «Tanış olun - Mirzə Muxtar»)
const SKIP_V = new Set(['PLuC4sZwZog', '8IcRwDE0zRM', 'uRxSZSbQIRc']);
const official = (v, o) => (CHANNELS[v.cid] ?? null) || (/ - Topic$/.test(v.ch) ? v.ch : null)
  || (v.badges.includes('BADGE_STYLE_TYPE_VERIFIED_ARTIST') && o && [o.az, o.ru && ruName(o.ru), o.en].filter(Boolean).some((n) => nameFits(v.ch.replace(/\s+(official|rəsmi)$/i, ''), n)) ? v.ch : null);
// Namesakes: Bülbül is not his son Polad Bülbüloğlu, nor the song «Bülbül» (Mələkxanım Əyyubova on «Nanəli»); Səttar is not the painter Səttar Bəhlulzadə; Müslüm Maqomayev the composer (1885–1937) is not his grandson the singer, so only his operas
const NOT = { Q1131312: /pola[dt]|полад|o[gğ]l[uı]|огл|nanəli/i, Q16374758: /bəhlulzadə|bahlulzade/i }, ONLY = { Q2499809: /şah ismay|shah ismay|шах[- ]исмаил|nərgiz|nargiz|наргиз/i };
const secs = (l) => l.split(':').reduce((s, x) => s * 60 + +x, 0);
const nameToks = (o) => [o.az, o.ru && ruName(o.ru), o.en].filter(Boolean).map((n) => toks(n.replace(/\(.*?\)/g, ' ')));
// the title names the musician: their surname, and their first name too unless they go by one name
const names = (o, title) => { const T = toks(title); return nameToks(o).some((N) => N.length && (N.length <= 3 ? [N[0], N.at(-1)] : N).every((n) => T.some((t) => tokEq(t, n)))); };
const ytFor = (kind, key, fits, max = 8, owner = null) => {
  const seen = new Set(), out = [];
  for (const r of Object.values(YTS)) if (r.kind === kind && r.key === key) for (const v of r.v) {
    if (seen.has(v.id) || SKIP_V.has(v.id) || NOT_CH[owner?.q]?.includes(v.cid) || !v.len || secs(v.len) < 60) continue; const ch = official(v, owner); if (!ch) continue;
    // on the musician's own channel (their Topic channel, their official artist channel, or OWN) the channel says who it is
    const own = owner && (OWN[v.cid] === owner.q || (/ - Topic$/.test(v.ch) || v.badges.includes('BADGE_STYLE_TYPE_VERIFIED_ARTIST')) && [owner.az, owner.ru && ruName(owner.ru), owner.en].filter(Boolean).some((n) => nameFits(v.ch.replace(/\s+(- Topic|official|rəsmi)$/i, ''), n)));
    if (!own && !fits(v)) continue;
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
  const albums = (ap ? MATCH[o.q]?.albums ?? [] : []).filter((a) => a.url && a.date && !REMIX.test(a.name)).sort((x, y) => x.date.localeCompare(y.date));
  const seenA = new Set(), al = [];
  for (const a of albums) { const k = norm(a.name); if (!k || seenA.has(k)) continue; seenA.add(k); al.push(alb(a.id, a.name, a.date, a.url)); }
  if (!tracks.length && !al.length && !yv.length) continue;
  const img = o.img ? o.img.replace(/\?width=\d+$/, '') : '';
  // genres in fixed order, except a hand-set list (GENRE_FIX), which keeps its own (main genre first)
  A.push({
    q: o.q, az: o.az, ru: o.ru, en: o.en, b: o.born, d: o.died, g: GENRE_FIX[o.q] ? g : g.sort((x, y) => GORDER.indexOf(x) - GORDER.indexOf(y)), p: periodsOf(o, pd.length > 0),
    img, art: tracks.find((t) => t[2] >= 0 && ALB.get([...ALB.keys()][t[2]])?.[4])?.[2] ?? al[0] ?? -1,
    ...(ap ? { am: ap.url } : {}), ...(SPOT[o.q]?.a ? { sp: SPOT[o.q].a } : {}), ...(YT[o.q]?.url ? { yt: YT[o.q].url } : {}),
    ...(ap?.note ? { note: ap.note } : {}),
    t: tracks, al: al.slice(-24), ...(yv.length ? { v: yv } : {}),
  });
}
const has = new Set(A.map((a) => a.q));

// ---- schools: a master and the students the teacher links name (Silsilə, Bəstəkarlar, Caz), with at least two who can be played
// …plus the links data/genres.json adds by hand, each with its sentence (Alim Qasımov → Sevda Ələkbərzadə)
const GEN = await J('../data/genres.json');
const links = [...LIN.links, ...COMP.links, ...JAZZ.links.filter((l) => (l.kind ?? 'teacher') === 'teacher'), ...(GEN.links ?? []).map((l) => ({ ...l, src: 'text' }))];
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

// ---- the tree view (#/tree): the genre family tree of data/genres.json, and every teacher → student link (Silsilə, Bəstəkarlar, Caz) with
// names for the masters the player has no page for (teachers abroad flagged: Shostakovich → Garayev is part of the line)
const TXT = await J('../silsile/data/lineage.text.json', { extra: [] });
const inA = new Set(A.map((a) => a.q)), TL = [], TP = {}, seenTL = new Set();
const who = (q) => P.get(q) ?? LIN.people.find((p) => p.qid === q) ?? TXT.extra.find((x) => (x.id ?? x.qid) === q);
for (const l of links) {
  if (!l.t || !l.s || l.t === l.s || seenTL.has(l.t + '>' + l.s)) continue; seenTL.add(l.t + '>' + l.s);
  for (const q of [l.t, l.s]) if (!inA.has(q) && !TP[q]) {
    const o = who(q); if (!o?.az) continue;
    const g = genresOf({ q, roles: o.roles instanceof Set ? o.roles : new Set(o.roles ?? []) });
    TP[q] = [o.az, o.ru ? ruName(o.ru) : '', o.en ?? '', o.born ?? null, o.died ?? null, g, ABROAD.has(q) ? 1 : 0];
  }
  if ((inA.has(l.t) || TP[l.t]) && (inA.has(l.s) || TP[l.s])) TL.push([l.t, l.s, l.src === 'wikidata' ? 0 : 1]);
}

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

// ---- mughams: the seven dəstgahs with their şöbələr (data/mugham.json, as on the map), and every recording and video of the catalogue
// that names one. A title counts for a dəstgah when it names the dəstgah, a şöbə only it has (a şöbə shared by two, Vilayəti, Üşşaq…,
// is left out), or a piece mugham.json assigns to it (Mənsuriyyə → Çahargah); words matched as in the Apple search (Shur = Şur, Chahargah = Çahargah).
// Estrada and pop are left out: a song called «Segah» is not the mugham.
// Words compared letter for letter: only the Latin spellings (sh, ch, kh, gh, ä) and ə ≈ a/e are allowed, since the Apple-search
// folding would read «Xəzər» as «Hasar» and «Leyli» as «Feili»
const nameT = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/sh/g, 'ş').replace(/ch/g, 'ç').replace(/kh/g, 'x').replace(/gh/g, 'ğ').replace(/ä/g, 'ə').replace(/ı/g, 'i')
  .replace(/[‌‍]/g, '').replace(/[^şçğüöə]/g, (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '')).replace(/[^\p{L}\p{N}ə]+/gu, ' ').trim().split(' ').filter(Boolean);
const LOOSE = { ə: 'ae', ü: 'u', ö: 'o' }; // the Latin spellings drop these; ş, ç, ğ stay apart (French «sur» is not Şur)
const tokEqM = (a, b) => a.length === b.length && [...a].every((c, i) => c === b[i] || LOOSE[c]?.includes(b[i]) || LOOSE[b[i]]?.includes(c));
// …and «Rəşt», a song named after the city, is not Rast
const NOT_MUGHAM = /rəşt|resht/i;
// the Persian spellings the catalogue uses for some (Malik Mansurov's sets: «Homayun: Bidad»)
const D_ALIAS = { humayun: ['Homayun'], 'bayati-shiraz': ['Bayat-e Shiraz'], shushtar: ['Shushtar'] };
// sections every mugham has (opening, closing, the base, the high register), though mugham.json lists some under one dəstgah only
const GENERIC_SOBE = new Set(nameT('maye mayə bərdaşt dəraməd ayaq rəng təsnif')); // zil (high register) is matched only zil to zil, below
const secOwners = new Map();
for (const d of MUG.dastgahs) for (const x of d.sections) { const k = nameT(x.az).join(' '); (secOwners.get(k) ?? secOwners.set(k, new Set()).get(k)).add(d.id); }
const keys = MUG.dastgahs.map((d) => {
  const ks = [{ t: nameT(d.name.az), sobe: null }, { t: nameT(d.name.en), sobe: null }, { t: nameT(d.name.ru), sobe: null }, ...(D_ALIAS[d.id] ?? []).map((a) => ({ t: nameT(a), sobe: null }))];
  for (const x of d.sections) { const T = nameT(x.az); if (GENERIC_SOBE.has(T[0])) continue; if (secOwners.get(T.join(' ')).size === 1 && T.join('').length >= 4 && T.join(' ') !== ks[0].t.join(' ')) ks.push({ t: T, sobe: x.az }); }
  // a piece that is one of the şöbələr under another spelling (Simayi-Şəms = Səmayi-Şəms) files under the şöbə's name
  const same = (x, y) => x.length === y.length && x.every((w, i) => tokEqM(w, y[i]) || (w.length >= 5 && tokEq(w, y[i])));
  for (const pc of MUG.pieces) if (pc.dastgah === d.id && pc.confidence === 'sourced' && pc.kind !== 'dastgah') { const T = nameT(pc.name); ks.push({ t: T, sobe: d.sections.find((x) => same(nameT(x.az), T))?.az ?? pc.name }); }
  return { d, ks: ks.filter((k) => k.t.length) };
});
// dəstgahs outside the seven (Orta Mahur, Mahur-Hindi…): a title naming one is not sorted under the seven, though it shares şöbə names
const others = MUG.pieces.filter((pc) => pc.kind === 'dastgah' && !pc.dastgah).map((pc) => nameT(pc.name));
// «X: Y» (a set's dəstgah, then its part): X decides, and it must be one of the seven by name; «Qatar: Ayaq» is not Bayatı-Şiraz's Ayaq
const dName = (T) => keys.filter(({ ks }) => ks.some((k) => k.sobe === null && k.t.every((w) => T.some((x) => tokEqM(x, w))))).map(({ d }) => d.id);
// A consonant skeleton for Persian-style spellings: lowercase, Latin digraphs to one letter, the ezafe connectors (-e, -ye, -o) and all
// vowels and y/w dropped, kh/x/h one sound, k/q/g(h) one, j/c one, doubled letters once: «Shekast-e Fars» and «Şikəsteyi-fars» both read şqstfrs
const skel = (s) => String(s).toLowerCase().replace(/\s+(i|ii|iii|iv|v|vi|vii|viii|ix|x|cont\.?)\b/g, ' ').replace(/[-‌\s](y?e|o)(?=[-‌\s])/g, ' ')
  .replace(/sh/g, 'ş').replace(/ch/g, 'ç').replace(/kh/g, 'h').replace(/gh/g, 'q').replace(/zh/g, 'j').replace(/x/g, 'h').replace(/[kg]/g, 'q').replace(/ğ/g, 'q').replace(/j/g, 'c')
  .replace(/[^a-zəıüöşçğ]/g, '').replace(/[aeiouəıüöyw]/g, '').replace(/(.)\1+/g, '$1');
// the skeleton word by word («|mnd|hsr|»); a şöbə's skeleton must start and end on a word boundary of it, though it may run over one
// (Bastenegar = Bəstə-nigar), so «Manad-e Hesar» is not «Yədi-hasar» (…d|hsr)
const skelWords = (s) => '|' + String(s).replace(/[-‌,.;:()]/g, ' ').split(/\s+/).filter((w) => w && !/^(y?e|o|cont|[ivx]+)$/i.test(w)).map(skel).filter(Boolean).join('|') + '|';
// Malik Mansurov's «Mobarqa» is the şöbə Mugham data spells Mürəbbiqə (letters transposed, so no rule catches it)
const SOBE_ALIAS = { Mobarqa: 'Mürəbbiqə' };
// Persian words that are translated, not transliterated, in the şöbə names
const FA_AZ = { kuchak: 'kiçik', kuchek: 'kiçik', kochak: 'kiçik', bozorg: 'böyük', bozorgh: 'böyük' };
// word by word, then joined, so «Bayatı-Türk» keeps both t's (bt+trq) and meets «|bt|trq|»
const skelJoin = (s) => skelWords(s).replace(/\|/g, '');
const skelAt = (ts, k) => new RegExp('\\|' + [...k].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\|?') + '\\|').test(ts);
// a şöbə's names: «Bayatı-Qacar (Bayatı-Türk)» is both
const secNames = (n) => [n.replace(/\s*\(.*?\)\s*/g, ' ').trim(), ...[...n.matchAll(/\((.*?)\)/g)].map((m) => m[1])].filter(Boolean);
const mughamOf = (title) => {
  const ci = String(title).indexOf(':');
  if (ci > 0) {
    const head = nameT(title.slice(0, ci)), ds = dName(head);
    if (ds.length !== 1) return null;
    // the dəstgah is known, so the part names any of its şöbələr, shared or not (Persian spellings: Feyli = Feili, Mowlavi = Mövləvi)
    const tl = (w) => w.replace(/y/g, 'i').replace(/ow/g, 'öv').replace(/ou/g, 'u').replace(/j/g, 'c').replace(/ğ/g, 'q');
    const tail = nameT(title.slice(ci + 1)).map(tl), d = MUG.dastgahs.find((x) => x.id === ds[0]);
    const zil = /^\s*zil\b/i.test(title.slice(ci + 1));
    // names the catalogue spells too differently for the rules below, by hand; used only where this dəstgah lists the şöbə
    const alias = Object.entries(SOBE_ALIAS).find(([k]) => skelWords(title.slice(ci + 1)).split('|').filter(Boolean).join('') === skelJoin(k))?.[1];
    if (alias && d.sections.some((x) => x.az === alias)) return [ds[0], alias];
    let sec = d.sections.find((x) => { if (GENERIC_SOBE.has(nameT(x.az)[0]) || zil !== /^zil\b/i.test(x.az)) return false; const T = nameT(x.az).map(tl); return T.every((w) => tail.some((y) => tokEqM(y, w))); });
    // Persian transliterations (Hejaz = Hicaz, Shekaste-ye Fars = Şikəsteyi-fars, Bayat-e Tork = Bayatı-Türk): the consonant skeletons agree;
    // the longest şöbə whose skeleton stands in the part's wins (a skeleton under 3 letters, Üşşaq = şq, must be the whole part)
    if (!sec) {
      const part = title.slice(ci + 1), ts = skelWords(part);
      sec = d.sections.flatMap((x) => secNames(x.az).map((n) => [x, skelJoin(n), n])).filter(([x, k, n]) => k.length >= 2 && !GENERIC_SOBE.has(nameT(x.az)[0]) && zil === /^zil\b/i.test(n)
        && (k.length >= 3 ? skelAt(ts, k) : ts === `|${k}|`)).sort((p, q) => q[1].length - p[1].length)[0]?.[0];
    }
    // with the dəstgah known, the sections every mugham has count where this dəstgah lists them (Çahargah's Bərdaşt, Bayatı-Şiraz's Ayaq),
    // and «Maye» or the dəstgah's own name as the part («Homayun: Homayun») is its base section, «Mayeyi-…»
    if (!sec) {
      const pw = skelWords(title.slice(ci + 1)).split('|').filter(Boolean);
      if (pw.length === 1) {
        const own = skelJoin(d.name.az), ownAlt = [d.name.en, ...(D_ALIAS[d.id] ?? [])].map(skelJoin);
        sec = d.sections.find((x) => skelWords(x.az).split('|').filter(Boolean).join('') === pw[0] && GENERIC_SOBE.has(nameT(x.az)[0]))
          ?? ((pw[0] === skel('maye') || pw[0] === own || ownAlt.includes(pw[0])) ? d.sections.find((x) => /^mayeyi/i.test(x.az)) : undefined);
      }
    }
    // translated names: Persian words put into Azerbaijani (kuchak = kiçik, bozorg = böyük), in any order (Persian puts the adjective last:
    // «Masnavi-ye Kuchak» = «Kiçik məsnəvi»); or the part is the distinctive last word of one şöbə only («Mokhalef» = Manənd-Müxalif)
    if (!sec) {
      const part = title.slice(ci + 1).replace(/\b[a-zəıüöşçğ]+\b/gi, (w) => FA_AZ[w.toLowerCase()] ?? w), words = skelWords(part).split('|').filter(Boolean);
      const cands = d.sections.filter((x) => !GENERIC_SOBE.has(nameT(x.az)[0]) && zil === /^zil\b/i.test(x.az));
      sec = cands.find((x) => { const ws = skelWords(x.az).split('|').filter(Boolean); return ws.length > 1 && ws.every((w) => w.length >= 2 && words.includes(w)) && words.length <= ws.length + 1; });
      if (!sec && words.length === 1 && words[0].length >= 4) { const hit = cands.filter((x) => skelWords(x.az).split('|').filter(Boolean).at(-1) === words[0]); if (hit.length === 1) sec = hit[0]; }
    }
    const k = sec ? null : keys.find((k) => k.d.id === ds[0]).ks.find((k) => k.sobe && k.t.every((w) => tail.some((x) => tokEqM(x, tl(w)))));
    return [ds[0], sec?.az ?? k?.sobe ?? null];
  }
  return mughamOf1(title);
};
const mughamOf1 = (title) => {
  const T = nameT(title), hits = [];
  if (NOT_MUGHAM.test(title) || others.some((o) => o.every((w) => T.some((x) => tokEqM(x, w))))) return null;
  for (const { d, ks } of keys) { const k = ks.find((k) => k.t.every((w) => T.some((x) => tokEqM(x, w)))); if (k) hits.push([d.id, k.sobe]); }
  return hits.length === 1 ? hits[0] : null; // a title naming two dəstgahs («Rast–Segah») is not sorted
};
const M = MUG.dastgahs.map((d) => ({ id: d.id, n: d.name, ch: d.character, s: d.sections.map((x) => x.az), t: [], v: [] }));
const Mby = new Map(M.map((m) => [m.id, m]));
for (const a of A) {
  if (a.g.every((g) => g === 'estrada' || g === 'pop')) continue;
  a.t.forEach((x, i) => { const h = mughamOf(typeof x[0] === 'object' ? x[0].az : x[0]); if (h) Mby.get(h[0]).t.push([a.q, i, h[1] ?? '']); });
  (a.v ?? []).forEach((v, i) => { const h = mughamOf(v[1]); if (h) Mby.get(h[0]).v.push([a.q, i, h[1] ?? '']); });
}
// Beyond the ten tracks a musician keeps: all their cached Apple songs, the full albums of those whose lookup was cut off, and the search by
// dəstgah name (scripts/apple-mugham.mjs). A search hit by someone outside the catalogue counts only when its title or album says
// muğam / təsnif / zərbi (Segah and Rast are also Persian and Turkish modes), and never in pop, rap, dance or rock. These go into x:
// [owner or '', track, şöbə]; the dəstgah page lists them after the catalogue's own.
{
  const known = new Set(A.flatMap((a) => a.t.map((x) => x[3])));
  const appleQ = new Map(); for (const a of A) if (APPLE[a.q]) appleQ.set(String(APPLE[a.q].id), a.q);
  // khanendes, players, composers, jazz: not estrada or pop, and not ashiqs, whose «Hüseyni» or «Arazbarı» is an ashiq melody of the same name
  const mughamOK = new Set(A.filter((a) => a.g.some((g) => ['mugham', 'instr', 'classic', 'jazz'].includes(g))).map((a) => a.q));
  const SAYS = /mu[gğ]am|мугам|t[əe]sn[iı]f|теснif|z[əa]rb[iı]/i, NOTPOP = /pop|hip|rap|dance|electro|r&b|rock|soundtrack/i;
  const pool = [];
  for (const a of A) if (mughamOK.has(a.q) && APPLE[a.q]) for (const x of [...(MATCH[a.q]?.songs ?? []), ...(MATCH[a.q]?.extra ?? []), ...(AMUG.byArtist[a.q] ?? [])]) pool.push([a.q, x]);
  for (const x of AMUG.search) { const q = appleQ.get(x.artistId) ?? ''; if (q ? mughamOK.has(q) : SAYS.test(`${x.name} ${x.album}`) && !NOTPOP.test(x.genre ?? '')) pool.push([q, x]); }
  for (const m of M) m.x = [];
  const FILL = new Set(nameT('muğam muğamı mugham mugam мугам dəstgah dastgah azerbaijan azerbaijani azərbaycan live vol single ep'));
  const albumDastgah = (album) => { const T = nameT(album ?? '').filter((w) => !FILL.has(w) && !/^\d+$/.test(w)); const ds = dName(T); if (ds.length !== 1) return null; const d = keys.find((k) => k.d.id === ds[0]); return d.ks.some((k) => k.sobe === null && k.t.length === T.length) ? [ds[0], null] : null; };
  const seen = new Set(known), seenName = new Set();
  for (const [q, x] of pool) {
    if (!x.preview || seen.has(x.preview) || (x.ms ?? 99999) <= 40000) continue;
    const h = mughamOf(x.name) ?? albumDastgah(x.album); if (!h) continue;
    const k = norm(x.name) + '|' + norm(x.by ?? ''); if (seenName.has(k)) continue;
    const m = Mby.get(h[0]); if (m.x.length >= 150) continue;
    seen.add(x.preview); seenName.add(k);
    const al = MATCH[q]?.albums?.find((y) => y.id === x.albumId);
    if (x.art && x.albumId) ART[x.albumId] ??= x.art;
    m.x.push([q, [x.name, x.by ?? '', alb(x.albumId, x.album, al?.date ?? x.date, al?.url ?? x.albumUrl), x.preview, x.url, Math.round((x.ms ?? 0) / 1000), 0], h[1] ?? '']);
  }
}
// the symphonic mughams of the works list (Amirov's Şur, Kürd ovşarı…): the work's own title decides, a fourth field marks the owner as a work
for (const w of W) {
  const h = mughamOf(w.az) ?? mughamOf(w.en ?? '') ?? mughamOf(w.ru ?? ''); if (!h) continue;
  w.t.forEach((x, i) => Mby.get(h[0]).t.push([w.q, i, h[1] ?? '', 1])); (w.v ?? []).forEach((v, i) => Mby.get(h[0]).v.push([w.q, i, h[1] ?? '', 1]));
}

const albums = [...ALB.values()].map(([, n, y, u, a]) => [n, y, u, a]);
const out = { built: new Date().toISOString().slice(0, 10), artists: A, works: W, mughams: M, tree: { genres: GEN.nodes, links: TL, people: TP }, schools: schools.map(({ k, n, m }) => ({ k, n, m })), albums };
// long shared URL prefixes as short tokens; the page expands them (X in index.html)
const PRE = [[/https:\/\/audio-ssl\.itunes\.apple\.com\/itunes-assets\//g, '~a/'], [/https:\/\/is(\d)-ssl\.mzstatic\.com\/image\/thumb\//g, '~i$1/'], [/https:\/\/music\.apple\.com\//g, '~m/'], [/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//g, '~u/'], [/https:\/\/commons\.wikimedia\.org\/wiki\//g, '~c/']];
let json = JSON.stringify(out); for (const [re, t] of PRE) json = json.replace(re, t);
await writeFile(R('../data/catalog.json'), json);

console.log(Math.round(json.length / 1024), 'KB');
const st = (f) => A.filter(f).length;
console.log('artists', A.length, 'tracks', A.reduce((s, a) => s + a.t.length, 0), 'free', A.reduce((s, a) => s + a.t.filter((t) => t[6] === 1).length, 0), 'albums', albums.length,
  '| works', W.length, 'tracks', W.reduce((s, w) => s + w.t.length, 0), '| schools', schools.length, schools.map((s) => s.n.az + ' ' + s.m.length).join(', '));
console.log('youtube: artists', A.filter((a) => a.v).length, 'videos', A.reduce((s, a) => s + (a.v?.length ?? 0), 0), '| only on youtube', A.filter((a) => a.v && !a.t.length).map((a) => a.az).join(', '), '| works', W.filter((w) => w.v).length, 'videos', W.reduce((s, w) => s + (w.v?.length ?? 0), 0), '| works only on youtube', W.filter((w) => !w.t.length).length);
console.log('tree', GEN.nodes.length, 'genres,', TL.length, 'links,', Object.keys(TP).length, 'people without a page');
console.log('mughams', M.map((m) => `${m.n.az} ${m.t.length}+${m.x.length}x+${m.v.length}v`).join(', '));
console.log('genres', Object.fromEntries(GORDER.map((g) => [g, st((a) => a.g.includes(g))])), 'periods', Object.fromEntries(PERIODS.map(([k]) => [k, st((a) => a.p.includes(k))])));
