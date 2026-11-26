// Search on every page of azadbilik.org, loaded by shared/theme.js. A button (or "/", Ctrl/⌘ K) opens a panel:
// empty, it lists the sections and every map, so a map's panel leads anywhere on the site; typed, it finds
// pages, authors, musicians, poets, districts, rivers, khanates and gallery scenes (shared/search.json, built by
// scripts/search-index.mjs), and offers the same words to the library's own search. It also puts a line under
// each map or data page: where its data can be downloaded and how to cite it.
(() => {
  const root = document.documentElement;
  const lang = () => (['az', 'ru', 'en'].includes(root.lang) ? root.lang : 'az');
  const LI = { az: 0, ru: 1, en: 2 };
  const T = {
    az: { open: 'Axtar', ph: 'Müəllif, musiqiçi, yer, çay, səhnə…', sections: 'Bölmələr', maps: 'Xəritələr və səhifələr', none: 'Heç nə tapılmadı.', kx: (q) => `«${q}» kitabxana.az-da`, close: 'Bağla', page: 'Səhifələr', author: 'Müəlliflər', musician: 'Musiqiçilər', poet: 'Nəzirə şairləri', place: 'Rayonlar və şəhristanlar', river: 'Çaylar', khanate: 'Xanlıqlar', scene: 'Miniatür səhnələri', doc: 'Arxiv', data: 'Məlumatlar', cite: 'İstinad', copy: 'köçür', copied: 'köçürüldü', hint: '↑↓ seç · Enter aç · Esc bağla' },
    ru: { open: 'Поиск', ph: 'Автор, музыкант, место, река, сцена…', sections: 'Разделы', maps: 'Карты и страницы', none: 'Ничего не найдено.', kx: (q) => `«${q}» на kitabxana.az`, close: 'Закрыть', page: 'Страницы', author: 'Авторы', musician: 'Музыканты', poet: 'Поэты назира', place: 'Районы и шахрестаны', river: 'Реки', khanate: 'Ханства', scene: 'Сцены миниатюр', doc: 'Архив', data: 'Данные', cite: 'Ссылка', copy: 'копировать', copied: 'скопировано', hint: '↑↓ выбор · Enter открыть · Esc закрыть' },
    en: { open: 'Search', ph: 'Author, musician, place, river, scene…', sections: 'Sections', maps: 'Maps and pages', none: 'Nothing found.', kx: (q) => `“${q}” on kitabxana.az`, close: 'Close', page: 'Pages', author: 'Authors', musician: 'Musicians', poet: 'Poets of the nəzirə network', place: 'Districts and shahrestans', river: 'Rivers', khanate: 'Khanates', scene: 'Miniature scenes', doc: 'Archive', data: 'Data', cite: 'Cite', copy: 'copy', copied: 'copied', hint: '↑↓ choose · Enter open · Esc close' },
  };
  const t = (k) => T[lang()][k];
  const SECTIONS = ['https://kitabxana.az', '/qalereya/', '/qalereya/tarix/', '/xeriteler/', '/atlas/', '/musiqi/', '/sebeke/', 'https://github.com/azadbilik/data'];
  const KINDS = ['page', 'author', 'musician', 'poet', 'place', 'river', 'khanate', 'scene', 'doc'];
  const DOI = '10.5281/zenodo.24543369';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fold = (s) => String(s ?? '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[«»"“”'’]/g, '');
  // a link in the reader's language: ?lang= on our pages, a prefix on the library
  const href = (u) => {
    const l = lang();
    if (u.startsWith('https://kitabxana.az')) return l === 'az' ? u : u.replace('https://kitabxana.az', `https://kitabxana.az/${l}`);
    if (!u.startsWith('/') || l === 'az') return u;
    const x = new URL(u, location.origin); x.searchParams.set('lang', l); return x.pathname + x.search + x.hash;
  };

  let index = null, loading = null;
  const load = () => loading ??= fetch('/shared/search.json').then((r) => r.json()).then((d) => {
    for (const x of [...d.pages, ...d.items]) { x.f = x.n.map(fold).join(' '); x.g = (x.s ?? []).map(fold).join(' '); }
    index = d; return d;
  });

  const style = document.createElement('style');
  style.textContent = `
  .ab-search-btn { display: inline-grid; place-items: center; min-width: 1.75rem; min-height: 1.75rem; padding: 0; margin-right: .1rem; border: 0; border-radius: 2px; background: none; color: inherit; opacity: .75; cursor: pointer; }
  .ab-search-btn:hover { opacity: 1; }
  .ab-search-btn svg { width: .95rem; height: .95rem; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
  header.hub-header .langs .ab-search-btn { min-width: 2rem; min-height: 2rem; }
  @media (max-width: 40rem) { header.hub-header .langs .ab-search-btn { min-width: 2.25rem; min-height: 2.25rem; } }
  dialog.ab-search { width: min(40rem, calc(100vw - 2rem)); max-height: min(38rem, calc(100svh - 4rem)); margin: 8svh auto auto; padding: 0; border: 1px solid var(--rule); border-radius: 6px;
    background: var(--paper); color: var(--ink); box-shadow: 0 20px 60px rgb(0 0 0 / .25); font: 400 .9375rem/1.45 var(--sans, 'Inter', system-ui, sans-serif); overflow: hidden; }
  dialog.ab-search[open] { display: flex; flex-direction: column; }
  dialog.ab-search::backdrop { background: rgb(10 8 6 / .45); backdrop-filter: blur(2px); }
  .ab-search .bar { display: flex; align-items: center; gap: .6rem; padding: .85rem 1rem; border-bottom: 1px solid var(--rule); }
  .ab-search .bar svg { width: 1.05rem; height: 1.05rem; flex: none; fill: none; stroke: var(--muted); stroke-width: 1.7; stroke-linecap: round; }
  .ab-search input { flex: 1; min-width: 0; font: inherit; font-size: 1.0625rem; color: var(--ink); background: none; border: 0; outline: none; }
  .ab-search input::placeholder { color: var(--muted); }
  .ab-search input::-webkit-search-cancel-button { display: none; }
  .ab-search .x { font: inherit; font-size: .75rem; color: var(--muted); background: none; border: 1px solid var(--rule); border-radius: 3px; padding: .15rem .45rem; cursor: pointer; }
  .ab-search .res { overflow-y: auto; padding: .35rem 0 .6rem; overscroll-behavior: contain; }
  .ab-search h3 { margin: .7rem 1rem .25rem; font: 500 .6875rem var(--sans, 'Inter', sans-serif); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .ab-search ul { list-style: none; margin: 0; padding: 0; }
  .ab-search a.r { display: grid; grid-template-columns: 1fr auto; gap: 0 1rem; padding: .5rem 1rem; color: inherit; text-decoration: none; }
  .ab-search a.r .n { font-weight: 500; }
  .ab-search a.r .s { grid-column: 1; font-size: .8125rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ab-search a.r .go { grid-row: 1 / 3; grid-column: 2; align-self: center; color: var(--muted); font-size: .875rem; }
  .ab-search a.r[aria-selected="true"], .ab-search a.r:hover { background: color-mix(in srgb, var(--ink) 6%, transparent); }
  .ab-search a.r[aria-selected="true"] .go { color: var(--accent); }
  .ab-search mark { background: none; color: var(--accent); }
  .ab-search .none { padding: 1rem; color: var(--muted); }
  .ab-search .foot { padding: .5rem 1rem; border-top: 1px solid var(--rule); font-size: .75rem; color: var(--muted); }
  @media (max-width: 40rem) { dialog.ab-search { width: 100vw; max-width: none; height: 100svh; max-height: none; margin: 0; border: 0; border-radius: 0; } .ab-search .foot { display: none; } }
  .ab-data { margin: 1rem 1.5rem 1.25rem; padding-top: .75rem; border-top: 1px solid var(--rule); font-size: .75rem; line-height: 1.5; color: var(--muted); }
  footer .ab-data { margin: .75rem 0 0; padding-top: 0; border-top: 0; flex-basis: 100%; }
  .ab-data a { color: inherit; }
  .ab-data button { font: inherit; color: var(--accent); background: none; border: 0; padding: 0 .2rem; cursor: pointer; }`;
  document.head.appendChild(style);

  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20 20"/></svg>';
  let dlg, input, res, sel = 0, links = [];

  function mark(text, q) {
    if (!q) return esc(text);
    const f = fold(text), i = f.indexOf(q);
    if (i < 0 || f.length !== text.length) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }
  const row = (x, q) => {
    const l = LI[lang()], n = x.n[l] || x.n[0], s = x.s?.[l] || x.s?.[0] || '';
    const ext = !x.u.startsWith('/');
    return `<li><a class="r" href="${esc(href(x.u))}"${ext ? ' target="_blank" rel="noopener"' : ''}><span class="n">${mark(n, q)}</span><span class="s">${esc(s)}</span><span class="go">${ext ? '↗' : '→'}</span></a></li>`;
  };
  function draw() {
    if (!index) { res.innerHTML = ''; load().then(draw); return; }
    const q = fold(input.value.trim());
    let html = '';
    if (!q) {
      const sec = SECTIONS.map((u) => index.pages.find((p) => p.u === u)).filter(Boolean);
      const rest = index.pages.filter((p) => !SECTIONS.includes(p.u) && p.u !== '/');
      html = `<h3>${t('sections')}</h3><ul>${sec.map((p) => row(p)).join('')}</ul><h3>${t('maps')}</h3><ul>${rest.map((p) => row(p)).join('')}</ul>`;
    } else {
      // whole words first, then the start of a word, then anywhere
      const at = (f) => { const i = f.indexOf(q); if (i < 0) return 0; return (i === 0 || f[i - 1] === ' ') ? (f.slice(i + q.length, i + q.length + 1).match(/[a-z0-9]/) ? 2 : 3) : 1; };
      // the name first; else the line under it (a birthplace, the poem a scene is from), ranked below every name
      const score = (x) => at(x.f) || (x.k === 'page' ? 0 : at(x.g) / 10);
      const groups = KINDS.map((k) => {
        const pool = k === 'page' ? index.pages : index.items.filter((i) => i.k === k);
        const scored = pool.map((x) => [x, score(x)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || a[0].n[0].localeCompare(b[0].n[0], 'az'));
        return [k, scored.slice(0, 8).map(([x]) => x), scored[0]?.[1] ?? 0];
      }).filter(([, h]) => h.length).sort((a, b) => b[2] - a[2]);   // what matches by name above what matches by place
      html = groups.map(([k, h]) => `<h3>${t(k)}</h3><ul>${h.map((x) => row(x, q)).join('')}</ul>`).join('') || `<p class="none">${t('none')}</p>`;
      const kq = encodeURIComponent(input.value.trim());
      html += `<h3>Kitabxana</h3><ul>${row({ u: `https://kitabxana.az/search?q=${kq}`, n: [t('kx')(input.value.trim()), t('kx')(input.value.trim()), t('kx')(input.value.trim())], s: ['', '', ''] })}</ul>`;
    }
    res.innerHTML = html;
    links = [...res.querySelectorAll('a.r')];
    sel = 0; mark0();
  }
  function mark0() { links.forEach((a, i) => a.setAttribute('aria-selected', i === sel)); links[sel]?.scrollIntoView({ block: 'nearest' }); }
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'ab-search';
    dlg.innerHTML = `<div class="bar">${ICON}<input type="search" autocomplete="off" spellcheck="false"><button type="button" class="x"></button></div><div class="res" role="listbox"></div><div class="foot"></div>`;
    document.body.appendChild(dlg);
    input = dlg.querySelector('input'); res = dlg.querySelector('.res');
    input.oninput = draw;
    dlg.querySelector('.x').onclick = () => dlg.close();
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(links.length - 1, sel + 1); mark0(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); mark0(); }
      else if (e.key === 'Enter' && links[sel] && document.activeElement === input) { e.preventDefault(); links[sel].click(); }
    });
  }
  function open() {
    if (!dlg) build();
    input.placeholder = t('ph'); input.setAttribute('aria-label', t('open'));
    dlg.querySelector('.x').textContent = `${t('close')} Esc`;
    dlg.querySelector('.foot').textContent = t('hint');
    if (!dlg.open) dlg.showModal();
    input.select(); draw();
  }

  function mount() {
    for (const langs of document.querySelectorAll('.langs')) {
      if (langs.querySelector('.ab-search-btn')) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ab-search-btn'; b.innerHTML = ICON;
      const label = () => { b.setAttribute('aria-label', t('open')); b.title = `${t('open')} (/)`; };
      label(); new MutationObserver(label).observe(root, { attributes: true, attributeFilter: ['lang'] });
      b.onclick = open;
      langs.prepend(b);
    }
    addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); open(); }
    });
    dataLine();
  }

  // Under a map's panel (or in a page's footer): its data and how to cite it
  function dataLine() {
    load().then((d) => {
      const path = location.pathname.replace(/index\.html$/, '');
      const page = d.pages.find((p) => p.u === path);
      if (!page?.d) return;
      const host = document.querySelector('.panel .body') ?? document.querySelector('.panel') ?? document.querySelector('body > footer, .wrap > footer, footer');
      if (!host || host.querySelector('.ab-data')) return;
      const el = document.createElement('p');
      el.className = 'ab-data';
      host.appendChild(el);
      const draw1 = () => {
        const l = LI[lang()];
        const cite = `Azad Bilik, «${page.n[l] || page.n[0]}», https://azadbilik.org${path} (${new Date().getFullYear()}). DOI ${DOI}`;
        el.innerHTML = `<a href="${esc(page.d)}" target="_blank" rel="noopener">${t('data')} ↗</a> · ${t('cite')}: ${esc(cite)} <button type="button">${t('copy')}</button>`;
        el.querySelector('button').onclick = async (e) => { try { await navigator.clipboard.writeText(cite); e.target.textContent = t('copied'); } catch {} };
      };
      draw1(); new MutationObserver(draw1).observe(root, { attributes: true, attributeFilter: ['lang'] });
    }).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
