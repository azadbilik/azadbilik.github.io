// Gəzinti (/gezinti/<city>/): one city's places and walks from its data/site.json (gezinti/scripts/build.mjs).
// What is particular to a city is in the page's window.CITY: { title, sub: {az, ru, en}, center: [lng, lat],
// zoom, underlay?: { plans: url of a plans.json, key, base: url the plan's tile path is relative to, label: {az, ru, en} } }. The panel shows one of
// four views: the walks, all places by kind, one walk's stops, one place's card (alone or as a stop).
// The address keeps the view: ?w=<walk>, ?p=<place>, ?w=<walk>&s=<stop number>.
let dark = window.abTheme ? abTheme.dark() : matchMedia('(prefers-color-scheme: dark)').matches;
addEventListener('themechange', (e) => { dark = e.detail === 'dark'; setTimeout(paint, 50); });
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const phone = () => matchMedia('(max-width: 48rem)').matches;

const LANGS = ['az', 'ru', 'en'];
let lang = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(q)) return q;
  try { const s = localStorage.getItem('lang'); if (LANGS.includes(s)) return s; } catch {}
  return 'az';
})();
const CITY = window.CITY;
const KINDS = ['fort', 'palace', 'mosque', 'bath', 'caravanserai', 'church', 'tomb', 'museum', 'house', 'other'];
const T = {
  az: { walks: 'Gəzintilər', places: 'Bütün yerlər', section: 'Gəzinti',
    kinds: { fort: 'Qala, qapılar, qüllələr', palace: 'Saraylar', mosque: 'Məscidlər', bath: 'Hamamlar', caravanserai: 'Karvansaralar', church: 'Kilsə, məbəd', tomb: 'Türbələr', museum: 'Muzeylər', house: 'Evlər, meydanlar', other: 'Başqa yerlər' },
    kind1: { fort: 'Qala', palace: 'Saray', mosque: 'Məscid', bath: 'Hamam', caravanserai: 'Karvansara', church: 'Kilsə, məbəd', tomb: 'Türbə', museum: 'Muzey', house: 'Ev, meydan', other: 'Başqa' },
    stops: (n) => `${n} dayanacaq`, km: (m, min) => `${(m / 1000).toFixed(1).replace('.', ',')} km, təxminən ${min} dəq. yol`,
    start: 'Başla', back: 'Geri', all: 'Bütün gəzintilər', prev: 'Əvvəlki', next: 'Növbəti', of: (i, n) => `${i} / ${n}`,
    wiki: 'Vikipediya', wikidata: 'Vikidata', route: 'Ora necə getmək', photo: 'Foto', from: (l) => `Vikipediya, ${{ ru: 'rusca', en: 'ingiliscə', az: 'azərbaycanca' }[l]} məqalədən`, fromWiki: 'Vikipediyadan',
    walls: 'Qala divarları', me: 'Mən haradayam',
    note: 'Gəzintilərin dayanacaqları haqqında mətnləri Vikipediya məqalələri əsasında biz yazmışıq; başqa yerlərdə Vikipediya məqaləsinin girişi verilir (CC BY-SA), fotolar Wikimedia Commons-dandır, adlar Vikidatadan, küçələr və yerlər OpenStreetMap-dən. Gəzintilər küçələrlə gedir; vaxt saatda 4,5 km piyada sürətilə, dayanmadan hesablanıb.' },
  ru: { walks: 'Прогулки', places: 'Все места', section: 'Прогулки',
    kinds: { fort: 'Крепость, ворота, башни', palace: 'Дворцы', mosque: 'Мечети', bath: 'Бани', caravanserai: 'Караван-сараи', church: 'Церкви, храмы', tomb: 'Мавзолеи', museum: 'Музеи', house: 'Дома, площади', other: 'Другие места' },
    kind1: { fort: 'Крепость', palace: 'Дворец', mosque: 'Мечеть', bath: 'Баня', caravanserai: 'Караван-сарай', church: 'Церковь, храм', tomb: 'Мавзолей', museum: 'Музей', house: 'Дом, площадь', other: 'Другое' },
    stops: (n) => `${n} ${new Intl.PluralRules('ru').select(n) === 'one' ? 'остановка' : new Intl.PluralRules('ru').select(n) === 'few' ? 'остановки' : 'остановок'}`,
    km: (m, min) => `${(m / 1000).toFixed(1).replace('.', ',')} км, около ${min} мин пешком`,
    start: 'Начать', back: 'Назад', all: 'Все прогулки', prev: 'Назад', next: 'Дальше', of: (i, n) => `${i} из ${n}`,
    wiki: 'Википедия', wikidata: 'Викиданные', route: 'Как дойти', photo: 'Фото', from: (l) => `Википедия, из статьи на ${{ az: 'азербайджанском', en: 'английском', ru: 'русском' }[l]}`, fromWiki: 'Из Википедии',
    walls: 'Крепостные стены', me: 'Где я',
    note: 'Тексты об остановках прогулок написаны нами по статьям Википедии; у остальных мест — начало статьи Википедии (CC BY-SA), фото — с Wikimedia Commons, названия — из Викиданных, улицы и места — из OpenStreetMap. Прогулки идут по улицам; время — при 4,5 км/ч, без остановок.' },
  en: { walks: 'Walks', places: 'All places', section: 'Walks',
    kinds: { fort: 'Walls, gates, towers', palace: 'Palaces', mosque: 'Mosques', bath: 'Bathhouses', caravanserai: 'Caravanserais', church: 'Churches, temples', tomb: 'Mausoleums', museum: 'Museums', house: 'Houses, squares', other: 'Other places' },
    kind1: { fort: 'Fortress', palace: 'Palace', mosque: 'Mosque', bath: 'Bathhouse', caravanserai: 'Caravanserai', church: 'Church, temple', tomb: 'Mausoleum', museum: 'Museum', house: 'House, square', other: 'Other' },
    stops: (n) => `${n} stops`, km: (m, min) => `${(m / 1000).toFixed(1)} km, about ${min} min on foot`,
    start: 'Start', back: 'Back', all: 'All walks', prev: 'Previous', next: 'Next', of: (i, n) => `${i} of ${n}`,
    wiki: 'Wikipedia', wikidata: 'Wikidata', route: 'Directions', photo: 'Photo', from: (l) => `Wikipedia, from the ${{ az: 'Azerbaijani', ru: 'Russian', en: 'English' }[l]} article`, fromWiki: 'From Wikipedia',
    walls: 'The walls', me: 'Where am I',
    note: 'The texts on the walks\' stops are our own, written from the Wikipedia articles; other places show the opening of their Wikipedia article (CC BY-SA); photos are from Wikimedia Commons, names from Wikidata, streets and positions from OpenStreetMap. Walks follow the streets; times assume 4.5 km/h without stops.' },
};
const t = (k) => ({ title: CITY.title[lang], sub: CITY.sub[lang], ...T[lang] })[k];
const L = (o) => o?.[lang] ?? o?.az ?? o?.en ?? o?.ru ?? '';
const minutes = (m) => Math.max(5, Math.round(m / 75 / 5) * 5);

