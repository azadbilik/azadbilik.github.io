// Builds the 1897 map's data from the census tables as Demoscope transcribes them
// (data/raw/demoscope-1897.json: each page's label and table rows) and RISTAT's uyezd boundaries
// (data/raw/uyezds-1897.geojson):
//   data/census-1897.csv   every unit (uyezd, town, governorate) × language: men, women, both sexes, source
//   data/units.geojson     the 44 uyezds and okrugs with names in three languages and their languages
//   node scripts/build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../data/', import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const raw = await json('raw/demoscope-1897.json');
// Each page: [label, "labelIndex,men,women,both;…"] → { t, rows: [[label, men, women, both], …] }
const pages = Object.fromEntries(Object.entries(raw.c).map(([reg, [t, s]]) => [reg, { t, rows: s.split(';').map((r) => { const [i, ...n] = r.split(','); return [raw.labs[i], ...n]; }) }]));
const geo = await json('raw/uyezds-1897.geojson');
const names = await json('names.json');
const langs = await json('languages.json');
delete langs._note;

// Of the Tiflis governorate only the two Azerbaijani-inhabited units are mapped
const TIFLIS_KEEP = new Set(['Борчалинский', 'Закатальский']);
const dropped = (ru, gov) => /^Тифлисск/.test(gov) && !TIFLIS_KEEP.has(ru);
const SRC = (reg) => `https://www.demoscope.ru/weekly/ssp/emp_lan_97_uezd.php?reg=${reg}`;
const num = (s) => /^[\d\s]+$/.test(s) && /\d/.test(s) ? Number(s.replace(/\s/g, '')) : null;
const byLabel = {};
for (const [k, l] of Object.entries(langs)) for (const x of l.labels) byLabel[x] = k;
const langKey = (label) => byLabel[label] ?? 'other';

// A page's rows: [group?, label, men, women, both]. Group headings carry no figures and are skipped;
// «Итого» under Russian sums the three East Slavic rows already counted, so it is skipped too.
function parse(rows) {
  let total = null;
  const out = [];
  for (const r of rows) {
    const cells = r.filter((c) => c !== '');
    const nums = [];
    while (cells.length && num(cells.at(-1)) != null) nums.unshift(num(cells.pop()));
    if (nums.length < 3) continue;
    const [m, f, both] = nums.slice(-3);
    const label = cells.at(-1);
    if (label === 'ИТОГО') { total = { m, f, both }; continue; }
    if (label === 'Итого') continue;
    out.push({ label: label.replace(/\s*\(\*+\)$/, ''), m, f, both });
  }
  return { total, rows: out };
}

// Demoscope's page labels: «Бакинский уезд - весь», «Бакинский уезд - г. Баку», «Бакинская губерния - вся»
const ALIAS = { 'Карский': 'Карсский' };
const units = {}, towns = {}, govs = {};
const csv = [['unit_ru', 'unit_az', 'unit_en', 'kind', 'uyezd_ru', 'language', 'language_ru', 'men', 'women', 'both', 'source_url'].join(',')];
// Names in Azerbaijani and English: governorates by their census name, uezds by stem, towns by name
const GOVNAME = Object.fromEntries(Object.values(names.govs).map((n) => [n[1], n]));
const unitName = (kind, key) => (kind === 'governorate' ? GOVNAME[key] : kind === 'uyezd' ? names.units[key] : names.towns[key]) ?? [key, key, key];
let uyezd = null, gov = null;
for (const [reg, p] of Object.entries(pages).sort((a, b) => a[0] - b[0])) {
  const t = p.t.replace(/\s+/g, ' ').trim();
  const { total, rows } = parse(p.rows);
  if (!total) { console.warn(`no total: ${reg} ${t}`); continue; }
  const sum = rows.reduce((s, r) => s + r.both, 0);
  if (sum !== total.both) console.warn(`rows ≠ total: ${t} ${sum} vs ${total.both}`);
  let kind, key;
  if (/ - вся$/.test(t)) { kind = 'governorate'; key = t.replace(/ - вся$/, ''); uyezd = null; gov = key; }
  else if (/ - (весь)$/.test(t)) { kind = 'uyezd'; key = t.replace(/ (уезд|округ) - весь$/, ''); key = ALIAS[key] ?? key; uyezd = key; }
  else if (/ - (г\.|м\.|мест\.|сел\.|уроч\.|укрепл\.|пос\.)/.test(t)) { kind = 'town'; key = t.replace(/^.* - (г\.|м\.|мест\.|сел\.|уроч\.|укрепл\.|пос\.)\s*/, '').trim(); }
  else continue; // «города», «уезды без городов», «… без города»: the same people counted again
  if (gov === 'Тифлисская губерния' && (kind === 'governorate' || !TIFLIS_KEEP.has(kind === 'uyezd' ? key : uyezd))) continue;
  const byLang = {};
  for (const r of rows) {
    const k = langKey(r.label);
    byLang[k] = (byLang[k] ?? 0) + r.both;
    const un = unitName(kind, key);
    csv.push([un[1], un[0], un[2], kind, kind === 'town' ? names.units[uyezd]?.[1] ?? uyezd : kind === 'uyezd' ? un[1] : '', k, r.label, r.m, r.f, r.both, SRC(reg)].map((x) => /[,"]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : x).join(','));
  }
  const entry = { total: total.both, men: total.m, women: total.f, langs: byLang, src: SRC(reg) };
  if (kind === 'governorate') govs[key] = entry;
  else if (kind === 'uyezd') units[key] = entry;
  else { const n = names.towns?.[key]; if (!n) console.warn(`no names for town ${key}`); (towns[uyezd] ??= []).push({ key, az: n?.[0] ?? key, ru: key, en: n?.[2] ?? key, ...entry }); }
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
const round = (c) => typeof c[0] === 'number' ? [r4(c[0]), r4(c[1])] : c.map(round);
const GOV = { 'Карская губерния': 'Карская область', 'Тифлисская губерния вкл. Закатальский округ': 'Тифлисская губерния' };
const features = geo.features.filter((f) => !dropped(f.properties.Name_RU, f.properties.prov_RU)).map((f, id) => {
  const ru = f.properties.Name_RU;
  const n = names.units[ru], g = names.govs[f.properties.prov_RU];
  const c = units[ru];
  if (!n || !g) throw new Error(`no names for ${ru} / ${f.properties.prov_RU}`);
  if (!c) console.warn(`no census for ${ru}`);
  return { type: 'Feature', id, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) }, properties: {
    id, key: ru, az: n[0], ru: n[1], en: n[2], gov: g, govKey: GOV[f.properties.prov_RU] ?? f.properties.prov_RU, ristat: f.properties.Distr_ID,
    ...(c ?? {}), towns: towns[ru] ?? [],
  } };
});

const languages = Object.fromEntries(Object.entries(langs).map(([k, l]) => [k, { color: l.color, names: l.names, labels: l.labels }]));
await writeFile(new URL('census-1897.csv', root), csv.join('\n') + '\n');
await writeFile(new URL('units.geojson', root), JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
await writeFile(new URL('census.out.json', root), JSON.stringify({ languages, govs }) + '\n');
const all = Object.values(units).reduce((s, u) => s + u.total, 0);
console.log(`${features.length} units, ${Object.keys(units).length} with census, ${Object.values(towns).flat().length} towns, ${Object.keys(govs).length} governorates; population ${all}`);
const other = csv.slice(1).filter((l) => l.split(',')[3] === 'other').map((l) => l.split(',')[4]);
console.log('in "other":', [...new Set(other)].join(' · '));
