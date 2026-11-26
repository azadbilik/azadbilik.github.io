// Stage 2: data/raw/*.json (from fetch.mjs) -> data/insanlar.json (what the page reads).
//   node scripts/build.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRegion } from './region.mjs';

const RAW = new URL('../data/raw/', import.meta.url);
const rows = (re) => readdirSync(RAW).filter((f) => re.test(f)).sort().flatMap((f) => JSON.parse(readFileSync(new URL(f, RAW), 'utf8')));
const qid = (u) => u.slice(u.lastIndexOf('/') + 1);
const num = (q) => +q.slice(1);
const pt = (w) => { const m = /Point\(([-\d.e]+) ([-\d.e]+)\)/.exec(w); return m ? [+m[1], +m[2]] : null; };
const year = (s) => { if (!s) return null; const m = /^(-?)(\d{4,})-/.exec(s); if (!m || m[1]) return null; const y = +m[2]; return y >= 500 && y <= 2026 ? y : null; };

// ---- entities
const ent = new Map();
for (const r of rows(/^ent(fix)?_/)) {
  const id = qid(r.e.value);
  const e = ent.get(id) ?? { l: {}, c: null, pc: null, ctry: null };
  if (r.l) e.l[r.lang.value] = r.l.value;
  if (r.c && !e.c) e.c = pt(r.c.value);
  if (r.pc && !e.pc) e.pc = pt(r.pc.value);
  if (r.ctry && !e.ctry) e.ctry = qid(r.ctry.value);
  ent.set(id, e);
}
const label = (id) => { const l = ent.get(id)?.l ?? {}; const en = l.en ?? l.az ?? l.ru ?? id; return [en, l.az && l.az !== en ? l.az : '', l.ru && l.ru !== en ? l.ru : '']; };

// ---- people
const P = new Map();
const person = (id) => { let p = P.get(id); if (!p) { p = { id, l: {}, bp: new Set(), dp: new Set(), born: new Set(), died: new Set(), sl: 0, sex: null, occ: [], res: new Set(), lang: new Set(), eth: new Set(), wp: 0, act: new Set(), cit: new Set(), viaEth: false }; P.set(id, p); } return p; };
const lastLang = (r) => r.pLabel?.['xml:lang'];
for (const r of [...rows(/^tile_/), ...rows(/^ethnic/)]) {
  const p = person(qid(r.p.value));
  if (r.pLabel) { p.l[lastLang(r) ?? 'en'] = r.pLabel.value; }
  if (r.bp) p.bp.add(qid(r.bp.value)); if (r.dp) p.dp.add(qid(r.dp.value));
  if (r.born) p.born.add(r.born.value); if (r.died) p.died.add(r.died.value);
  if (r.sl) p.sl = Math.max(p.sl, +r.sl.value);
  if (r.sex) p.sex = qid(r.sex.value);
  if (r.eg) p.viaEth = true;
}
for (const r of rows(/^detail_/)) {
  const p = P.get(qid(r.p.value)); if (!p) continue;
  const k = r.k.value, v = r.v.value;
  if (k === 'occ') p.occ.push(qid(v)); else if (k === 'res' || k === 'work') p.res.add(qid(v));
  else if (k === 'lang') p.lang.add(qid(v)); else if (k === 'eth') p.eth.add(qid(v));
  else if (k === 'act') p.act.add(qid(v)); else if (k === 'cit') p.cit.add(qid(v));
  else if (k === 'wp') p.wp |= { en: 1, az: 2, ru: 4 }[v] ?? 0;
}
const PN = new Map(); // names: the label service puts the language in pLabel's xml:lang; for az/ru we ask the entity labels below
console.log('people raw', P.size);