let site = null, byId = {}, view = { tab: 'walks' }, plan = null, shown = new Set(KINDS);

const map = new maplibregl.Map({
  container: 'map',
  style: `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`,
  center: CITY.center, zoom: CITY.zoom ?? 16, minZoom: 13, maxZoom: 19.5,
  attributionControl: { compact: true, customAttribution: 'Wikipedia · Wikimedia Commons · Wikidata' },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-right');
const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
const pad = () => phone() ? { top: 48, right: 32, left: 32, bottom: document.querySelector('.panel').offsetHeight + 32 } : { top: 64, right: 64, bottom: 64, left: 27 * 16 + 48 };
const labelExpr = () => ['coalesce', ['get', `name:${lang}`], ['get', lang === 'ru' ? 'name' : 'name:latin'], ['get', 'name']];
map.on('style.load', () => {
  for (const l of map.getStyle().layers) {
    if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', css('--land'));
    if (l.type === 'fill' && /water|ocean|lake/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', css('--water'));
    if (l.type === 'symbol' && l.layout?.['text-field'] && !l.id.startsWith('ish-')) map.setLayoutProperty(l.id, 'text-field', labelExpr());
  }
});

const kindColor = () => ['match', ['get', 'kind'], ...KINDS.flatMap((k) => [k, css(`--k-${k}`)]), css('--ink')];
function paint() {
  if (!map.getLayer('ish-places')) return;
  map.setPaintProperty('ish-walls-fill', 'fill-color', css('--accent'));
  map.setPaintProperty('ish-walls', 'line-color', css('--ink'));
  map.setPaintProperty('ish-places', 'circle-color', kindColor());
  map.setPaintProperty('ish-places', 'circle-stroke-color', css('--paper'));
  map.setPaintProperty('ish-names', 'text-color', css('--ink'));
  map.setPaintProperty('ish-names', 'text-halo-color', css('--paper'));
  map.setPaintProperty('ish-stops', 'circle-stroke-color', css('--paper'));
  map.setPaintProperty('ish-stop-n', 'text-color', css('--on-accent'));
  for (const w of site.walks) map.setPaintProperty(`ish-walk-${w.id}`, 'line-color', css(`--${w.color}`));
  map.setPaintProperty('ish-stops', 'circle-color', ['match', ['get', 'walk'], ...site.walks.flatMap((w) => [w.id, css(`--${w.color}`)]), css('--accent')]);
}

map.on('load', async () => {
  const [s, plans] = await Promise.all([fetch('data/site.json').then((r) => r.json()), (CITY.underlay ? fetch(CITY.underlay.plans).then((r) => r.json()).catch(() => ({})) : Promise.resolve({}))]);
  site = s; byId = Object.fromEntries(site.places.map((p) => [p.id, p]));
  plan = CITY.underlay && plans[CITY.underlay.key];
  if (plan) {
    map.addSource('underlay', { type: 'raster', tiles: [location.origin + CITY.underlay.base + plan.tiles], tileSize: 256, bounds: plan.bounds, minzoom: plan.minzoom ?? 12, maxzoom: plan.maxzoom ?? 16 });
    map.addLayer({ id: 'ish-plan', type: 'raster', source: 'underlay', layout: { visibility: 'none' }, paint: { 'raster-opacity': .85 } });
  }
  map.addSource('walls', { type: 'geojson', data: site.outline ? { type: 'Feature', geometry: { type: 'Polygon', coordinates: [site.outline] } } : { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'ish-walls-fill', type: 'fill', source: 'walls', paint: { 'fill-color': css('--accent'), 'fill-opacity': .05 } });
  map.addLayer({ id: 'ish-walls', type: 'line', source: 'walls', paint: { 'line-color': css('--ink'), 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 1.5, 18, 5], 'line-opacity': .55 } });
  for (const w of site.walks) {
    map.addSource(`walk-${w.id}`, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: w.path } } });
    map.addLayer({ id: `ish-walk-${w.id}`, type: 'line', source: `walk-${w.id}`, layout: { 'line-join': 'round', 'line-cap': 'round', visibility: 'none' },
      paint: { 'line-color': css(`--${w.color}`), 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 6], 'line-opacity': .85 } });
  }
  map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: site.places.map((p) => ({ type: 'Feature', id: site.places.indexOf(p), properties: { id: p.id, kind: p.kind, name: L(p.name) }, geometry: { type: 'Point', coordinates: p.at } })) } });
  map.addLayer({ id: 'ish-places', type: 'circle', source: 'places', paint: {
    'circle-color': kindColor(), 'circle-stroke-color': css('--paper'), 'circle-stroke-width': 1.5,
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, ['case', ['boolean', ['feature-state', 'on'], false], 7, 3], 18, ['case', ['boolean', ['feature-state', 'on'], false], 12, 8]],
    'circle-opacity': ['case', ['boolean', ['feature-state', 'dim'], false], .25, 1], 'circle-stroke-opacity': ['case', ['boolean', ['feature-state', 'dim'], false], .25, 1] } });
  map.addLayer({ id: 'ish-names', type: 'symbol', source: 'places', minzoom: 17, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true },
    paint: { 'text-color': css('--ink'), 'text-halo-color': css('--paper'), 'text-halo-width': 1.5 } });
  map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'ish-stops', type: 'circle', source: 'stops', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 7, 18, 11], 'circle-color': css('--accent'), 'circle-stroke-color': css('--paper'), 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'ish-stop-n', type: 'symbol', source: 'stops', layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 12], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': css('--on-accent') } });
  paint();

  for (const id of ['ish-places', 'ish-stops']) {
    map.on('mouseenter', id, (e) => { map.getCanvas().style.cursor = 'pointer'; const p = byId[e.features[0].properties.id]; tip.setLngLat(p.at).setHTML(esc(L(p.name))).addTo(map); });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; tip.remove(); });
  }
  map.on('click', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ['ish-stops', 'ish-places'] })[0];
    if (!f) return;
    const id = f.properties.id;
    // a stop of the open walk opens as that stop, with its walk's previous and next
    const w = view.walk && site.walks.find((x) => x.id === view.walk);
    const i = w ? w.stops.indexOf(id) : -1;
    go(i >= 0 ? { walk: w.id, stop: i } : { place: id, tab: view.tab });
  });

  const q = new URLSearchParams(location.search);
  const w = site.walks.find((x) => x.id === q.get('w'));
  go(byId[q.get('p')] ? { place: q.get('p') } : w ? (q.has('s') ? { walk: w.id, stop: Math.min(Math.max(+q.get('s') - 1, 0), w.stops.length - 1) } : { walk: w.id }) : { tab: 'walks' }, { first: true });
  applyLang();
  document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
});

