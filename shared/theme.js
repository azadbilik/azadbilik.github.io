// Light or dark: the reader's choice (localStorage.theme, shared by every page on azadbilik.org),
// else the system's. Loaded in <head> before the styles, so the page paints in the right one.
// Pages write their dark colours twice: under prefers-color-scheme for :root:not([data-theme="light"]),
// and for [data-theme="dark"]. A switch (moon / sun) goes in front of the language buttons.
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch {}
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  const sys = matchMedia('(prefers-color-scheme: dark)');
  const dark = () => root.dataset.theme ? root.dataset.theme === 'dark' : sys.matches;
  window.abTheme = { dark };

  const style = document.createElement('style');
  style.textContent = `:root[data-theme="light"] { color-scheme: light; } :root[data-theme="dark"] { color-scheme: dark; }
  .theme-toggle { display: inline-grid; place-items: center; min-width: 1.75rem; min-height: 1.75rem; padding: 0; margin-right: .2rem; border: 0; border-radius: 2px; background: none; color: inherit; opacity: .75; cursor: pointer; }
  .theme-toggle:hover { opacity: 1; }
  .theme-toggle svg { width: .95rem; height: .95rem; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }`;
  document.head.appendChild(style);

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
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      draw(); paintMeta();
      dispatchEvent(new CustomEvent('themechange', { detail: next }));
      // A map's tiles and colours are chosen when it starts: start it again
      if (document.querySelector('.maplibregl-map')) location.reload();
    };
    langs.prepend(b);
    draw(); paintMeta();
    new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ['lang'] });
    sys.addEventListener('change', draw);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
