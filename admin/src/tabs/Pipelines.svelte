<script>
  // Every build script in the repository, grouped by the section it builds, described by its own header comment.
  // Run one and its output streams in; afterwards the files it changed are listed, ready to review and commit.
  import { get, runScript } from '../lib/api.js';

  let scripts = $state([]);
  let filter = $state('');
  let chosen = $state(null);
  let log = $state('');
  let running = $state(false);
  let exit = $state(null);
  let changed = $state([]);
  let error = $state('');
  let controller = null;
  let pre = $state();

  get('/api/scripts').then((s) => {
    scripts = s;
    chosen = s.find((x) => x.id === 'scripts/search-index.mjs') ?? s[0];
  }).catch((e) => (error = e.message));

  const sections = $derived.by(() => {
    const q = filter.trim().toLowerCase();
    const groups = new Map();
    for (const s of scripts) {
      if (q && !`${s.id} ${s.description}`.toLowerCase().includes(q)) continue;
      if (!groups.has(s.section)) groups.set(s.section, []);
      groups.get(s.section).push(s);
    }
    return [...groups];
  });

  async function start() {
    log = '';
    exit = null;
    changed = [];
    running = true;
    controller = new AbortController();
    const before = new Set((await get('/api/status')).changed.map((c) => c.file));
    try {
      await runScript(chosen.id, (text) => {
        log += text;
        queueMicrotask(() => pre && (pre.scrollTop = pre.scrollHeight));
      }, controller.signal);
      exit = log.trimEnd().split('\n').at(-1).replace(/^exit /, '');
    } catch (e) {
      exit = e.name === 'AbortError' ? 'stopped' : e.message;
    }
    running = false;
    changed = (await get('/api/status')).changed.filter((c) => !before.has(c.file));
  }

  function choose(s) {
    if (running) return;
    chosen = s;
    log = '';
    exit = null;
    changed = [];
  }
</script>

{#if error}<p class="ui-note is-bad">{error}</p>{/if}

<div class="split">
  <aside class="ui-stack" style="--gap: var(--s-3)">
    <input class="ui-input" type="search" placeholder="Filter scripts" bind:value={filter} />
    <ul class="pick">
      {#each sections as [section, list] (section)}
        <li class="group ui-label">{section}</li>
        {#each list as s (s.id)}
          <li>
            <button aria-current={chosen?.id === s.id} onclick={() => choose(s)} disabled={running && chosen?.id !== s.id}>
              {s.name}<small>{s.runner}</small>
            </button>
          </li>
        {/each}
      {/each}
    </ul>
  </aside>

  {#if chosen}
    <section class="ui-stack">
      <header class="head">
        <div class="ui-stack" style="--gap: var(--s-1)">
          <h2 class="ui-h">{chosen.id}</h2>
          <p class="ui-row">
            <span class="ui-code">cd {chosen.cwd} && {chosen.runner} {chosen.name}</span>
            {#if chosen.network}<span class="ui-badge is-warn" title="Its description mentions fetching from the network">network</span>{/if}
            {#if chosen.runner !== 'node'}<span class="ui-badge" title="Set PYTHON=… before npm run dev to use a venv">{chosen.runner}</span>{/if}
          </p>
        </div>
        {#if running}
          <button class="ui-btn" onclick={() => controller.abort()}>Stop</button>
        {:else}
          <button class="ui-btn is-primary" onclick={start}>Run</button>
        {/if}
      </header>

      <p class="description">{chosen.description || 'No header comment: add one at the top of the script to describe it here.'}</p>

      {#if log || running}
        <div class="ui-row">
          {#if running}<span class="ui-badge is-info is-dot">running</span>
          {:else if exit === '0'}<span class="ui-badge is-ok is-dot">done</span>
          {:else}<span class="ui-badge is-bad is-dot">exit {exit}</span>{/if}
        </div>
        <pre class="ui-pre log" bind:this={pre}>{log}</pre>
      {/if}

      {#if !running && exit !== null}
        {#if changed.length}
          <div class="ui-note">
            <p>This run changed {changed.length} files that were committed before it:</p>
            <ul class="files">{#each changed.slice(0, 20) as c (c.file)}<li><span class="ui-code">{c.code}</span> {c.file}</li>{/each}</ul>
          </div>
        {:else}
          <p class="ui-muted">No committed file changed. Files already uncommitted before the run are not counted.</p>
        {/if}
      {/if}
    </section>
  {/if}
</div>

<style>
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--s-3); }
  .head h2 { overflow-wrap: anywhere; }
  .description { max-width: var(--measure); font-size: var(--t-md); color: var(--muted); }
  .log { max-height: 28rem; }
  .files { margin: var(--s-2) 0 0; padding: 0; list-style: none; overflow-wrap: anywhere; }
</style>