// ---- Views
function go(v, { first = false } = {}) {
  view = { tab: v.tab ?? view.tab ?? 'walks', ...v };
  const q = new URLSearchParams();
  if (lang !== 'az') q.set('lang', lang);
  if (view.place) q.set('p', view.place);
  else if (view.walk) { q.set('w', view.walk); if (view.stop != null) q.set('s', view.stop + 1); }
  history.replaceState(null, '', location.pathname + (q.size ? '?' + q : ''));
  render();
  frame(first);
}

function frame(first) {
  const w = view.walk && site.walks.find((x) => x.id === view.walk);
  for (const x of site.walks) map.setLayoutProperty(`ish-walk-${x.id}`, 'visibility', w?.id === x.id ? 'visible' : 'none');
  map.getSource('stops').setData({ type: 'FeatureCollection', features: w ? w.stops.map((id, i) => ({ type: 'Feature', properties: { id, n: String(i + 1), walk: w.id }, geometry: { type: 'Point', coordinates: byId[id].at } })) : [] });
  const here = view.place ?? (w && view.stop != null ? w.stops[view.stop] : null);
  site.places.forEach((p, i) => map.setFeatureState({ source: 'places', id: i }, { on: p.id === here, dim: (!!w && !w.stops.includes(p.id)) || (!w && !shown.has(p.kind)) }));
  const d = first ? 0 : 900;
  if (here) map.easeTo({ center: byId[here].at, zoom: Math.max(map.getZoom(), 17.2), padding: pad(), duration: d });
  else {
    const pts = w ? w.path : site.outline ?? site.places.map((p) => p.at);
    const b = pts.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: pad(), duration: d, maxZoom: 17.5 });
  }
}

