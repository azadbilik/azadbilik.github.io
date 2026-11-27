<script>
  // The data files behind the pages. Hand-curated ones can be edited record by record and saved in their own
  // layout; the rest are built by scripts and only shown. A file's lists of records ("collections") become
  // tables; its other keys are edited as its properties.
  import { get, getFile, putFile } from '../lib/api.js';
  import Field from '../lib/Field.svelte';

  let files = $state([]);
  let filter = $state('');
  let showBuilt = $state(false);
  let current = $state(null);      // { file, data, curated, roundtrip }
  let collection = $state(null);   // key of the open list of records, '' for a file that is one list
  let selected = $state(null);     // index of the open record
  let query = $state('');
  let dirty = $state(false);
  let message = $state(null);      // { tone, text }
  let busy = $state(false);

  get('/api/datasets').then((f) => (files = f)).catch((e) => (message = { tone: 'bad', text: e.message }));

  const listed = $derived(files.filter((f) => (showBuilt || f.curated) && f.file.includes(filter.trim())));

  // Lists of records in the file: the file itself if it is one, else each key holding a list of objects
  const collections = $derived.by(() => {
    if (!current) return [];
    const d = current.data;
    if (Array.isArray(d)) return [''];
    return Object.keys(d).filter((k) => Array.isArray(d[k]) && d[k].length && typeof d[k][0] === 'object');
  });
  const records = $derived(current ? (collection === '' ? current.data : current.data[collection] ?? []) : []);
  const columns = $derived([...new Set(records.slice(0, 50).flatMap((r) => Object.keys(r ?? {})))].slice(0, 6));
  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return records.map((r, i) => [r, i]).filter(([r]) => !q || JSON.stringify(r).toLowerCase().includes(q));
  });
  const properties = $derived(current && !Array.isArray(current.data) ? Object.keys(current.data).filter((k) => !collections.includes(k)) : []);

  async function open(file) {
    if (dirty && !confirm('Leave without saving your changes?')) return;
    message = null;
    busy = true;
    try {
      current = await getFile(file);
      collection = collections[0] ?? null;
      selected = null;
      query = '';
      dirty = false;
    } catch (e) {
      message = { tone: 'bad', text: e.message };
    }
    busy = false;
  }

  function cell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return v.az ?? v.en ?? JSON.stringify(v).slice(0, 60);
    return String(v).slice(0, 80);
  }

  // A new record with the first record's fields, emptied
  function blank(r) {
    if (Array.isArray(r)) return r.map(blank);
    if (r && typeof r === 'object') return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'object' ? (Array.isArray(v) ? [] : blank(v)) : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : '']));
    return '';
  }
  function add() { records.push(blank(records[0])); selected = records.length - 1; changed(); }
  function duplicate() { records.splice(selected + 1, 0, structuredClone($state.snapshot(records[selected]))); selected += 1; changed(); }
  function remove() { if (!confirm('Delete this record?')) return; records.splice(selected, 1); selected = null; changed(); }
  function changed() { dirty = true; message = null; }

  async function save() {
    if (!current.roundtrip && !confirm('This file is laid out by hand. Saving rewrites it in standard JSON layout, so its diff will be larger than your change. Save anyway?')) return;
    busy = true;
    try {
      const r = await putFile(current.file, $state.snapshot(current.data));
      dirty = false;
      current.roundtrip = true;
      message = { tone: 'ok', text: `Saved ${r.file}: +${r.added} −${r.removed} lines against the last commit. Rebuild the page's data in Pipelines, then commit.` };
    } catch (e) {
      message = { tone: 'bad', text: e.message };
    }
    busy = false;
  }
</script>

<svelte:window onbeforeunload={(e) => dirty && e.preventDefault()} />

