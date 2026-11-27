<script>
  // The hub at a glance: git, the search index, the daily smoke test, and every page against the conventions.
  import { get } from '../lib/api.js';

  const SITE = 'https://azadbilik.org';
  const CHECKS = [
    ['core', 'core.css', 'links /shared/core.css'],
    ['theme', 'theme', 'loads /shared/theme.js'],
    ['header', 'header', 'hub header, or a map panel'],
    ['lang', 'az/ru/en', 'switches language'],
  ];

  let status = $state(null);
  let pages = $state([]);
  let error = $state('');
  let kind = $state('all');

  async function load() {
    error = '';
    try {
      [status, pages] = await Promise.all([get('/api/status'), get('/api/pages')]);
    } catch (e) {
      error = e.message;
    }
  }
  load();

  const shown = $derived(pages.filter((p) => kind === 'all' || p.kind === kind));
  const kinds = $derived(['all', 'page', 'map', 'redirect'].map((k) => [k, k === 'all' ? pages.length : pages.filter((p) => p.kind === k).length]));
  const failing = $derived(pages.filter((p) => Object.entries(p.checks).some(([k, v]) => k !== 'noindex' && !v)).length);
  const lastSmoke = $derived(status?.smoke?.[0]);
</script>

{#if error}
  <p class="ui-note is-bad">{error}</p>
{:else if !status}
  <p class="ui-muted">Reading the repository…</p>
{:else}
  <div class="ui-grid" style="--min: 11rem">
    <div class="ui-stat"><b>{pages.filter((p) => !p.redirect).length}</b><span>pages</span></div>
    <div class="ui-stat"><b>{status.changed.length}</b><span>uncommitted files</span></div>
    <div class="ui-stat"><b>{status.ahead}</b><span>commits to push</span></div>
    <div class="ui-stat"><b>{failing}</b><span>pages off-convention</span></div>
  </div>

  <div class="ui-grid cards" style="--min: 18rem">
    <section class="ui-card ui-stack" style="--gap: var(--s-2)">
      <h2 class="ui-h">Git</h2>
      <p class="ui-row">
        <span class="ui-code">{status.branch}</span>
        {#if status.behind}<span class="ui-badge is-warn">{status.behind} behind</span>{/if}
        {#if status.ahead}<span class="ui-badge is-info">{status.ahead} ahead</span>{/if}
        {#if !status.ahead && !status.behind}<span class="ui-badge is-ok">in step with origin</span>{/if}
      </p>
      {#if status.changed.length}
        <ul class="files">
          {#each status.changed.slice(0, 12) as c (c.file)}<li><span class="ui-code">{c.code}</span> {c.file}</li>{/each}
          {#if status.changed.length > 12}<li class="ui-muted">and {status.changed.length - 12} more</li>{/if}
        </ul>
      {:else}
        <p class="ui-muted">Nothing uncommitted.</p>
      {/if}
    </section>

    <section class="ui-card ui-stack" style="--gap: var(--s-2)">
      <h2 class="ui-h">Search index</h2>
      <p class="ui-row">
        {#if status.search.newer.length}
          <span class="ui-badge is-warn is-dot">may be stale</span>
        {:else}
          <span class="ui-badge is-ok is-dot">up to date</span>
        {/if}
        <span class="ui-muted">built {status.search.updated}</span>
      </p>
      {#if status.search.newer.length}
        <p class="ui-muted">{status.search.newer.length} pages or data files changed since. Run <span class="ui-code">scripts/search-index.mjs</span> in Pipelines.</p>
      {/if}
    </section>

    <section class="ui-card ui-stack" style="--gap: var(--s-2)">
      <h2 class="ui-h">Smoke test</h2>
      {#if !status.smoke}
        <p class="ui-muted">The gh CLI isn't signed in, so the runs can't be read.</p>
      {:else if lastSmoke}
        <p class="ui-row">
          <span class="ui-badge is-dot {lastSmoke.conclusion === 'success' ? 'is-ok' : lastSmoke.conclusion ? 'is-bad' : 'is-info'}">{lastSmoke.conclusion || lastSmoke.status}</span>
          <a href={lastSmoke.url} target="_blank" rel="noopener">{lastSmoke.createdAt.slice(0, 16).replace('T', ' ')}</a>
        </p>
        <p class="ui-row" aria-label="Earlier runs">
          {#each status.smoke.slice(1) as r (r.url)}
            <a class="ui-badge {r.conclusion === 'success' ? 'is-ok' : 'is-bad'}" href={r.url} target="_blank" rel="noopener">{r.createdAt.slice(5, 10)}</a>
          {/each}
        </p>
      {/if}
    </section>
  </div>

  <section class="section">
    <header>
      <h2 class="ui-h">Pages</h2>
      <div class="ui-row">
        {#each kinds as [k, n] (k)}
          <button class="ui-chip" aria-pressed={kind === k} onclick={() => (kind = k)}>{k} <span class="n">{n}</span></button>
        {/each}
        <button class="ui-btn is-small" onclick={load}>Refresh</button>
      </div>
    </header>
    <div class="ui-table-wrap">
      <table class="ui-table">
        <thead>
          <tr>
            <th>Page</th>
            <th>Kind</th>
            {#each CHECKS as [, label, hint] (label)}<th title={hint}>{label}</th>{/each}
            <th class="ui-num">KB</th>
            <th>Last commit</th>
          </tr>
        </thead>
        <tbody>
          {#each shown as p (p.file)}
            <tr>
              <td>
                <a href={SITE + p.url} target="_blank" rel="noopener">{p.url}</a>
                <div class="ui-muted">{p.title}</div>
              </td>
              <td><span class="ui-badge" class:is-info={p.kind === 'map'}>{p.kind}</span></td>
              {#each CHECKS as [key] (key)}
                <td>
                  {#if p.redirect}<span class="ui-muted">–</span>
                  {:else if p.checks[key]}<span class="ui-badge is-ok">yes</span>
                  {:else}<span class="ui-badge is-bad">no</span>{/if}
                </td>
              {/each}
              <td class="ui-num">{p.kb}</td>
              <td class="ui-num">{p.updated ?? 'not committed'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

<style>
  .cards { margin-block: var(--s-6); }
  .files { margin: 0; padding: 0; list-style: none; font-size: var(--t-sm); overflow-wrap: anywhere; }
  .files li + li { margin-top: var(--s-1); }
</style>
