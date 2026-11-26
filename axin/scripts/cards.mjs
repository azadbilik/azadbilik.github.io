// Builds axin/cards.json, the pool behind the Axın prototype (axin/index.html): one card per thing
// worth a screen — a nəzirə pair (a model's opening couplet and an answer's), an early recording,
// a miniature with its scene, a musician with their birthplace. Each card carries thread keys (t):
// the people in it, so the page can follow a thread from one card to the next.
// Reads this checkout and its sibling ../qalereya.
//
//   node axin/scripts/cards.mjs
import { readFile, writeFile } from 'node:fs/promises';

const here = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, here), 'utf8'));
const tri = (o) => (o ? [o.az, o.ru ?? o.az, o.en ?? o.az] : null);
const cards = [];

// Nəzirə: link a answers b; tiers A and B (the radif repeated whole and rhymed before it)
const nz = await json('sebeke/nezire/data/nezire.json');
// Poets of the network who are also the gallery's authors
const POET_KEY = { fuzuli: 'fuzuli', nasimi: 'nasimi', xetai: 'xetai', habibi: 'habibi' };
for (const l of nz.links.filter((l) => l.tier === 'A' || l.tier === 'B')) {
  const a = nz.poems[l.a], b = nz.poems[l.b], pa = nz.poets[a.p], pb = nz.poets[b.p];
  if (!a?.m?.length || !b?.m?.length || pa.slug === pb.slug) continue;
  cards.push({
    k: 'nezire', id: `nz-${l.a}-${l.b}`,
    model: { poet: tri(pb), years: [pb.born, pb.died], slug: pb.slug, m: b.m },
    answer: { poet: tri(pa), years: [pa.born, pa.died], slug: pa.slug, m: a.m },
    t: [`poet:${pa.slug}`, `poet:${pb.slug}`],
    u: `/sebeke/nezire/?poet=${pa.slug}`,
  });
}

// Recordings: the ones with a performer and a file
const mugham = await json('musiqi/data/mugham.json');
const norm = (s) => s.toLowerCase().replace(/[^a-zəğıöüçş]/g, '');
const dastgahOf = (title) => mugham.dastgahs.find((d) => norm(title).startsWith(norm(d.name.az)));
for (const r of await json('musiqi/data/recordings.json')) {
  if (!r.performer || !r.mp3 || /\(\d\)$/.test(r.title.az)) continue; // second takes add nothing to a feed
  const d = r.kind === 'mugham' ? dastgahOf(r.title.az) : null;
  cards.push({
    k: 'record', id: `rec-${r.id}`,
    title: tri(r.title), kind: r.kind, performer: tri(r.performer), year: r.year,
    character: d ? tri(d.character) : null, mp3: r.mp3, commons: r.commons,
    t: [`person:${r.performer.qid}`].concat(d ? [`dastgah:${d.id}`] : []),
    u: `/musiqi/?person=${r.performer.qid}`,
  });
}

// Musicians with a birthplace and dates
const recorded = new Set(cards.filter((c) => c.k === 'record').map((c) => c.t[0]));
for (const m of await json('musiqi/data/musicians.json')) {
  if (!m.place || !m.born || m.born < 1800) continue;
  const key = `person:${m.qid}`;
  // keep the pool's people to those with a recording, plus a handful of others
  if (!recorded.has(key) && cards.filter((c) => c.k === 'person').length > 12) continue;
  cards.push({
    k: 'person', id: `p-${m.qid}`,
    name: [m.az, m.ru ?? m.az, m.en ?? m.az], roles: m.roles, born: m.born, died: m.died ?? null,
    place: tri(m.place), t: [key], u: `/musiqi/?person=${m.qid}`,
  });
}

// Miniatures: free images placed in a scene of a poem
const g = await json('../qalereya/data/gallery.json');
const scenes = new Map(g.poems.flatMap((p) => (p.scenes ?? []).map((s) => [s.id, { s, p }])));
const seen = new Set();
const POET_NAME = { nizami: ['Nizami Gəncəvi', 'Низами Гянджеви', 'Nizami Ganjavi'], fuzuli: tri(nz.poets.find((p) => p.slug === 'fuzuli')) };
for (const it of g.items) {
  if (!it.free || !it.scene || !it.large || !scenes.has(it.scene)) continue;
  if (seen.has(it.scene)) continue; // one picture per scene
  seen.add(it.scene);
  const { s, p } = scenes.get(it.scene);
  const poet = p.slug.split('-')[0];
  cards.push({
    k: 'miniature', id: `min-${it.id}`, poet: POET_NAME[poet],
    img: `https://azadbilik.org/qalereya/${it.large}`, w: it.w, h: it.h,
    scene: tri(s), poem: tri(p), when: it.when, city: tri(it.place?.city), dynasty: tri(it.place?.dynasty),
    t: [`poet:${POET_KEY[poet] ?? poet}`, `scene:${it.scene}`],
    u: `/qalereya/?p=${p.slug}#s-${s.id}`,
  });
}

await writeFile(new URL('axin/cards.json', here), JSON.stringify({ built: new Date().toISOString().slice(0, 10), cards }));
const by = {}; for (const c of cards) by[c.k] = (by[c.k] ?? 0) + 1;
console.log(cards.length, 'cards', by, (JSON.stringify(cards).length / 1024).toFixed(0) + ' KB');
