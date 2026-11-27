<script>
  // The living reference of /shared/core.css: every token with its current value, and every component as it
  // renders. Switch the theme (top right) to see both. Copy the markup shown under each component.
  const COLOURS = [
    ['Surfaces', ['--paper', '--frame', '--raised', '--rule', '--hover']],
    ['Text', ['--ink', '--muted', '--accent', '--on-accent']],
    ['Series', ['--accent', '--second', '--third', '--fourth', '--fifth', '--sixth']],
    ['States', ['--ok', '--warn', '--bad', '--info']],
  ];
  const TYPE = [
    ['--t-3xl', 'serif', 300, 'Azad Bilik'],
    ['--t-2xl', 'serif', 300, 'Kür–Araz hövzəsi'],
    ['--t-xl', 'serif', 400, 'Nizami Gəncəvi'],
    ['--t-lg', 'serif', 400, 'Söz ehtiyatı: how many words each poet uses'],
    ['--t-md', 'sans', 400, 'Interface text, buttons and lists'],
    ['--t-sm', 'sans', 400, 'Controls, captions, table cells'],
    ['--t-xs', 'sans', 500, 'LABELS AND LOZENGES'],
  ];
  const SPACE = ['--s-1', '--s-2', '--s-3', '--s-4', '--s-5', '--s-6', '--s-7'];

  // Read the tokens' values as the browser resolves them, again whenever the theme changes
  let tick = $state(0);
  $effect(() => {
    const o = new MutationObserver(() => tick++);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => o.disconnect();
  });
  const value = (name) => (tick, getComputedStyle(document.documentElement).getPropertyValue(name).trim());

  let chip = $state('all');
  let tab = $state('one');
</script>

