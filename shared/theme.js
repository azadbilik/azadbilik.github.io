// Light or dark: the reader's choice (localStorage.theme, shared by every page on azadbilik.org),
// else the system's. Loaded in <head> before the styles, so the page paints in the right one.
// Pages write their dark colours twice: under prefers-color-scheme for :root:not([data-theme="light"]),
// and for [data-theme="dark"]. A switch (moon / sun) goes in front of the language buttons.
// Maps change in place: every maplibregl.Map is tracked as it is made; on a switch its base tiles are
// swapped (positron <-> dark) under the page's own sources and layers, whose colours are mapped from the
// old theme's to the new (the page's CSS variables, and the `dark ? 'a' : 'b'` pairs in its scripts).
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : sys.matches;
  const maps = [];
  window.abTheme = { dark, maps };

  const style = document.createElement('style');
  style.textContent = `:root[data-theme="light"] { color-scheme: light; } :root[data-theme="dark"] { color-scheme: dark; }
  .theme-toggle { display: inline-grid; place-items: center; min-width: 1.75rem; min-height: 1.75rem; padding: 0; margin-right: .2rem; border: 0; border-radius: 2px; background: none; color: inherit; opacity: .75; cursor: pointer; }
  .theme-toggle:hover { opacity: 1; }
  .theme-toggle svg { width: .95rem; height: .95rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }`;
  document.head.appendChild(style);

  // ---- Maps
  let ML;
  Object.defineProperty(window, 'maplibregl', { configurable: true, get: () => ML, set(v) {
    ML = v;
    try {
      if (v?.Map && !v.Map.abTracked) {
        const Base = v.Map;
        const Tracked = class extends Base { constructor(o) { super(o); track(this, o); } };
        Tracked.abTracked = true;
        v.Map = Tracked;
      }
    } catch {}
  } });
  function track(m, o) {
    const a = m.abTheme = { url: typeof o?.style === 'string' ? o.style : null, base: null, baseSrc: null, images: new Map() };
    m.once('style.load', () => { const st = m.getStyle(); a.base = new Set(st.layers.map((l) => l.id)); a.baseSrc = new Set(Object.keys(st.sources)); });
    // The page's own images (arrow heads, patterns) are dropped with a style: keep them to give back
    const add = m.addImage.bind(m);
    m.addImage = (name, img, opts) => { a.images.set(name, [img, opts]); return add(name, img, opts); };
    m.on('styleimagemissing', (e) => { const im = a.images.get(e.id); if (im && !m.hasImage(e.id)) add(e.id, ...im); });
    maps.push(m);
  }
  const VARS = ['--paper', '--ink', '--muted', '--rule', '--frame', '--accent', '--second', '--third', '--fourth', '--panel', '--water', '--land'];
  // ...and every variable the page itself defines (a page's own palette: --e0, --c3, --sky …)
  const pageVars = () => { const set = new Set(VARS); for (const st of document.querySelectorAll('style')) for (const m of st.textContent.matchAll(/(--[a-z0-9-]+)\s*:/gi)) set.add(m[1]); return [...set]; };
  const snap = (vars) => { const cs = getComputedStyle(root); return vars.map((v) => cs.getPropertyValue(v).trim()); };
  // `dark ? 'x' : 'y'` in the page's scripts: colours chosen once for the theme the page started in
  function scriptPairs() {
    const out = [];
    for (const sc of document.querySelectorAll('script:not([src])'))
      for (const m of sc.textContent.matchAll(/\bdark\s*\?\s*(['"])([^'"]+)\1\s*:\s*(['"])([^'"]+)\3/g)) out.push([m[2], m[4]]);
    for (const sc of document.querySelectorAll('script:not([src])'))
      for (const m of sc.textContent.matchAll(/\bdark\s*\?\s*\[([^\]]*)\]\s*:\s*\[([^\]]*)\]/g)) {
        const q = (x) => [...x.matchAll(/(['"])([^'"]+)\1/g)].map((y) => y[2]), d = q(m[1]), l = q(m[2]);
        d.forEach((c, i) => { if (l[i]) out.push([c, l[i]]); });
      }
    return out;
  }
  const recolor = (v, swap) => typeof v === 'string' ? (swap.get(v) ?? v) : Array.isArray(v) ? v.map((x) => recolor(x, swap)) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, recolor(x, swap)])) : v;
  function restyle(m, swap, next) {
    const a = m.abTheme;
    if (!a?.url || !a.base) return;
    // Feature states (a district's colour for the year on show, the one selected) go with the old
    // style: read them from MapLibre's source caches and set them again on the new one
    const states = {};
    for (const id of a.baseSrc ? Object.keys(m.getStyle().sources).filter((k) => !a.baseSrc.has(k)) : []) {
      const st = m.style?.sourceCaches?.[id]?._state?.state;
      if (st) states[id] = JSON.parse(JSON.stringify(st));
    }
    m.once('style.load', () => {
      for (const [source, byLayer] of Object.entries(states))
        for (const [layer, feats] of Object.entries(byLayer))
          for (const [id, st] of Object.entries(feats)) {
            const f = layer === '_geojsonTileLayer' ? { source, id } : { source, sourceLayer: layer, id };
            try { m.setFeatureState(f, recolor(st, swap)); } catch {}
          }
    });
    const url = a.url.replace(/\/styles\/(dark|positron)\b/, `/styles/${next === 'dark' ? 'dark' : 'positron'}`);
    a.url = url;
    m.setStyle(url, { diff: false, transformStyle: (prev, nxt) => {
      if (!prev) return nxt;
      const own = Object.fromEntries(Object.entries(prev.sources).filter(([k]) => !a.baseSrc.has(k)));
      const layers = nxt.layers.slice(), mine = new Set();
      let anchor = null;
      for (const l of prev.layers) {
        if (a.base.has(l.id)) { anchor = l.id; continue; }
        const copy = { ...l };
        if (l.paint) copy.paint = recolor(l.paint, swap);
        // after the base layer it followed (so it stays under the labels), else on top
        let at = anchor ? layers.findIndex((x) => x.id === anchor) + 1 : 0;
        if (anchor && at === 0) at = layers.length;
        while (at < layers.length && mine.has(layers[at].id)) at++;
        layers.splice(at, 0, copy); mine.add(copy.id);
      }
      a.base = new Set(nxt.layers.map((l) => l.id)); a.baseSrc = new Set(Object.keys(nxt.sources));
      return { ...nxt, sources: { ...nxt.sources, ...own }, layers };
    } });
  }

  const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
  const LABEL = { az: ['Qaranlıq görünüş', 'İşıqlı görünüş'], ru: ['Тёмная тема', 'Светлая тема'], en: ['Dark theme', 'Light theme'] };
  const metas = () => document.querySelectorAll('meta[name="theme-color"]');
  const paintMeta = () => {
    if (!root.dataset.theme) return;
    const bg = getComputedStyle(document.body || root).backgroundColor;
    metas().forEach((m) => { m.content = bg; m.removeAttribute('media'); });
  };

  function mount() {
    const langs = document.querySelector('.langs');
    if (!langs || document.querySelector('.theme-toggle')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-toggle';
    const draw = () => {
      const d = dark(), l = LABEL[root.lang] || LABEL.az;
      b.innerHTML = d ? SUN : MOON;
      b.setAttribute('aria-label', d ? l[1] : l[0]);
      b.title = d ? l[1] : l[0];
    };
    b.onclick = () => {
      const next = dark() ? 'light' : 'dark';
      const vars = pageVars(), before = snap(vars);
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      const after = snap(vars), swap = new Map();
      before.forEach((c, i) => { if (c && c !== after[i]) swap.set(c, after[i]); });
      for (const [d, l] of scriptPairs()) { if (next === 'dark') swap.set(l, d); else swap.set(d, l); }
      draw(); paintMeta();
      dispatchEvent(new CustomEvent('themechange', { detail: next }));
      for (const m of maps) try { restyle(m, swap, next); } catch (e) { console.warn('theme: map restyle failed', e); }
    };
    langs.prepend(b);
    draw(); paintMeta();
    new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['lang'] });
    sys.addEventListener('change', draw);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
// The site's search (and a map page's data line) come with the theme script, so every page has them
(() => { if (document.querySelector('script[src="/shared/hub.js"]')) return; const s = document.createElement('script'); s.src = '/shared/hub.js'; s.async = true; document.head.appendChild(s); })();
