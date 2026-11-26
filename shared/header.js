// The hub's header, written once (/shared/header.js). A page puts, as the first thing in <body>:
//   <header class="hub-header"></header><script src="/shared/header.js"></script>
// and this fills it at once, before the page's own scripts run, so they find the language buttons
// (.langs [data-lang]), the section links ([data-keep-lang]) and #kx as before. The section the page is
// in gets aria-current (the longest matching path, so /sebeke/elm/ marks Şəbəkələr). Styles: hub.css.
// To add or rename a section, edit SECTIONS here: every page follows.
(() => {
  const SECTIONS = [
    ['https://kitabxana.az', 'Kitabxana', 'Библиотека', 'Library'],
    ['/qalereya/', 'Qalereya', 'Галерея', 'Gallery'],
    ['/xeriteler/', 'Ədəbi xəritələr', 'Литературные карты', 'Literary maps'],
    ['/atlas/', 'Atlas', 'Атлас', 'Atlas'],
    ['/musiqi/', 'Musiqi', 'Музыка', 'Music'],
    ['/sebeke/', 'Şəbəkələr', 'Сети', 'Networks'],
    ['/arxiv/', 'Arxiv', 'Архив', 'Archive'],
  ];
  const el = document.currentScript?.previousElementSibling;
  const h = el?.matches?.('header.hub-header') ? el : document.querySelector('header.hub-header');
  if (!h) return;
  const lang = ['ru', 'en'].includes(document.documentElement.lang) ? document.documentElement.lang : 'az';
  const here = SECTIONS.map((s) => s[0]).filter((u) => u.startsWith('/') && location.pathname.startsWith(u)).sort((a, b) => b.length - a.length)[0];
  const href = (u) => !u.startsWith('/') ? (u + (lang === 'az' ? '' : `/${lang}`)) : (u + (lang === 'az' ? '' : `?lang=${lang}`));
  const names = (s) => `<span data-l="az">${s[1]}</span><span data-l="ru">${s[2]}</span><span data-l="en">${s[3]}</span>`;
  h.setAttribute('aria-label', 'Azad Bilik');
  h.innerHTML =
    `<a class="brand" href="${href('/')}" data-keep-lang><svg viewBox="0 0 512 512" aria-hidden="true"><g class="star"><rect x="126" y="126" width="260" height="260"/><polygon points="256,72 440,256 256,440 72,256"/></g><polygon class="gem" points="256,196 316,256 256,316 196,256"/></svg>Azad Bilik</a>` +
    `<nav aria-label="Azad Bilik">` +
    SECTIONS.map((s) => s[0].startsWith('/')
      ? `<a href="${href(s[0])}" data-keep-lang${s[0] === here ? ' aria-current="page"' : ''}>${names(s)}</a>`
      : `<a href="${href(s[0])}" id="kx">${names(s)}</a>`).join('') +
    `<span class="langs" role="group" aria-label="Dil · Язык · Language"><button type="button" data-lang="az">AZ</button><button type="button" data-lang="ru">RU</button><button type="button" data-lang="en">EN</button></span></nav>`;
  h.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === lang));
})();
