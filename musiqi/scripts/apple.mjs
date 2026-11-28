// Apple Music artists, albums and 30-second previews of the people on the music pages, from the public iTunes Search/Lookup API (no key).
//   node scripts/apple-wd.mjs     Wikidata labels, P2850 (Apple Music artist), P1902/P2205 (Spotify) -> data/.cache/wd-music.json
//   node scripts/apple.mjs        search + lookup (<=18 requests/min, raw answers cached in data/.cache/itunes/, git-ignored) -> data/.cache/apple-match.json, data/apple.json
//   node scripts/apple.mjs --build   rebuild data/apple.json from the cache only (no requests)
// A match is kept when Wikidata P2850 names the artist (authoritative), or when the artist's name fits one of the person's labels
// (az/ru/en/tr, aliases; transliteration-tolerant, every token must match). DROP lists namesakes and doubtful ones, FORCE adds a hand-checked id.
// Previews are never downloaded: data/apple.json holds only the previewUrl and the track's Apple Music page.
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const R = (f) => new URL(f, import.meta.url);
const J = async (f) => JSON.parse(await readFile(R(f), 'utf8'));
import { BUILD, simple, toks, tokEq, nameFits, search, lookup, hits } from './apple-lib.mjs';

// ---- people
const people = new Map();
const add = (p) => { if (!/^Q\d+$/.test(p.qid)) return; const o = people.get(p.qid) ?? { qid: p.qid, names: new Set(), roles: new Set() }; for (const k of ['az', 'ru', 'en']) if (p[k]) o.names.add(p[k]); o.born ??= p.born; o.died ??= p.died; people.set(p.qid, o); };
(await J('../data/musicians.json')).forEach(add); (await J('../bestekarlar/data/composers.json')).people.forEach((p) => { add(p); people.get(p.qid)?.roles.add('composer'); });
(await J('../caz/data/jazz.json')).people.forEach((p) => { add(p); people.get(p.qid)?.roles.add('jazz'); }); (await J('../estrada/data/estrada.raw.json')).people.forEach((p) => { add(p); people.get(p.qid)?.roles.add(p.kind); });
const WD = await J('../data/.cache/wd-music.json');
for (const [q, w] of Object.entries(WD)) for (const n of w.names) people.get(q)?.names.add(n);

// Hand decisions. DROP: qid -> reason (namesake or doubtful). FORCE: qid -> Apple artist id checked by hand.
const DROP = {
  Q2499809: 'Müslüm Maqomayev Sr. (1885–1937): the name only finds his grandson, the singer (Q558799)',
  Q1131312: 'Bülbül: only namesakes (pop acts of the 2010s–20s)',
  Q16374758: 'Sattar: namesakes (Iranian pop)', Q13053058: 'Lisani: matched «Gabriel», no', Q16380365: 'Zargar: a 2026 pop single, namesake',
  Q1979936: 'Jivani: one track credited on an Armenian anthology, no album of his own', Q4054565: 'matched Islama Abdullayeva, a different person',
  Q4073559: 'Aşıq Əli: the catalogue artist is a living ashik of the 2020s', Q16365360: 'same, Aşıq Əli (living namesake)',
  Q16378524: 'Ədalət Nəsibov: matched «Aşıq Adalet», not the same name', Q4216454: 'Qaryağdıoğlu: only «Music of Azerbaijan I: Selection of Iran», origin of the artist unclear',
  Q1189603: 'one single titled in Persian, doubtful', Q134286966: 'only a feature credit', Q107926164: 'Bengt Johansson: namesake (Swedish pop)',
  Q12850037: 'Əli Quliyev: rap namesake', Q16368221: 'two Gülyaz Məmmədovas, unclear', Q12838981: 'Ehtiram Hüseynov: breakbeat namesake',
  Q25543577: 'Səbuhi Cəfərov: spoken-word namesake',
  Q16370169: 'Mirza Mansur Mansurov (d. 1967): only two 2024 singles, no historical release and no title naming him',
  Q1959615: 'Ilyinsky (d. 1920): no album or title carries his name, only others\' performances of one piece',
  Q12838356: 'only a feature credit', Q19715058: 'only a feature credit',
  Q1483971: 'Fərqanə Qasımova: the name search found her father Alim Qasımov\'s artist page (shared id)', Q4223720: 'Aleksandr Klimov (conductor, 1898–1974): the Apple artist is a pop singer of the 2020s',
};
// Apple ids checked by hand (the name search missed them): Niyazi's artist page is «Niyazi Hajibeyov»; Behbudov is «Рашид Бейбутов» on the ru storefront;
// Səxavət Məmmədov the xanəndə (1953–1991) is «Səxavət Məmmədov» (Azad bir quşdum, Zabul Segah, Ay Çiçək), not «Sakhavat Mammadov», the tar player born 1993 (Q140127954)
const FORCE = { Q714526: 838358820, Q714776: 1660753163, Q12846316: 1708058861 };
// Apple splits some artists over several ids: other ids of the same artist, merged in (hand-checked, same name and repertoire)
const ALSO = { Q317397: [1748748666] }; // «Üzeyir Hacıbəyov» (az storefront) beside «Uzeyir Hajibeyov»
// Notes shown with a person's previews
const NOTES = { Q714526: { az: 'Bu fraqmentlər Niyazinin dirijorluq etdiyi yazılardır (Xaçaturyan, Qarayev), onun bəstələri deyil.', ru: 'Это записи, которыми дирижировал Ниязи (Хачатурян, Караев), а не его собственные сочинения.', en: 'These are recordings Niyazi conducted (Khachaturian, Karayev), not his own compositions.' } };
const COUNTRIES = ['az', 'us', 'ru', 'tr']; // storefronts tried for a P2850 id