// ---- occupation categories from English labels
const CATS = [
  ['lit', /writer|poet|novelist|playwright|dramatist|journalist|translator|essayist|critic|lyricist|publisher|editor|author|storyteller|biographer|columnist|satirist|screenwriter|children's|literary|folklor|bard|ashik|ashug|publicist|memoirist|humorist|editing staff|editorial|lexicograph|textolog|theatrolog|poetess/i],
  ['music', /music|composer|singer|conductor|pianist|violin|cellist|vocal|opera|tar player|kamancha|mugham|performer|songwriter|accordion|guitar|drummer|DJ|rapper|bandleader|instrumental|lutenist|saz|tenor|soprano|baritone/i],
  ['art', /painter|sculptor|architect|graphic|illustrator|photograph|designer|ceramic|artist|carpet|calligraph|miniatur|engraver|cartoonist|fashion|draughts|illuminator|caricatur|scenograph/i],
  ['stage', /actor|actress|director|theatre|theater|film|cinemat|television|presenter|comedian|dancer|choreograph|ballet|producer|animator|stage|screen/i],
  ['rel', /cleric|imam|mufti|theolog|religio|islamic|preacher|ayatollah|mullah|priest|clergy|sheikh|monk|bishop|missionar|scholar of islam|hafiz|mujtahid|marja|ulema|akhoond|akhund|mystic|qadi|sufi|dervish|mullah|dua/i],
  ['sci', /scientist|professor|teacher|educator|historian|philolog|linguist|orientalist|mathemat|physic|chemist|biolog|engineer|geolog|economist|philosoph|researcher|academic|archaeolog|ethnograph|astronom|physician|surgeon|doctor|medic|pharmac|inventor|jurist|lawyer|sociolog|psycholog|geograph|botan|zoolog|agronom|veterinar|librarian|lecturer|encyclop|folklorist|bibliograph|numismat|epigraph|manuscript|neurolog|oncolog|ophthalm|cardiolog|pedagog|olog|scholar|therapist|psychiatr|mechanic|zootechn|animal breed|scientist|researcher|chemist/i],
  ['mil', /military|officer|general|soldier|admiral|pilot|partisan|commander|colonel|aviator|army|navy|marshal|cosmonaut|astronaut|fighter|guerrilla|resistance|spy|intelligence|police|war |fedayeen|fedai|cossack/i],
  ['pol', /politic|diplomat|statesman|activist|revolution|khan|monarch|president|minister|governor|ruler|member of|deputy|mayor|chairman|trade union|bolshevik|commissar|party|nobleman|noble|emir|shah|sultan|bey|judge|ambassador|dissident|leader|official|civil servant|human rights|political|prince|king|vizier|regent|prime|statesperson|public figure|sovereign|prosecutor|politician/i],
  ['biz', /business|entrepreneur|industrial|merchant|banker|philanthrop|oil|financ|trader|manager|executive|investor|patron|landowner|oligarch|manufacturer|cotton planter|planter|landlord/i],
  ['sport', /player|wrestler|weightlift|chess|athlete|boxer|judo|gymnast|sport|footballer|runner|swimmer|fencer|shooter|cyclist|sambo|kickbox|karate|taekwondo|volleyball|basketball|handball|referee|coach|trainer|olympic|racing|driver|skier|skater|bodybuild|mountaineer|archer|rower|canoe|jockey|mixed martial|hockey|tennis|golfer|biathl|racer|paralymp|sumo|alpinist|competitor|athlet/i],
];
const CAT_KEYS = [...CATS.map((c) => c[0]), 'other'];
const catOf = (en) => { for (const [k, re] of CATS) if (re.test(en)) return k; return 'other'; };
const occCat = new Map();
const unmatched = new Map();
const catFor = (p) => {
  const cnt = {};
  for (const o of p.occ) { const en = label(o)[0]; const c = catOf(en); cnt[c] = (cnt[c] ?? 0) + 1; if (c === 'other') unmatched.set(en, (unmatched.get(en) ?? 0) + 1); }
  let best = 'other', bn = 0;
  for (const k of CAT_KEYS) if ((cnt[k] ?? 0) > bn && k !== 'other') { best = k; bn = cnt[k]; }
  return best;
};

// ---- the region and who is kept
const region = buildRegion();
const GRP = ['az', 'ir', 'oth', 'eth'];
const placeIds = new Set(), occIds = new Set(), langIds = new Set();
const coord = (id) => { const e = ent.get(id); if (!e) return null; return e.c ?? e.pc; };
const kept = [];
let dropNoPlace = 0, dropLiving = 0, dropOut = 0;
const ETHSET = new Set(['Q482942', 'Q2426677', 'Q101452272', 'Q2356912', 'Q2476065', 'Q4058280']);
for (const p of P.values()) {
  const bps = [...p.bp].sort();
  let bp = null, unit = null;
  for (const b of bps) { const c = ent.get(b)?.c; const u = c && region.find(c[0], c[1]); if (u) { bp = b; unit = u; break; } }
  if (!bp) bp = bps[0] ?? null;
  let grp;
  if (unit) grp = unit.group; else if (p.viaEth || [...p.eth].some((e) => ETHSET.has(e))) grp = 'eth'; else { dropOut++; continue; }
  const born = year([...p.born].sort()[0]), died = year([...p.died].sort()[0]);
  // living people: only when widely known (3+ Wikimedia sites); everyone else is left out
  const living = !p.died.size && born && born > 1906;
  if (living && p.sl < 3) { dropLiving++; continue; }
  if (!p.born.size && !p.died.size && p.sl < 2) { dropNoPlace++; continue; }
  const dp = [...p.dp].sort()[0] ?? null;
  kept.push({ p, bp, dp, grp, unit: unit?.name ?? null, born, died: died && born && died < born ? null : died, living });
}
console.log('kept', kept.length, 'out of region', dropOut, 'living-dropped', dropLiving, 'undated, 1 site', dropNoPlace);

// ---- compact output
const placeIdx = new Map(), places = [], countries = new Map();
const placeOf = (id) => {
  if (!id) return -1;
  if (placeIdx.has(id)) return placeIdx.get(id);
  const e = ent.get(id), c = coord(id);
  if (!c) { placeIdx.set(id, -1); return -1; }
  let ci = -1;
  if (e.ctry) { if (!countries.has(e.ctry)) countries.set(e.ctry, countries.size); ci = countries.get(e.ctry); }
  const [en, az, ru] = label(id);
  places.push([en, az, ru, Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4, ci, e.c ? 0 : 1, num(id)]);
  placeIdx.set(id, places.length - 1); return places.length - 1;
};
const occIdx = new Map(), occs = [], langIdx = new Map(), langs = [];
const idxOf = (map, arr, id) => { if (!map.has(id)) { map.set(id, arr.length); arr.push(label(id)); } return map.get(id); };
const SEX = { Q6581097: 1, Q6581072: 2 }; // male, female; 0 other/unknown
const out = [];
for (const k of kept) {
  const p = k.p, l = p.l;
  const nm = label(p.id);
  const bp = placeOf(k.bp), dp = placeOf(k.dp);
  const res = [...p.res].map(placeOf).filter((i) => i >= 0 && i !== bp && i !== dp);
  const uniq = [...new Set(res)].slice(0, 12);
  const occList = [...new Set(p.occ)].slice(0, 8).map((o) => idxOf(occIdx, occs, o));
  const langList = [...p.lang].slice(0, 6).map((o) => idxOf(langIdx, langs, o));
  out.push([num(p.id), nm[0], nm[1], nm[2], k.born, k.died, bp, dp, CAT_KEYS.indexOf(catFor(p)), p.sl, SEX[p.sex] ?? 0, GRP.indexOf(k.grp), uniq, occList, langList, p.wp, k.living ? 1 : 0, k.unit ?? '']);
}
// sort: most widely known first (page truncates lists by that)
out.sort((a, b) => b[9] - a[9] || a[0] - b[0]);
const ctryList = [...countries.keys()].map((id) => label(id));

// ---- coverage numbers
const decades = {}, byGrp = {}, bySex = { 0: 0, 1: 0, 2: 0 }, byCat = {};
for (const r of out) { const d = r[4] ? Math.floor(r[4] / 10) * 10 : 'u'; decades[d] = decades[d] ?? [0, 0, 0]; decades[d][r[10]]++; byGrp[GRP[r[11]]] = (byGrp[GRP[r[11]]] ?? 0) + 1; bySex[r[10]]++; byCat[CAT_KEYS[r[8]]] = (byCat[CAT_KEYS[r[8]]] ?? 0) + 1; }
const withDeathPlace = out.filter((r) => r[6] >= 0 && r[7] >= 0).length;
const stats = { total: out.length, byGrp, bySex, byCat, withDeathPlace, withBirthPlace: out.filter((r) => r[6] >= 0).length, withBorn: out.filter((r) => r[4]).length, decades,
  dropped: { outOfRegion: dropOut, livingFewSites: dropLiving, undatedOneSite: dropNoPlace } };
const json = { built: new Date().toISOString().slice(0, 10), cats: CAT_KEYS, grps: GRP, stats, countries: ctryList, places, occs, langs, people: out };
writeFileSync(new URL('../data/insanlar.json', import.meta.url), JSON.stringify(json));
console.log(JSON.stringify(stats));
console.log('places', places.length, 'occs', occs.length, 'bytes', JSON.stringify(json).length);
console.log('top unmatched occupations', [...unmatched].sort((a, b) => b[1] - a[1]).slice(0, 40).map((x) => x.join(':')).join(' | '));
