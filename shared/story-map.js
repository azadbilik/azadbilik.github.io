// Story maps (/xeriteler/<story>/): a poem's journeys on the map, stop by stop, each stop with
// the poet's line about it, its chapters on kitabxana.az and its miniatures from the gallery.
// Everything particular to a story is in the page's route.json:
//
//   meta:  { title, sub, note: {az, ru, en}, bounds: [[w, s], [e, n]], list: 'parts' | 'story' }
//          'parts' lists the stops under each part (the Iskandarnama's two books); 'story' keeps
//          one list in the order the poem tells it, each stop marked with its traveller's colour
//   parts: [{ id, poem: gallery poem slug, color: 'accent' | 'second' | 'third', name, legend,
//            hub?: stop id }]   a part with a hub joins each of its stops to that stop instead
//            of to the one before (the Seven Beauties' brides, each from her land to the pavilions)
//   stops: [{ id, part, name, lat, lng, chapters: [work slugs], scenes: [gallery scene ids],
//             note?, approx? }]   a road joins each stop to the previous stop of its part
//
// Needs maplibre-gl and /shared/viewer.js before it, and the markup of the story pages.
(() => {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const plural = (n, one, few, many) => { const r = new Intl.PluralRules('ru').select(n); return r === 'one' ? one : r === 'few' ? few : many; };

  // One language at a time: ?lang=, else the visitor's last choice on azadbilik.org, else Azerbaijani
  const LANGS = ['az', 'ru', 'en'];
  let lang = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem('lang'); if (LANGS.includes(s)) return s; } catch {}
    return 'az';
  })();
  const T = {
    az: { map: 'Xəritə', maps: 'Xəritələr', gallery: 'Qalereya', back: 'Bütün yol', prev: 'Əvvəlki', next: 'Növbəti', approx: 'yeri təxminidir', read: 'Kitabxanada oxu',
      chapter: (n) => `${n}-ci fəsil`, pics: (n) => `${n} miniatür`, ch: (n) => `${n} fəsil`, shared: 'eyni yerə bir neçə dəfə', close: 'Bağla', inGallery: 'Qalereyada aç', loading: 'Yüklənir…' },
    ru: { map: 'Карта', maps: 'Карты', gallery: 'Галерея', back: 'Весь путь', prev: 'Назад', next: 'Дальше', approx: 'место приблизительно', read: 'Читать в библиотеке',
      chapter: (n) => `глава ${n}`, pics: (n) => `${n} ${plural(n, 'миниатюра', 'миниатюры', 'миниатюр')}`, ch: (n) => `${n} ${plural(n, 'глава', 'главы', 'глав')}`, shared: 'одно место, несколько остановок', close: 'Закрыть', inGallery: 'Открыть в галерее', loading: 'Загрузка…' },
    en: { map: 'Map', maps: 'Maps', gallery: 'Gallery', back: 'The whole route', prev: 'Previous', next: 'Next', approx: 'approximate place', read: 'Read in the library',
      chapter: (n) => `chapter ${n}`, pics: (n) => `${n} miniature${n === 1 ? '' : 's'}`, ch: (n) => `${n} chapter${n === 1 ? '' : 's'}`, shared: 'one place, several stops', close: 'Close', inGallery: 'Open in the gallery', loading: 'Loading…' },
  };
  const t = (k) => T[lang][k];
  const L = (o) => o?.[lang] ?? o?.az ?? '';
  const KX = () => `https://kitabxana.az${lang === 'az' ? '' : '/' + lang}`;
  const src = (u) => /^(thumbs|large)\//.test(u) ? '/qalereya/' + u : u;

  let meta = {}, parts = [], stops = [], items = [], at = null;
  const sceneNames = {};
  const placeOf = new Map();
  const partOf = (s) => parts.find((p) => p.id === s.part);
  const colorOf = (p) => `var(--${p.color})`;
  const sceneName = (s, id) => L(sceneNames[`${partOf(s).poem}/${id}`]) || id;

  const map = new maplibregl.Map({
    container: 'map',
    style: `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`,
    center: [45, 35], zoom: 3, minZoom: 1.5, maxZoom: 9,
    attributionControl: { compact: true, customAttribution: '<a href="https://kitabxana.az">Nizami · kitabxana.az</a>' },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
  const phone = () => matchMedia('(max-width: 48rem)').matches;
  const pad = () => phone() ? { top: 24, right: 24, left: 24, bottom: document.querySelector('.panel').offsetHeight + 24 } : { top: 48, right: 64, bottom: 48, left: 27 * 16 + 48 };
  const labelExpr = () => ['coalesce', ['get', `name:${lang}`], ['get', lang === 'ru' ? 'name' : 'name:latin'], ['get', 'name']];
  map.on('style.load', () => {
    for (const l of map.getStyle().layers) {
      if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', css('--land'));
      if (l.type === 'fill' && /water|ocean|lake/.test(l.id)) map.setPaintProperty(l.id, 'fill-color', css('--water'));
      if (l.type === 'symbol' && l.layout?.['text-field']) map.setLayoutProperty(l.id, 'text-field', labelExpr());
    }
  });

  map.on('load', async () => {
    const [route, gallery] = await Promise.all([fetch('route.json').then((r) => r.json()), fetch('/qalereya/data/gallery.json').then((r) => r.json())]);
    meta = route.meta; parts = route.parts;
    stops = route.stops.map((s, i) => ({ ...s, n: i + 1 }));
    items = gallery.items;
    for (const p of gallery.poems) for (const sc of p.scenes) sceneNames[`${p.slug}/${sc.id}`] = sc;
    applyLang();
    map.fitBounds(meta.bounds, { padding: pad(), duration: 0 });
    // The credits stay folded behind their ⓘ (open, they cover a phone's map)
    document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');

    // Roads: each stop joined to the previous stop of its part, dashed where either end is approximate
    const legs = [];
    for (const p of parts) {
      const own = stops.filter((s) => s.part === p.id);
      const hub = p.hub && stops.find((s) => s.id === p.hub);
      for (let i = hub ? 0 : 1; i < own.length; i++) {
        const a = hub ?? own[i - 1], b = own[i];
        if (a.lat === b.lat && a.lng === b.lng) continue;
        legs.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] }, properties: { color: css(`--${p.color}`), approx: !!(a.approx || b.approx) } });
      }
    }
    // Stops sharing a place share a dot, labelled with every visit: "2 · 20 · 28"
    const places = new Map();
    for (const s of stops) {
      const k = `${s.lat},${s.lng}`;
      if (!places.has(k)) places.set(k, { lat: s.lat, lng: s.lng, stops: [] });
      places.get(k).stops.push(s);
    }
    [...places.values()].forEach((p, k) => p.stops.forEach((s) => placeOf.set(s.id, k)));
    map.addSource('legs', { type: 'geojson', data: { type: 'FeatureCollection', features: legs } });
    map.addSource('stops', { type: 'geojson', generateId: true, data: { type: 'FeatureCollection', features: [...places.values()].map((p) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { ids: p.stops.map((s) => s.id).join(' '), label: p.stops.map((s) => s.n).join(' · '), color: css(`--${partOf(p.stops[0]).color}`), approx: p.stops.every((s) => s.approx) },
    })) } });
    map.addLayer({ id: 'legs', type: 'line', source: 'legs', layout: { 'line-cap': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': .7 }, filter: ['!', ['get', 'approx']] });
    map.addLayer({ id: 'legs-approx', type: 'line', source: 'legs', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': .55, 'line-dasharray': [2, 2] }, filter: ['get', 'approx'] });
    map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: {
      'circle-radius': ['case', ['boolean', ['feature-state', 'sel'], false], 8, 5.5],
      'circle-color': ['case', ['get', 'approx'], css('--paper'), ['get', 'color']],
      'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': ['case', ['get', 'approx'], 2, 1.5],
    } });
    map.addLayer({ id: 'stop-labels', type: 'symbol', source: 'stops', layout: {
      'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0.9, 0], 'text-anchor': 'left',
    }, paint: { 'text-color': css('--ink'), 'text-halo-color': css('--paper'), 'text-halo-width': 1.5 } });

    map.on('mousemove', 'stops', (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features[0];
      const names = f.properties.ids.split(' ').map((id) => stops.find((s) => s.id === id)).map((s) => `${s.n}. ${esc(L(s.name))}`);
      tip.setLngLat(f.geometry.coordinates).setHTML(names.join('<br>')).addTo(map);
    });
    map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = ''; tip.remove(); });
    map.on('click', 'stops', (e) => {
      // A place visited more than once opens on the next visit after the one being read
      const ids = e.features[0].properties.ids.split(' ');
      const cur = ids.indexOf(stops[at]?.id);
      show(stops.findIndex((s) => s.id === ids[(cur + 1) % ids.length]));
    });

    const start = stops.findIndex((s) => s.id === location.hash.slice(1));
    if (start >= 0) show(start); else overview();
  });

  const picsOf = (s) => s.scenes.map((id) => ({ id, pics: items.filter((x) => x.poem === partOf(s).poem && x.scene === id) }));

  function overview() {
    at = null;
    mark(null);
    history.replaceState(null, '', location.pathname + location.search);
    const row = (s, dot) => {
      const n = picsOf(s).reduce((a, x) => a + x.pics.length, 0);
      return `<li><button type="button" data-i="${s.n - 1}"><span class="n">${s.n}</span><span class="name">${dot ? `<span class="who" style="--c: ${colorOf(partOf(s))}"></span>` : ''}${esc(L(s.name))}</span><span class="meta">${[t('ch')(s.chapters.length), n && t('pics')(n), s.approx && t('approx')].filter(Boolean).join(' · ')}</span></button></li>`;
    };
    const el = document.getElementById('body');
    el.innerHTML = (meta.list === 'story'
      ? `<section class="route"><ol>${stops.map((s) => row(s, true)).join('')}</ol></section>`
      : parts.map((p) => `<section class="route" style="--c: ${colorOf(p)}"><h2>${esc(L(p.name))}</h2><ol>${stops.filter((s) => s.part === p.id).map((s) => row(s, false)).join('')}</ol></section>`).join(''))
      + `<p class="note">${esc(L(meta.note))}</p>`;
    el.querySelectorAll('button[data-i]').forEach((b) => b.onclick = () => show(+b.dataset.i));
    el.scrollTop = 0;
    map.fitBounds(meta.bounds, { padding: pad(), duration: still() ? 0 : 800 });
  }

  function show(i) {
    if (i < 0 || i >= stops.length) return;
    at = i;
    const s = stops[i], p = partOf(s);
    mark(s);
    history.replaceState(null, '', `${location.pathname}${location.search}#${s.id}`);
    const scenes = picsOf(s).map(({ id, pics }) => `<div class="scene"><h3>${esc(sceneName(s, id))}</h3>${pics.length ? `<div class="thumbs">${pics.map((x) => `<button type="button" data-pic="${esc(x.id)}" title="${esc(x.title)}"><img src="${esc(src(x.thumb))}"${x.w ? ` width="${x.w}" height="${x.h}"` : ''} alt="${esc(x.title)}" loading="lazy" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="this.parentElement.remove()"></button>`).join('')}</div>` : ''}</div>`).join('');
    const reads = s.chapters.map((c) => `<a href="${KX()}/works/${c}">${t('chapter')(c.match(/(\d+)$/)[1])} ↗</a>`).join('');
    const el = document.getElementById('body');
    el.innerHTML = `<div class="stop" style="--c: ${colorOf(p)}">
      <div class="stop-nav"><button type="button" id="back">← ${t('back')}</button><span><button type="button" id="prev" ${i === 0 ? 'disabled' : ''}>‹ ${t('prev')}</button> · <button type="button" id="next" ${i === stops.length - 1 ? 'disabled' : ''}>${t('next')} ›</button></span></div>
      <p class="part">${s.n} / ${stops.length} · ${esc(L(p.name).split(':')[0])}</p>
      <h2>${esc(L(s.name))}</h2>${s.approx ? `<p class="approx">${t('approx')}</p>` : ''}
      ${s.note ? `<p class="text">${esc(L(s.note))}</p>` : ''}
      ${scenes}
      ${reads ? `<div class="reads"><span>${t('read')}</span>${reads}</div>` : ''}</div>`;
    const all = picsOf(s).flatMap((x) => x.pics);
    el.querySelectorAll('[data-pic]').forEach((b) => b.onclick = () => openPic(all, all.findIndex((x) => x.id === b.dataset.pic), s));
    document.getElementById('back').onclick = overview;
    document.getElementById('prev').onclick = () => show(i - 1);
    document.getElementById('next').onclick = () => show(i + 1);
    el.scrollTop = 0;
    // The way in: from this traveller's previous stop (or the part's hub) to this one, in view
    const before = (p.hub && stops.find((x) => x.id === p.hub)) || stops.slice(0, i).reverse().find((x) => x.part === s.part);
    const pts = [[s.lng, s.lat], ...(before && !(before.lat === s.lat && before.lng === s.lng) ? [[before.lng, before.lat]] : [])];
    const b = pts.reduce((bb, pt) => bb.extend(pt), new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(b, { padding: pad(), maxZoom: 5, duration: still() ? 0 : 900 });
  }

  // A miniature opens in the hub's viewer, its neighbours at this stop beside it
  function openPic(list, i, s) {
    const q = lang === 'az' ? '' : `lang=${lang}&`;
    AzadViewer.open(list, i, {
      src: (x) => src(x.thumb), full: (x) => x.large && src(x.large), fallback: (x) => x.image, alt: (x) => x.title,
      labels: { close: t('close'), prev: t('prev'), next: t('next'), loading: t('loading') },
      info: (x) => `<p class="m">${esc(sceneName(s, x.scene))}</p><h2>${esc(x.title)}</h2>
        <p class="m">${[x.when ?? x.date, x.manuscript, x.museum].filter(Boolean).map(esc).join('<br>')}</p>
        <p><a href="/qalereya/?${q}p=${partOf(s).poem}#${encodeURIComponent(x.id)}">${t('inGallery')} →</a></p>`,
    });
  }

  let marked = null;
  function mark(s) {
    if (!map.getSource('stops')) return;
    if (marked != null) map.setFeatureState({ source: 'stops', id: marked }, { sel: false });
    marked = s ? placeOf.get(s.id) : null;
    if (marked != null) map.setFeatureState({ source: 'stops', id: marked }, { sel: true });
  }

  function drawLegend() {
    const line = (c, dash) => `<svg viewBox="0 0 36 12" aria-hidden="true"><line x1="2" y1="6" x2="34" y2="6" stroke="${c}" stroke-width="2"${dash ? ' stroke-dasharray="4 3"' : ''}/></svg>`;
    const dot = `<svg viewBox="0 0 36 12" aria-hidden="true"><circle cx="8" cy="6" r="4.5" fill="${css('--paper')}" stroke="${css('--muted')}" stroke-width="1.75"/></svg>`;
    const shared = stops.some((s, i) => stops.some((o, j) => j !== i && o.lat === s.lat && o.lng === s.lng));
    document.getElementById('legend').innerHTML = parts.map((p) => `<div>${line(css(`--${p.color}`))}<span>${esc(L(p.legend ?? p.name))}</span></div>`).join('')
      + (stops.some((s) => s.approx) ? `<div>${dot}<span class="k">${t('approx')}</span></div>` : '')
      + (shared ? `<div><svg viewBox="0 0 36 12" aria-hidden="true"><text x="2" y="10" font-size="10" font-weight="700" fill="currentColor">2·20</text></svg><span class="k">${t('shared')}</span></div>` : '');
  }

  function applyLang() {
    document.documentElement.lang = lang;
    if (meta.title) {
      document.title = `${L(meta.title)} · Azad Bilik`;
      document.querySelector('h1').textContent = L(meta.title);
      document.querySelector('.sub').textContent = L(meta.sub);
    }
    document.querySelectorAll('[data-i18n]').forEach((el) => el.textContent = t(el.dataset.i18n));
    document.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
    document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    document.querySelectorAll('[data-keep-lang]').forEach((a) => { const u = new URL(a.getAttribute('href'), location.href); if (lang === 'az') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang); a.href = u.pathname + u.search; });
    if (parts.length) drawLegend();
  }
  applyLang();
  document.querySelectorAll('[data-lang]').forEach((b) => b.onclick = () => {
    lang = b.dataset.lang;
    try { localStorage.setItem('lang', lang); } catch {}
    const u = new URL(location.href);
    if (lang === 'az') u.searchParams.delete('lang'); else u.searchParams.set('lang', lang);
    history.replaceState(null, '', u);
    applyLang();
    if (!stops.length) return;
    for (const l of map.getStyle().layers) if (l.type === 'symbol' && l.layout?.['text-field'] && l.id !== 'stop-labels') map.setLayoutProperty(l.id, 'text-field', labelExpr());
    if (at != null) show(at); else overview();
  });
  document.addEventListener('keydown', (e) => {
    if (AzadViewer.isOpen || at == null || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
    if (e.key === 'Escape') overview();
  });
})();