<div class="ui-stack design" style="--gap: var(--s-7)">
  <p class="ui-lede">
    One stylesheet, <span class="ui-code">/shared/core.css</span>: tokens, a minimal base and <span class="ui-code">ui-</span>
    components, all in cascade layers so a page's own CSS always wins. Link it after the fonts on every page.
  </p>

  <section class="section">
    <h2 class="ui-h">Colour</h2>
    {#each COLOURS as [group, names] (group)}
      <h3 class="ui-label">{group}</h3>
      <div class="ui-grid" style="--min: 8rem; --gap: var(--s-3)">
        {#each names as n (n)}
          <div class="ui-swatch" style="--c: var({n})"><i></i><b>{n}</b><span class="ui-muted ui-num">{value(n)}</span></div>
        {/each}
      </div>
    {/each}
  </section>

  <section class="section">
    <h2 class="ui-h">Type</h2>
    <p class="ui-muted">Literata for reading and titles, Inter for the interface.</p>
    <div class="ui-stack" style="--gap: var(--s-3)">
      {#each TYPE as [size, face, weight, text] (size)}
        <div class="type">
          <span class="ui-code">{size}</span>
          <span style="font: {weight} var({size})/1.2 var(--{face})">{text}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h2 class="ui-h">Space and shape</h2>
    <div class="ui-stack" style="--gap: var(--s-2)">
      {#each SPACE as s (s)}
        <div class="type"><span class="ui-code">{s}</span><i class="bar" style="width: var({s})"></i><span class="ui-muted">{value(s)}</span></div>
      {/each}
    </div>
    <div class="ui-row" style="--gap: var(--s-4)">
      {#each ['--r-1', '--r-2', '--r-3', '--r-pill'] as r (r)}
        <div class="shape" style="border-radius: var({r})">{r}</div>
      {/each}
      <div class="shape" style="box-shadow: var(--shadow-1)">--shadow-1</div>
      <div class="shape" style="box-shadow: var(--shadow-2)">--shadow-2</div>
    </div>
  </section>

  <section class="section">
    <h2 class="ui-h">Buttons and chips</h2>
    <div class="ui-row">
      <button class="ui-btn is-primary">Primary</button>
      <button class="ui-btn">Default</button>
      <button class="ui-btn is-ghost">Ghost</button>
      <button class="ui-btn is-danger">Delete</button>
      <button class="ui-btn" disabled>Disabled</button>
      <button class="ui-btn is-small">Small</button>
    </div>
    <pre class="ui-pre">&lt;button class="ui-btn is-primary"&gt;…&lt;/button&gt;   is-primary · is-ghost · is-danger · is-small</pre>
    <div class="ui-row">
      {#each [['all', 472], ['ashiks', 39], ['khanendes', 61], ['tar', 24]] as [k, n] (k)}
        <button class="ui-chip" aria-pressed={chip === k} onclick={() => (chip = k)}>{k} <span class="n">{n}</span></button>
      {/each}
    </div>
    <pre class="ui-pre">&lt;button class="ui-chip" aria-pressed="true"&gt;ashiks &lt;span class="n"&gt;39&lt;/span&gt;&lt;/button&gt;</pre>
  </section>

  <section class="section">
    <h2 class="ui-h">Status lozenges</h2>
    <div class="ui-row">
      <span class="ui-badge is-ok">Done</span>
      <span class="ui-badge is-warn">In progress</span>
      <span class="ui-badge is-bad">Failed</span>
      <span class="ui-badge is-info">Info</span>
      <span class="ui-badge">Not started</span>
      <span class="ui-badge is-ok is-dot">live</span>
    </div>
    <pre class="ui-pre">&lt;span class="ui-badge is-ok"&gt;Done&lt;/span&gt;   is-ok · is-warn · is-bad · is-info · is-dot</pre>
  </section>

  <section class="section">
    <h2 class="ui-h">Cards, stats, notes</h2>
    <div class="ui-grid" style="--min: 14rem">
      <a class="ui-card ui-stack" style="--gap: var(--s-2)" href="#design">
        <span class="ui-label">Atlas</span>
        <b class="ui-h">Əhali</b>
        <span class="ui-muted">Population by district, 1897 to 2019.</span>
      </a>
      <div class="ui-card ui-row" style="--gap: var(--s-6)">
        <div class="ui-stat"><b>1,815</b><span>villages placed</span></div>
        <div class="ui-stat"><b>577</b><span>approximate</span></div>
      </div>
    </div>
    <p class="ui-note">A note gives context. <span class="ui-code">.ui-note</span></p>
    <p class="ui-note is-warn">A warning: something to watch. <span class="ui-code">.ui-note.is-warn</span></p>
    <p class="ui-note is-bad">An error: don't do this. <span class="ui-code">.ui-note.is-bad</span></p>
  </section>

  <section class="section">
    <h2 class="ui-h">Fields</h2>
    <div class="ui-grid" style="--min: 14rem">
      <label class="ui-field"><span>Title (az)</span><input class="ui-input" value="Xəmsə" /><small>As printed on the title page</small></label>
      <label class="ui-field"><span>Holder</span><select class="ui-select"><option>prlib</option><option>rgb</option></select></label>
      <label class="ui-field"><span>Year</span><input class="ui-input ui-num" type="number" value="1845" /></label>
      <label class="ui-field"><span>Invalid</span><input class="ui-input" aria-invalid="true" value="18x5" /></label>
    </div>
    <label class="ui-field"><span>Note</span><textarea class="ui-textarea">Lithograph, Tehran.</textarea></label>
    <label class="ui-check"><input type="checkbox" checked /> Public domain</label>
  </section>

  <section class="section">
    <h2 class="ui-h">Table</h2>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead><tr><th>Census</th><th>Unit</th><th class="ui-num">Population</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>1897</td><td>Şuşa uezd</td><td class="ui-num">138,771</td><td><span class="ui-badge is-ok">matched</span></td></tr>
          <tr aria-selected="true"><td>1926</td><td>Qarabağ</td><td class="ui-num">—</td><td><span class="ui-badge is-warn">approximate</span></td></tr>
          <tr><td>1939</td><td>Kangarli</td><td class="ui-num">—</td><td><span class="ui-badge">no shape</span></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section">
    <h2 class="ui-h">Tabs and rows</h2>
    <div class="ui-tabs" role="tablist">
      {#each ['one', 'two', 'three'] as t (t)}
        <button role="tab" aria-selected={tab === t} onclick={() => (tab = t)}>Tab {t}</button>
      {/each}
    </div>
    <ul class="ui-rows">
      <li><a href="#design"><b>Ədəbi xəritə</b><span>Where 318 poets were born</span></a></li>
      <li><a href="#design"><b>Emalatxanalar</b><span>Where the miniatures were painted</span></a></li>
    </ul>
  </section>
</div>

<style>
  .design { max-width: 60rem; }
  .design h3 { margin-top: var(--s-2); }
  .ui-swatch b { font-weight: 500; }
  .type { display: grid; grid-template-columns: 6rem 1fr auto; align-items: center; gap: var(--s-4); }
  .bar { display: block; height: .75rem; background: var(--accent); border-radius: var(--r-1); }
  .shape { display: grid; place-items: center; width: 7rem; height: 4rem; border: 1px solid var(--rule); background: var(--raised); font-size: var(--t-xs); color: var(--muted); }
</style>
