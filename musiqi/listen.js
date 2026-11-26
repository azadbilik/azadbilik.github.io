// «Listen elsewhere» block of a person on the music pages, standalone (the pages with and without ui.js use it):
//   await MQL.load();  MQL.block(qid)  -> HTML (Apple Music + Spotify link-outs, up to 3 30-second Apple Music previews, the Apple Music catalogue's recordings)
// Data: data/apple.json (scripts/apple.mjs: iTunes Search API, link-outs and previewUrl only, nothing of the audio is stored), data/spotify.json (Wikidata P1902, P2205).
// Previews stream straight from Apple (previewUrl) and each one links back to its track on Apple Music. They are separate from the public-domain recordings the pages play.
(() => {
const LANGS = ['az', 'ru', 'en'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const T = {
  az: { apple: 'Apple Music', spotify: 'Spotify', pv: '30 saniyəlik dinləmə', pvNote: 'Apple Music-dən ötürülür; tam yazı Apple Music-dədir.', onApple: 'Apple Music-də', rec: 'Yazılar', recNote: 'Apple Music kataloqundan. İl, kataloqdakı nəşrin çıxdığı ildir (köhnə yazının yenidən buraxılışı ola bilər), yazıldığı il deyil.', noPv: 'Dinləmə yüklənmədi', more: (n) => `… və daha ${n}`, listen: 'Dinlə', album: 'albom' },
  ru: { apple: 'Apple Music', spotify: 'Spotify', pv: '30-секундный фрагмент', pvNote: 'Идёт напрямую с Apple Music; полная запись — в Apple Music.', onApple: 'В Apple Music', rec: 'Записи', recNote: 'Из каталога Apple Music. Год — год выхода издания в каталоге (это может быть переиздание старой записи), а не год записи.', noPv: 'Фрагмент не загрузился', more: (n) => `… и ещё ${n}`, listen: 'Слушать', album: 'альбом' },
  en: { apple: 'Apple Music', spotify: 'Spotify', pv: '30-second preview', pvNote: 'Streamed from Apple Music; the full recording is on Apple Music.', onApple: 'On Apple Music', rec: 'Recordings', recNote: 'From the Apple Music catalogue. The year is the release date of the edition in the catalogue (often a reissue of an older recording), not the year it was recorded.', noPv: 'Preview did not load', more: (n) => `… and ${n} more`, listen: 'Listen', album: 'album' },
};
const lang = () => { const l = document.documentElement.lang; return LANGS.includes(l) ? l : 'az'; };
const t = (k, ...a) => { const v = (T[lang()] ?? T.az)[k] ?? T.az[k]; return typeof v === 'function' ? v(...a) : v; };
const MQL = window.MQL = { A: {}, S: {}, T };
MQL.load = () => Promise.all([fetch('/musiqi/data/apple.json').then((r) => r.json()).then((d) => { MQL.A = d.people ?? {}; }), fetch('/musiqi/data/spotify.json').then((r) => r.json()).then((d) => { MQL.S = d; })].map((p) => p.catch(() => {})));
const spotUrl = (s) => s?.a ? `https://open.spotify.com/artist/${encodeURIComponent(s.a)}` : '';
// the artist's own links
MQL.links = (q) => {
  const a = MQL.A[q], s = MQL.S[q]; if (!a && !s?.a) return '';
  return [a ? `<a class="lsn-l" href="${esc(a.url)}" rel="noopener">${t('apple')}</a>` : '', s?.a ? `<a class="lsn-l" href="${esc(spotUrl(s))}" rel="noopener">${t('spotify')}</a>` : ''].filter(Boolean).join(' · ');
};
MQL.previews = (q) => {
  const a = MQL.A[q]; if (!a?.pv?.length) return '';
  return `<div class="lsn-pvs"><div class="lsn-h"><span class="lsn-mark">${t('apple')}</span> ${esc(t('pv'))}</div>${a.pv.map((p) => `<div class="lsn-pv"><div class="lsn-tt"><b>${esc(p.t)}</b>${p.a ? ` <span class="lsn-sub">${esc(p.a)}</span>` : ''}</div><audio controls preload="none" src="${esc(p.u)}" aria-label="${esc(p.t)} · ${esc(t('pv'))}"></audio><div class="lsn-from"><span class="lsn-mark">${t('apple')}</span><a href="${esc(p.l)}" rel="noopener">${esc(t('onApple'))} ↗</a></div></div>`).join('')}<p class="lsn-note">${esc(t('pvNote'))}</p></div>`;
};
MQL.recs = (q) => {
  const a = MQL.A[q]; if (!a?.rec?.length) return '';
  const N = 12, show = a.rec.slice(0, N), rest = a.rec.slice(N);
  const li = (r) => `<li><a href="${esc(r[2])}" rel="noopener">${esc(r[0])}</a> <span class="lsn-sub">${esc(r[1])}</span></li>`;
  return `<details class="lsn-rec"><summary>${esc(t('rec'))} · ${a.rec.length}${a.more ? '+' : ''} <span class="lsn-mark">${t('apple')}</span></summary><ul>${a.rec.map(li).join('')}</ul><p class="lsn-note">${esc(t('recNote'))}</p></details>`;
};
MQL.block = (q) => {
  const l = MQL.links(q); if (!l) return '';
  return `<div class="lsn" data-q="${esc(q)}"><div class="lsn-links">${l}</div>${MQL.previews(q)}${MQL.recs(q)}</div>`;
};
// one preview at a time; a preview that cannot load says so
document.addEventListener('play', (e) => { if (!(e.target instanceof HTMLAudioElement)) return; document.querySelectorAll('audio').forEach((x) => { if (x !== e.target && !x.paused) x.pause(); }); }, true);
document.addEventListener('error', (e) => { const x = e.target; if (x instanceof HTMLAudioElement && x.closest('.lsn-pv') && !x.nextElementSibling?.classList.contains('lsn-err')) x.insertAdjacentHTML('afterend', `<div class="lsn-err">${esc(t('noPv'))}</div>`); }, true);
const css = document.createElement('style');
css.textContent = `.lsn{margin-top:.9rem;padding-top:.7rem;border-top:1px solid var(--rule,var(--line,#8884));font-size:.875rem;display:grid;gap:.6rem}
.lsn-links{display:flex;flex-wrap:wrap;gap:.25rem .6rem}.lsn-l{display:inline-flex;align-items:center;min-height:2rem;font-weight:600}
.lsn-h{font-size:.75rem;color:var(--muted,#777);margin-bottom:.2rem}.lsn-pv{display:grid;gap:.15rem;margin-bottom:.55rem}.lsn-pv audio{width:100%;max-width:22rem;height:2rem}
.lsn-mark{display:inline-block;font-size:.6875rem;line-height:1.35;padding:0 .4rem;border:1px solid var(--rule,var(--line,#8884));border-radius:999px;color:var(--muted,#777);white-space:nowrap}
.lsn-sub{color:var(--muted,#777);font-size:.8125rem}.lsn-from{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;font-size:.8125rem}.lsn-from a{display:inline-flex;align-items:center;min-height:1.75rem}
.lsn-note{color:var(--muted,#777);font-size:.75rem;max-width:44rem;margin:.2rem 0 0}.lsn-err{color:var(--accent,#a33);font-size:.8125rem}
.lsn-rec summary{cursor:pointer;min-height:2rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}.lsn-rec ul{list-style:none;margin:.3rem 0 0;padding:0;display:grid;gap:.1rem;max-height:18rem;overflow:auto}.lsn-rec li{overflow-wrap:anywhere}`;
document.head.appendChild(css);
})();
