// Builds shared/search.json, the index behind the search on every page of azadbilik.org (shared/hub.js):
// the sections and maps, and the people and places they hold, each pointing at its spot on its page
// (an author on the literary map, a musician on the music page, a district on the population map …).
// Reads this checkout and its siblings ../xerite and ../qalereya.
//
//   node scripts/search-index.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const here = new URL('../', import.meta.url);
const sib = (repo) => new URL(`../${repo}/`, here);
const json = async (base, path) => JSON.parse(await readFile(new URL(path, base), 'utf8'));
const html = (path) => readFile(new URL(path, here), 'utf8');
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const three = (h) => ['az', 'ru', 'en'].map((l) => strip(h.match(new RegExp(`<span data-l="${l}">(.*?)</span>`, 's'))?.[1] ?? ''));

// Pages: the cards of the two indexes (their names in three languages), then the rest by hand.
// d: where the page's data can be downloaded (the open-data repository, else the page's own folder)
const DATA = 'https://github.com/azadbilik/data/tree/main/';
const SITE = 'https://github.com/azadbilik/azadbilik.github.io/tree/main/';
const pages = [];
for (const idx of ['xeriteler/index.html', 'atlas/index.html']) {
  for (const m of (await html(idx)).matchAll(/<li class="map">\s*<a href="([^"]+)"[^>]*>.*?<h3>(.*?)<\/h3>\s*<p>(.*?)<\/p>/gs))
    pages.push({ u: m[1], n: three(m[2]), s: three(m[3]).map((x) => x.split(/[:.;]/)[0]) });
}
const add = (u, n, s) => { if (!pages.some((p) => p.u === u)) pages.push({ u, n, s }); };
add('/', ['Azad Bilik', 'Azad Bilik', 'Azad Bilik'], ['Ana səhifə', 'Главная', 'Home']);
add('https://kitabxana.az', ['Kitabxana', 'Библиотека', 'Library'], ['Azərbaycan ədəbiyyatının onlayn kitabxanası', 'Онлайн-библиотека азербайджанской литературы', 'An online library of Azerbaijani literature']);
add('/qalereya/', ['Qalereya', 'Галерея', 'Gallery'], ['Nizami və Füzulinin poemalarına miniatürlər', 'Миниатюры к поэмам Низами и Физули', 'Miniatures for the poems of Nizami and Fuzuli']);
add('/qalereya/tarix/', ['İncəsənət', 'Искусство', 'Art'], ['Azərbaycan incəsənəti, qədimdən bu günədək', 'Искусство Азербайджана с древности до наших дней', 'Azerbaijani art from antiquity to today']);
add('/xeriteler/', ['Ədəbi xəritələr', 'Литературные карты', 'Literary maps'], ['Şairlərin yerləri, poemaların yolları', 'Места поэтов, пути поэм', 'Where poets lived, where poems travel']);
add('/atlas/', ['Atlas', 'Атлас', 'Atlas'], ['Tarixi Azərbaycan rəqəmlərdə və xəritələrdə', 'Исторический Азербайджан в цифрах и картах', 'Historical Azerbaijan in numbers and maps']);
add('/atlas/serhedler/hekaye/', ['Sərhədlər necə dəyişdi', 'Как менялись границы', 'How the borders moved'], ['Hekayə, 1800–1991', 'История, 1800–1991', 'A story, 1800–1991']);
add('/musiqi/', ['Musiqi', 'Музыка', 'Music'], ['İlk səs yazıları, 1902-dən', 'Первые записи, с 1902 года', 'The first recordings, from 1902']);
add('/sebeke/', ['Şəbəkələr', 'Сети', 'Networks'], ['Kim kimə bağlıdır: şairlər, alimlər, insanlar, məhsullar', 'Кто с кем связан: поэты, учёные, люди, товары', 'Who connects to whom: poets, scientists, people, products']);
add('/soz/', ['Söz ehtiyatı', 'Словарь поэтов', 'Poets’ vocabulary'], ['Şair neçə söz işlədir?', 'Сколько слов у поэта?', 'How many words does a poet use?']);
add('/sebeke/elm/', ['Elm şəbəkəsi', 'Сеть науки', 'Science network'], ['Azərbaycan elmi kimlərlə birgə yazır?', 'С кем в соавторстве пишет наука Азербайджана?', 'Who Azerbaijani science writes with']);
add('/sebeke/ixrac/', ['İxrac məhsul fəzası', 'Пространство экспорта', 'Export product space'], ['Azərbaycan nə satır, nəyi satmağa yaxındır?', 'Что Азербайджан продаёт и что мог бы', 'What Azerbaijan sells, and what it is close to selling']);
add('/sebeke/qanunlar/', ['Hüquqi aktlar şəbəkəsi', 'Сеть правовых актов', 'Network of legal acts'], ['Hansı akt hansını dəyişir, icra edir, ləğv edir', 'Какой акт какой изменяет, исполняет, отменяет', 'Which act amends, implements or repeals which']);
add('https://github.com/azadbilik/data', ['Açıq məlumat', 'Открытые данные', 'Open data'], ['CSV, CC0, Zenodo-da DOI ilə', 'CSV, CC0, DOI на Zenodo', 'CSV, CC0, with a DOI on Zenodo']);
const dataOf = {
  '/atlas/ehali/': DATA + 'atlas/population', '/atlas/icmalar/': DATA + 'atlas/communities', '/atlas/xalqlar/': DATA + 'atlas/peoples',
  '/atlas/1897/': DATA + 'atlas/languages-1897', '/atlas/rayonlar/': DATA + 'atlas/soviet-raions',
  '/xerite/': DATA + 'culture/kitabxana', '/qalereya/': DATA + 'culture/qalereya', '/qalereya/emalatxana/': DATA + 'culture/qalereya',
};
for (const p of pages) {
  if (dataOf[p.u]) p.d = dataOf[p.u];
  else if (p.u.startsWith('/atlas/') || p.u.startsWith('/sebeke/') || p.u.startsWith('/xeriteler/') || p.u === '/musiqi/' || p.u === '/soz/') {
    // the page's data folder where it has one, else the page's own folder (its route or story file lives there)
    const dir = p.u.slice(1);
    p.d = SITE + (existsSync(new URL(dir + 'data', here)) ? dir + 'data' : dir);
  }
}