function render() {
  const body = document.getElementById('body');
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', !view.walk && !view.place && b.dataset.tab === view.tab));
  const w = view.walk && site.walks.find((x) => x.id === view.walk);
  if (w && view.stop != null) body.innerHTML = placeCard(byId[w.stops[view.stop]], w, view.stop);
  else if (view.place) body.innerHTML = placeCard(byId[view.place]);
  else if (w) body.innerHTML = walkView(w);
  else body.innerHTML = view.tab === 'places' ? placesView() : walksView();
  body.scrollTop = 0;
  body.querySelectorAll('img').forEach((img) => { img.onerror = () => img.closest('figure')?.remove(); });
}

const walksView = () => site.walks.map((w) =>
  `<button type="button" class="walk" style="--c: var(--${w.color})" data-walk="${w.id}"><h2>${esc(L(w.name))}</h2><div class="meta">${t('stops')(w.stops.length)} · ${t('km')(w.m, minutes(w.m))}</div><p>${esc(L(w.text))}</p></button>`).join('') +
  `<p class="note">${esc(t('note'))}</p>`;

const placesView = () =>
  `<div class="chips">${KINDS.map((k) => `<button type="button" data-kind="${k}" aria-pressed="${shown.has(k)}" style="--c: var(--k-${k})"><i class="dot"></i>${esc(t('kinds')[k])}</button>`).join('')}</div>` +
  KINDS.filter((k) => shown.has(k)).map((k) => {
    const ps = site.places.filter((p) => p.kind === k).sort((a, b) => L(a.name).localeCompare(L(b.name), lang));
    return ps.length ? `<section class="kind" style="--c: var(--k-${k})"><h3><i class="dot"></i>${esc(t('kinds')[k])}</h3><ul>${ps.map((p) => `<li><button type="button" data-place="${p.id}">${esc(L(p.name))}</button></li>`).join('')}</ul></section>` : '';
  }).join('') + `<p class="note">${esc(t('note'))}</p>`;