<div class="split">
  <aside class="ui-stack" style="--gap: var(--s-3)">
    <input class="ui-input" type="search" placeholder="Filter files" bind:value={filter} />
    <label class="ui-check"><input type="checkbox" bind:checked={showBuilt} /> Also show files built by scripts</label>
    <ul class="pick">
      {#each listed as f, i (f.file)}
        {#if i === 0 || listed[i - 1].curated !== f.curated}
          <li class="group ui-label">{f.curated ? 'Edited by hand' : 'Built by scripts'}</li>
        {/if}
        <li><button aria-current={current?.file === f.file} onclick={() => open(f.file)}>{f.file}<small>{f.kb} KB</small></button></li>
      {/each}
    </ul>
  </aside>

  <section class="ui-stack">
    {#if message}<p class="ui-note is-{message.tone}">{message.text}</p>{/if}

    {#if !current}
      <p class="ui-muted">Choose a file. Hand-curated files can be edited and saved; files built by scripts are read-only, so change their sources and rebuild them instead.</p>
    {:else}
      <header class="head">
        <div class="ui-stack" style="--gap: var(--s-1)">
          <h2 class="ui-h">{current.file}</h2>
          <p class="ui-row">
            {#if current.curated}<span class="ui-badge is-info">edited by hand</span>{:else}<span class="ui-badge">built by a script: read-only</span>{/if}
            {#if !current.roundtrip}<span class="ui-badge is-warn" title="Saving rewrites it in standard JSON layout">hand layout</span>{/if}
            {#if dirty}<span class="ui-badge is-warn is-dot">unsaved</span>{/if}
          </p>
        </div>
        {#if current.curated}
          <button class="ui-btn is-primary" disabled={!dirty || busy} onclick={save}>Save file</button>
        {/if}
      </header>

      <div class="plain">
        {#if properties.length}
          <details class="ui-card">
            <summary class="ui-label">Properties · {properties.join(', ')}</summary>
            <fieldset class="plain props" disabled={!current.curated}>
              {#each properties as key (key)}<Field obj={current.data} {key} onchange={changed} />{/each}
            </fieldset>
          </details>
        {/if}

        {#if collections.length}
          <div class="ui-row">
            {#each collections as c (c)}
              <button type="button" class="ui-chip" aria-pressed={collection === c} onclick={() => { collection = c; selected = null; }}>
                {c || 'records'} <span class="n">{(c === '' ? current.data : current.data[c]).length}</span>
              </button>
            {/each}
            <input class="ui-input search" type="search" placeholder="Search records" bind:value={query} />
            {#if current.curated}<button type="button" class="ui-btn is-small" onclick={add}>Add record</button>{/if}
          </div>

          <div class="ui-table-wrap records">
            <table class="ui-table is-clickable">
              <thead><tr><th class="ui-num">#</th>{#each columns as c (c)}<th>{c}</th>{/each}</tr></thead>
              <tbody>
                {#each rows as [r, i] (i)}
                  <tr aria-selected={selected === i} onclick={() => (selected = i)}>
                    <td class="ui-num ui-muted">{i + 1}</td>
                    {#each columns as c (c)}<td>{cell(r?.[c])}</td>{/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if selected !== null && records[selected]}
            <div class="ui-card ui-stack">
              <header class="head">
                <h3 class="ui-h">Record {selected + 1}</h3>
                {#if current.curated}
                  <div class="ui-row">
                    <button type="button" class="ui-btn is-small" onclick={duplicate}>Duplicate</button>
                    <button type="button" class="ui-btn is-small is-danger" onclick={remove}>Delete</button>
                  </div>
                {/if}
              </header>
              {#key `${collection}/${selected}`}
                <fieldset class="plain" disabled={!current.curated}>
                  {#each Object.keys(records[selected]) as key (key)}
                    <Field obj={records[selected]} {key} onchange={changed} />
                  {/each}
                </fieldset>
              {/key}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: var(--s-3); }
  .head h2 { overflow-wrap: anywhere; }
  .plain { display: flex; flex-direction: column; gap: var(--s-4); min-width: 0; margin: 0; padding: 0; border: 0; }
  .props { margin-top: var(--s-4); }
  summary { cursor: pointer; }
  .search { width: auto; flex: 1 1 12rem; }
  .records { max-height: 26rem; }
</style>
