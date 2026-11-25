// The hub's picture viewer, shared by the maps (/shared/viewer.js): a miniature in a dialog over
// the page, its neighbours a click or an arrow key away. The thumbnail shows at once, softened,
// until the full image has loaded. It brings its own markup and styles, which follow the page's
// colour tokens (--paper, --ink, --muted, --rule, --frame, --accent, --serif).
//
//   AzadViewer.open(list, index, {
//     src: (x) => thumbnail URL,  full: (x) => the screen-sized image,  alt: (x) => text,
//     fallback: (x) => URL to try when `full` fails (the original),
//     info: (x, i, n) => HTML beside the picture (title, dates, links),
//     labels: { close, prev, next, loading },
//   })
(() => {
  const css = `
  dialog.azv { margin: auto; border: 0; padding: 0; width: min(64rem, 100vw); height: min(46rem, 100svh); max-width: 100vw; max-height: 100svh; background: var(--paper); color: var(--ink); border-radius: 4px; }
  dialog.azv::backdrop { background: rgb(0 0 0 / .6); }
  .azv-body { display: grid; grid-template-columns: 1fr 18rem; height: 100%; }
  .azv-stage { position: relative; background: var(--frame); min-height: 0; }
  .azv-stage img { position: absolute; inset: 1.5rem 3.75rem; width: calc(100% - 7.5rem); height: calc(100% - 3rem); object-fit: contain; transition: filter .3s; }
  .azv-stage.busy img { filter: blur(2px); }
  /* While the image loads: a spinner and a word, after a moment (a cached image needs neither) */
  .azv-load { position: absolute; left: 50%; top: 50%; translate: -50% -50%; display: flex; align-items: center; gap: .6rem; padding: .55rem .9rem; border-radius: 999px; background: var(--paper); color: var(--ink); font-size: .8125rem; box-shadow: 0 2px 12px rgb(0 0 0 / .2); opacity: 0; transition: opacity .2s; pointer-events: none; }
  .azv-stage.busy .azv-load { opacity: 1; transition-delay: .25s; }
  .azv-load i { width: 1rem; height: 1rem; border-radius: 50%; border: 2px solid var(--rule); border-top-color: var(--accent); animation: azv-spin .8s linear infinite; }
  @keyframes azv-spin { to { transform: rotate(1turn); } }
  .azv-nav { position: absolute; top: 50%; translate: 0 -50%; width: 2.5rem; height: 2.5rem; border: 0; border-radius: 50%; background: var(--paper); color: var(--ink); box-shadow: 0 1px 6px rgb(0 0 0 / .15); display: grid; place-items: center; cursor: pointer; font: inherit; }
  .azv-prev { left: .75rem; } .azv-next { right: .75rem; }
  .azv-nav[disabled] { opacity: .3; cursor: default; }
  .azv-info { padding: 1.25rem 1.25rem 1.5rem; overflow-y: auto; border-left: 1px solid var(--rule); display: flex; flex-direction: column; gap: .75rem; font-size: .875rem; }
  .azv-close { align-self: flex-end; border: 0; background: none; color: var(--muted); font: inherit; font-size: .8125rem; cursor: pointer; }
  .azv-close:hover { color: var(--ink); }
  .azv-info h2 { font: 400 1.25rem/1.25 var(--serif, Georgia, serif); }
  .azv-info .m { color: var(--muted); }
  .azv-info a { font-weight: 500; text-decoration: none; } .azv-info a:hover { color: var(--accent); }
  .azv-pos { margin-top: auto; font-size: .75rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  @media (max-width: 48rem) {
    dialog.azv { height: 100svh; overflow-y: auto; border-radius: 0; }
    .azv-body { grid-template-columns: 1fr; grid-template-rows: 60svh auto; height: auto; min-height: 100%; }
    .azv-stage img { inset: .5rem; width: calc(100% - 1rem); height: calc(100% - 1rem); }
    .azv-nav { top: auto; bottom: .5rem; translate: none; }
    .azv-info { border-left: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .azv-stage img { transition: none; } .azv-load i { animation-duration: 2.4s; } }`;

  let dlg, img, stage, info, prev, next, closeBtn, list = [], at = 0, opts = {};

  function build() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    dlg = document.createElement('dialog');
    dlg.className = 'azv';
    dlg.innerHTML = `<div class="azv-body"><div class="azv-stage"><img alt=""><span class="azv-load" role="status"><i aria-hidden="true"></i><span></span></span><button type="button" class="azv-nav azv-prev">←</button><button type="button" class="azv-nav azv-next">→</button></div>
      <div class="azv-info"><button type="button" class="azv-close"></button><div class="azv-text"></div><p class="azv-pos"></p></div></div>`;
    document.body.append(dlg);
    stage = dlg.querySelector('.azv-stage');
    img = stage.querySelector('img');
    info = dlg.querySelector('.azv-text');
    prev = dlg.querySelector('.azv-prev');
    next = dlg.querySelector('.azv-next');
    closeBtn = dlg.querySelector('.azv-close');
    prev.onclick = () => go(at - 1);
    next.onclick = () => go(at + 1);
    closeBtn.onclick = () => dlg.close();
    // A click on the backdrop lands on the dialog itself
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      e.stopPropagation();
    });
  }

  function go(i) {
    if (i < 0 || i >= list.length) return;
    at = i;
    const x = list[i];
    img.src = opts.src(x);
    img.alt = opts.alt?.(x) ?? '';
    stage.classList.add('busy');
    const full = new Image();
    full.referrerPolicy = 'no-referrer';
    full.onload = () => { if (list[at] === x) { img.src = full.src; stage.classList.remove('busy'); } };
    // The screen-sized copy failing, the original is the next best
    const backup = opts.fallback?.(x);
    full.onerror = () => {
      if (list[at] !== x) return;
      if (backup && full.src !== backup) full.src = backup; else stage.classList.remove('busy');
    };
    full.src = opts.full(x) ?? backup;
    info.innerHTML = opts.info(x, i, list.length);
    dlg.querySelector('.azv-pos').textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    prev.disabled = i <= 0;
    next.disabled = i >= list.length - 1;
    prev.hidden = next.hidden = list.length < 2;
  }

  window.AzadViewer = {
    open(items, i, o) {
      if (!dlg) build();
      list = items; opts = o;
      img.referrerPolicy = 'no-referrer';
      const l = o.labels ?? {};
      closeBtn.textContent = `${l.close ?? 'Close'} ✕`;
      dlg.querySelector('.azv-load span').textContent = l.loading ?? 'Loading…';
      prev.setAttribute('aria-label', l.prev ?? 'Previous');
      next.setAttribute('aria-label', l.next ?? 'Next');
      dlg.setAttribute('aria-label', l.title ?? '');
      go(i);
      if (!dlg.open) dlg.showModal();
    },
    get isOpen() { return Boolean(dlg?.open); },
  };
})();