const walkView = (w) =>
  `<div class="back"><button type="button" data-home>← ${t('all')}</button></div>` +
  `<div class="wk" style="--c: var(--${w.color})"><div class="intro"><h2 class="walkname" style="font: 400 1.625rem/1.15 var(--serif)">${esc(L(w.name))}</h2><div class="meta">${t('stops')(w.stops.length)} · ${t('km')(w.m, minutes(w.m))}</div><p>${esc(L(w.text))}</p></div>` +
  `<div class="go"><button type="button" class="btn" data-stop="0">${t('start')} →</button></div>` +
  `<ol>${w.stops.map((id, i) => `<li><button type="button" data-stop="${i}"><span class="n">${i + 1}</span><span>${esc(L(byId[id].name))}</span></button></li>`).join('')}</ol></div>`;

function placeCard(p, w = null, i = null) {
  // our own text where there is one, else the opening of the Wikipedia article (another language's if need be)
  const own = p.about?.[lang];
  const textLang = own ? lang : p.text[lang] ? lang : ['az', 'en', 'ru'].find((l) => p.text[l]);
  const wikiLang = p.wiki[lang] ? lang : textLang;
  const nav = w
    ? `<div class="back"><button type="button" data-walk="${w.id}">← ${esc(L(w.name))}</button><span>` +
      `<button type="button" data-stop="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="${t('prev')}">←</button> ${t('of')(i + 1, w.stops.length)} ` +
      `<button type="button" data-stop="${i + 1}" ${i === w.stops.length - 1 ? 'disabled' : ''} aria-label="${t('next')}">→</button></span></div>`
    : `<div class="back"><button type="button" data-home>← ${t('back')}</button></div>`;
  const img = p.img ? `<figure class="photo"><img src="${esc(p.img.thumb)}" width="${p.img.w}" height="${p.img.h}" alt="${esc(L(p.name))}" loading="lazy"><figcaption>${t('photo')}: <a href="${esc(p.img.page)}" target="_blank" rel="noopener">${esc(p.img.artist || 'Wikimedia Commons')}</a>${p.img.license ? ' · ' + esc(p.img.license) : ''}</figcaption></figure>` : '';
  const [lng, lat] = p.at;
  return nav + img + `<article class="place" style="--c: var(--k-${p.kind})"><div class="in">` +
    `<div class="k"><i class="dot"></i>${esc(t('kind1')[p.kind])}</div><h2>${esc(L(p.name))}</h2>` +
    (own ? `<p class="text">${esc(own)}</p>`
      : textLang ? `<p class="text" lang="${textLang}">${esc(p.text[textLang])}</p><p class="other">${esc(textLang !== lang ? t('from')(textLang) : t('fromWiki'))}</p>` : '') +
    (w && i < w.stops.length - 1 ? `<div style="margin-top:1rem"><button type="button" class="btn" data-stop="${i + 1}">${t('next')}: ${esc(L(byId[w.stops[i + 1]].name))} →</button></div>` : '') +
    `<div class="reads">` +
    (wikiLang ? `<a href="https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(p.wiki[wikiLang].replace(/ /g, '_'))}" target="_blank" rel="noopener">${t('wiki')}</a>` : '') +
    `<a href="https://www.wikidata.org/wiki/${p.qid}" target="_blank" rel="noopener">${t('wikidata')}</a>` +
    `<a href="https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B${lat}%2C${lng}" target="_blank" rel="noopener">${t('route')}</a>` +
    `</div></div></article>`;
}