const items = [];
const push = (k, n, s, u) => items.push({ k, n, s, u });
const years = (a, b) => (a || b ? `${a ?? '?'}–${b ?? ''}` : '');

// Authors on the literary map
for (const a of await json(sib('xerite'), 'data/authors.json'))
  push('author', [a.az, a.ru, a.en], [a.birth?.az, a.birth?.ru, a.birth?.en].map((pl) => [years(a.born, a.died), pl].filter(Boolean).join(' · ')), `/xerite/?author=${a.slug}`);
// Musicians
for (const m of await json(here, 'musiqi/data/musicians.json'))
  push('musician', [m.az, m.ru ?? m.az, m.en ?? m.az], [m.place?.az, m.place?.ru, m.place?.en].map((pl) => [years(m.born, m.died), pl].filter(Boolean).join(' · ')), `/musiqi/?person=${m.qid}`);
// Poets of the answer-poem network (who also have a page there)
for (const p of (await json(here, 'sebeke/nezire/data/nezire.json')).poets)
  push('poet', [p.az, p.ru, p.en], [years(p.born, p.died)] .concat([years(p.born, p.died), years(p.born, p.died)]), `/sebeke/nezire/?poet=${p.slug}`);
// Districts and shahrestans on the population map
for (const f of (await json(here, 'atlas/ehali/data/units.geojson')).features) {
  const u = f.properties;
  push('place', [u.az, u.ru, u.en], u.country === 'az' ? ['Azərbaycan Respublikası', 'Азербайджанская Республика', 'Republic of Azerbaijan'] : ['İran Azərbaycanı', 'Иранский Азербайджан', 'Iranian Azerbaijan'], `/atlas/ehali/?u=${encodeURIComponent(u.key)}`);
}
// Rivers and khanates
for (const f of (await json(here, 'atlas/hovze/data/rivers.geojson')).features) {
  const r = f.properties;
  push('river', [r.az, r.ru, r.en], [`${r.length} km`, `${r.length} км`, `${r.length} km`], `/atlas/hovze/?r=${r.id}`);
}
const kh = await json(here, 'atlas/xanliqlar/data/khanates.json');
for (const k of kh.khanates) push('khanate', k.names, k.annexed ? [`${k.annexed}-cü ildə Rusiyaya keçib`, `к России в ${k.annexed}`, `to Russia in ${k.annexed}`] : ['', '', ''], `/atlas/xanliqlar/?k=${k.id}`);
// Scenes of the gallery's poems
for (const p of (await json(sib('qalereya'), 'data/gallery.json')).poems)
  for (const s of p.scenes ?? []) push('scene', [s.az, s.ru ?? s.az, s.en ?? s.az], [p.az, p.ru, p.en], `/qalereya/?p=${p.slug}#s-${s.id}`);

const out = { built: new Date().toISOString().slice(0, 10), pages, items };
await writeFile(new URL('shared/search.json', here), JSON.stringify(out));
const by = {}; for (const i of items) by[i.k] = (by[i.k] ?? 0) + 1;
console.log(pages.length, 'pages', by, (JSON.stringify(out).length / 1024).toFixed(0) + ' KB');