const match = {};
try { Object.assign(match, await J('../data/.cache/apple-match.json')); } catch {}
const save = () => writeFile(R('../data/.cache/apple-match.json'), JSON.stringify(match, null, 1));
await mkdir(R('../data/.cache/'), { recursive: true });
const best = (p) => [...p.names].filter((n) => /[A-Za-z]/.test(n)).sort((a, b) => (/[əıöüşçğ]/i.test(a) ? 1 : 0) - (/[əıöüşçğ]/i.test(b) ? 1 : 0))[0] ?? [...p.names][0];
let i = 0;
for (const p of people.values()) {
  i++;
  const m = match[p.qid] ??= {};
  if (m.done && (m.cand?.length || m.pass2) && !FORCE[p.qid]) continue;
  const w = WD[p.qid] ?? { apple: [] };
  const names = [...p.names];
  const out = [];
  const ids = new Set([...(w.apple ?? []), ...(FORCE[p.qid] ? [String(FORCE[p.qid])] : [])]);
  for (const id of ids) {
    for (const c of COUNTRIES) { const r = await lookup(id, c, 'musicArtist', 1); const a = r.results?.[0]; if (a) { out.push({ id: String(a.artistId), name: a.artistName, genre: a.primaryGenreName, url: a.artistLinkUrl, country: c, src: w.apple?.includes(id) ? 'wikidata' : 'hand' }); break; } }
    if (!out.length) console.log('  P2850 not found in any storefront', p.qid, id);
  }
  if (!out.length) {
    const terms = new Map(); // search term -> latin first
    const lat = names.filter((n) => /^[\p{Script=Latin}\s.'’\-]+$/u.test(n));
    const ru = names.filter((n) => /\p{Script=Cyrillic}/u.test(n));
    for (const n of [best(p), ...lat.filter((n) => !/[əıöüşçğ]/i.test(n)).slice(0, 2), ...lat.slice(0, 2)]) if (n) terms.set(simple(n), n);
    const tl = [...terms.values()].slice(0, 2);
    const attempts = [];
    // az first (the storefront the readers' own), then us with the second spelling, then ru with the Russian label
    attempts.push([tl[0], 'az']); if (tl[1]) attempts.push([tl[1], 'us']); else attempts.push([tl[0], 'us']); if (ru[0]) attempts.push([ru[0], 'ru']);
    // second pass: a long label (patronymic, «ogli») is no good as a search term; first + last word is
    const long = [...ru, ...lat].filter((n) => toks(n).length >= 3 || /\p{Script=Cyrillic}/u.test(n));
    for (const n of long.slice(0, 2)) { const w = n.replace(/\(.*?\)/g, ' ').split(/[\s,]+/).filter(Boolean); if (w.length >= 3) attempts.push([w[0] + ' ' + w[w.length - 1], /\p{Script=Cyrillic}/u.test(n) ? 'ru' : 'us']); }
    for (const [t, c] of attempts) {
      const r = await search(t, c);
      for (const a of r.results ?? []) {
        if (out.some((o) => o.id === String(a.artistId))) continue;
        if (names.some((n) => nameFits(a.artistName, n))) out.push({ id: String(a.artistId), name: a.artistName, genre: a.primaryGenreName, url: a.artistLinkUrl, country: c, src: 'search', term: t });
      }
      if (out.length) break;
    }
  }
  m.cand = out; m.done = true; m.pass2 = true; m.name = best(p); m.drop = DROP[p.qid];
  if (i % 10 === 0) { await save(); console.log(i, '/', people.size, hits.n, 'requests'); }
}
await save();

// ---- albums and songs of the kept artists
const KEEP = Object.entries(match).filter(([q, m]) => m.cand?.length && !DROP[q]);
console.log(KEEP.length, 'people with a candidate');
// Apple often splits one artist over several ids; of several candidates take the one with most albums (a P2850 id stays first)
for (const [q, m] of KEEP) {
  if (m.cand.length < 2 || m.ranked) continue;
  for (const c of m.cand.slice(0, 4)) { const al = await lookup(c.id, c.country, 'album'); c.n = (al.results ?? []).filter((x) => x.wrapperType === 'collection').length; }
  m.cand.sort((a, b) => (b.src === 'wikidata') - (a.src === 'wikidata') || (b.n ?? 0) - (a.n ?? 0)); m.ranked = true; m.final = false; await save();
}
for (const [q, m] of KEEP) {
  if (m.final && m.finalId === m.cand[0].id) continue;
  const c = m.cand[0]; m.finalId = c.id;
  const al = await lookup(c.id, c.country, 'album'), so = await lookup(c.id, c.country, 'song', 120);
  m.albums = (al.results ?? []).filter((x) => x.wrapperType === 'collection').map((x) => ({ id: String(x.collectionId), name: x.collectionName, date: (x.releaseDate ?? '').slice(0, 10), url: x.collectionViewUrl?.replace(/\?uo=\d+$/, '').replace(/&uo=\d+$/, ''), by: x.artistName, genre: x.primaryGenreName, n: x.trackCount }));
  m.songs = (so.results ?? []).filter((x) => x.wrapperType === 'track' && x.kind === 'song').map((x) => ({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, preview: x.previewUrl, url: x.trackViewUrl?.replace(/\?uo=\d+$/, '').replace(/&uo=\d+$/, ''), date: (x.releaseDate ?? '').slice(0, 10), ms: x.trackTimeMillis }));
  m.final = true; await save();
}
for (const [q, m] of KEEP) {
  if (!ALSO[q] || m.alsoDone === ALSO[q].join()) continue;
  for (const id of ALSO[q]) {
    const al = await lookup(id, 'az', 'album'), so = await lookup(id, 'az', 'song', 120);
    const A = (al.results ?? []).filter((x) => x.wrapperType === 'collection').map((x) => ({ id: String(x.collectionId), name: x.collectionName, date: (x.releaseDate ?? '').slice(0, 10), url: x.collectionViewUrl?.replace(/\?uo=\d+$/, '').replace(/&uo=\d+$/, ''), by: x.artistName, genre: x.primaryGenreName, n: x.trackCount }));
    const S = (so.results ?? []).filter((x) => x.wrapperType === 'track' && x.kind === 'song').map((x) => ({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, preview: x.previewUrl, url: x.trackViewUrl?.replace(/\?uo=\d+$/, '').replace(/&uo=\d+$/, ''), date: (x.releaseDate ?? '').slice(0, 10), ms: x.trackTimeMillis }));
    m.albums = [...(m.albums ?? []), ...A.filter((a) => !m.albums?.some((b) => b.id === a.id))]; m.songs = [...S.filter((x) => !m.songs?.some((b) => b.id === x.id)), ...(m.songs ?? [])];
  }
  m.alsoDone = ALSO[q].join(); await save();
}
// Composers: Apple lists a composer's works under the performers, so look for tracks whose album or title carries the composer's surname («Karayev: Piano Works»)
for (const [q, m] of KEEP) {
  const p = people.get(q), own = (m.songs ?? []).filter((x) => x.preview).length;
  if (!p?.roles.has('composer') || own >= 3 || m.extraDone2) continue;
  const sur = [...p.names].map((n) => toks(n).pop()).filter((t) => t && t.length >= 4);
  const lat = [...p.names].filter((n) => /^[\p{Script=Latin}\s.'’\-]+$/u.test(n)), ru = [...p.names].find((n) => /\p{Script=Cyrillic}/u.test(n));
  const tries = new Map([[simple(best(p)), [best(p), 'us']]]);
  for (const n of lat) if (!tries.has(simple(n)) && tries.size < 3) tries.set(simple(n), [n, 'az']);
  if (ru) tries.set('ru', [ru.replace(/\(.*?\)/g, '').split(/[\s,]+/).filter(Boolean).filter((w, i, a) => i === 0 || i === a.length - 1).join(' '), 'ru']);
  m.extra = [];
  for (const [term, c] of tries.values()) {
    const r = await search(term, c, 'song', 50);
    for (const x of r.results ?? []) {
      if (!x.previewUrl || !x.trackViewUrl) continue;
      const hay = toks((x.collectionName ?? '') + ' ' + (x.trackName ?? '')); // the surname must stand in the album or track title, as classical catalogues title them
      if (!sur.some((t) => hay.some((h) => tokEq(h, t)))) continue;
      if (/arr\.|arranged/i.test(x.trackName) && !/arr\.|arranged/i.test(x.collectionName)) continue;
      m.extra.push({ id: String(x.trackId), name: x.trackName, album: x.collectionName, albumId: String(x.collectionId), by: x.artistName, preview: x.previewUrl, url: x.trackViewUrl.replace(/\?uo=\d+$/, '').replace(/&uo=\d+$/, ''), ms: x.trackTimeMillis });
    }
  }
  m.extraDone2 = true; await save();
}
await save();

// ---- build data/apple.json and data/spotify.json
const comp = new Map((await J('../bestekarlar/data/composers.json')).people.map((p) => [p.qid, p]));
const works = Object.fromEntries((await J('../bestekarlar/data/composers.json')).works?.map((w) => [w.qid ?? w.id, w]) ?? []);
const norm = (s) => String(s).toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+-\s+(single|ep|live|remaster.*)$/i, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const yr = (d) => (d || '').slice(0, 4);
const RIGHT = {}, SPOT = {};
let nA = 0, nP = 0, nS = 0, nR = 0;
for (const [q, m] of Object.entries(match)) {
  if (!m.cand?.length || DROP[q] || !m.final) continue;
  const c = m.cand[0], p = people.get(q);
  // the same Apple artist for two people: keep the one Wikidata names, else neither
  const same = Object.entries(match).filter(([q2, m2]) => q2 !== q && !DROP[q2] && m2.cand?.[0]?.id === c.id);
  if (same.length && c.src !== 'wikidata') { console.log('shared id, dropped', q, m.name, c.id); continue; }
  const own0 = (m.songs ?? []).filter((x) => x.preview).length;
  if (c.src !== 'wikidata' && !(m.albums?.length || own0 >= 3 || m.extra?.length >= 2)) { console.log('thin, dropped', q, m.name, c.name); continue; }
  const seen = new Set(), rec = [];
  for (const a of [...(m.albums ?? [])].sort((x, y) => (x.date || '9').localeCompare(y.date || '9'))) { const k = norm(a.name); if (!k || seen.has(k) || !a.url || !a.date) continue; seen.add(k); rec.push([a.name, yr(a.date), a.url]); }
  const sk = new Set(), pv = [];
  const cand = [...(m.songs ?? []), ...(m.extra ?? [])].filter((x) => x.preview && x.url && (x.ms ?? 99999) > 40000);
  const used = new Set();
  for (const pass of [0, 1]) for (const x of cand) {
    if (pv.length >= 3) break; const k = norm(x.name); if (!k || sk.has(k)) continue;
    if (pass === 0 && used.has(x.albumId)) continue; // first one track per album
    sk.add(k); used.add(x.albumId); pv.push({ t: x.name, a: x.album, u: x.preview, l: x.url });
  }
  RIGHT[q] = { ...(NOTES[q] ? { note: NOTES[q] } : {}), id: c.id, url: c.url?.replace(/\?uo=\d+$/, ''), name: c.name, src: c.src === 'search' ? 'name' : c.src, ev: (c.src === 'wikidata' ? 'Wikidata P2850' : c.src === 'hand' ? 'checked by hand' : `name «${c.name}» fits a label of «${m.name}» (az/ru/en/aliases)`) + `; artist ${c.id}${c.genre ? ', ' + c.genre : ''}; ${rec.length} albums${rec.length ? ' ' + rec[0][1] + '–' + rec[rec.length - 1][1] : ''}, ${(m.songs ?? []).filter((x) => x.preview).length} tracks with a preview`, pv, rec: rec.slice(0, 60), more: rec.length > 60 ? 1 : 0, n: rec.length };
  nA++; if (pv.length) nP++; nR += rec.length;
}
for (const [q, w] of Object.entries(WD)) { if (!w.spotify?.length && !w.spotAlbums?.length) continue; SPOT[q] = { a: w.spotify?.[0], al: w.spotAlbums.map((x) => ({ q: x.qid, id: x.id })) }; if (w.spotify?.length) nS++; }
await writeFile(R('../data/apple.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), people: RIGHT }));
await writeFile(R('../data/spotify.json'), JSON.stringify(SPOT));
console.log('apple', nA, 'previews', nP, 'recordings', nR, 'spotify', nS, 'requests', hits.n);