document.getElementById('body').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.walk) go({ walk: b.dataset.walk, place: undefined, stop: undefined });
  else if (b.dataset.stop != null) go({ walk: view.walk, stop: +b.dataset.stop, place: undefined });
  else if (b.dataset.place) go({ place: b.dataset.place, walk: undefined, stop: undefined, tab: 'places' });
  else if ('home' in b.dataset) go({ walk: undefined, stop: undefined, place: undefined });
  else if (b.dataset.kind) {
    const k = b.dataset.kind;
    // the first click on a full set shows that kind alone; after that, clicks add and remove
    if (shown.size === KINDS.length) shown = new Set([k]);
    else if (shown.has(k)) { shown.delete(k); if (!shown.size) shown = new Set(KINDS); }
    else shown.add(k);
    render(); frame();
  }
});
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => go({ tab: b.dataset.tab, walk: undefined, stop: undefined, place: undefined })));
addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea') || view.stop == null) return;
  const w = site.walks.find((x) => x.id === view.walk);
  if (e.key === 'ArrowRight' && view.stop < w.stops.length - 1) go({ ...view, stop: view.stop + 1 });
  if (e.key === 'ArrowLeft' && view.stop > 0) go({ ...view, stop: view.stop - 1 });
  if (e.key === 'Escape') go({ walk: view.walk, stop: undefined });
});

// ---- Legend: the walls, and an old plan under the streets where the city has one
function drawLegend() {
  const el = document.getElementById('legend');
  // the walls only where the city has an outline (Gəncə's are gone); the legend hides when it has nothing
  el.innerHTML = (site?.outline ? `<div><svg viewBox="0 0 36 12"><rect x="1" y="1" width="34" height="10" fill="${css('--accent')}" fill-opacity=".08" stroke="${css('--ink')}" stroke-opacity=".55" stroke-width="1.5"/></svg><span class="k">${t('walls')}</span></div>` : '') +
    (plan ? `<label class="toggle"><input type="checkbox" id="plan" ${map.getLayer('ish-plan') && map.getLayoutProperty('ish-plan', 'visibility') === 'visible' ? 'checked' : ''}> ${esc(L(CITY.underlay.label))}</label>` : '');
  el.hidden = !el.innerHTML;
  el.querySelector('#plan')?.addEventListener('change', (e) => map.setLayoutProperty('ish-plan', 'visibility', e.target.checked ? 'visible' : 'none'));
}
addEventListener('themechange', () => setTimeout(drawLegend, 60));

function applyLang() {
  document.documentElement.lang = lang;
  document.title = `${t('title')} · Azad Bilik`;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('.langs [data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  document.querySelectorAll('a[data-keep-lang]').forEach((a) => { const u = new URL(a.href); u.searchParams.delete('lang'); if (lang !== 'az') u.searchParams.set('lang', lang); a.href = u.pathname + u.search; });
  if (!site) return;
  for (const l of map.getStyle().layers) if (l.type === 'symbol' && l.layout?.['text-field'] && !l.id.startsWith('ish-')) map.setLayoutProperty(l.id, 'text-field', labelExpr());
  map.getSource('places').setData({ type: 'FeatureCollection', features: site.places.map((p, i) => ({ type: 'Feature', id: i, properties: { id: p.id, kind: p.kind, name: L(p.name) }, geometry: { type: 'Point', coordinates: p.at } })) });
  drawLegend(); go(view, { first: true });
}
document.querySelectorAll('.langs [data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  try { localStorage.setItem('lang', lang); } catch {}
  applyLang();
}));
