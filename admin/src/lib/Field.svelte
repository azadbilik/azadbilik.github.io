<script>
  // One value of a record, edited in the control its type calls for:
  //   text → input (a textarea when long), number → number, true/false → checkbox,
  //   { az, ru, en } and other small objects of text → one input per key,
  //   anything else (lists, nested objects) → JSON, applied when it parses.
  import Field from './Field.svelte';

  let { obj, key, onchange } = $props();

  const value = $derived(obj[key]);
  const type = $derived(kindOf(value));
  let json = $state('');
  let invalid = $state(false);

  $effect(() => {
    if (type === 'json') {
      const flat = JSON.stringify(value);
      json = flat.length <= 60 ? flat : JSON.stringify(value, null, 1);
      invalid = false;
    }
  });

  function kindOf(v) {
    if (typeof v === 'string') return v.length > 80 || v.includes('\n') ? 'long' : 'text';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'boolean') return 'boolean';
    if (v === null) return 'null';
    const entries = Object.entries(v);
    if (!Array.isArray(v) && entries.length <= 6 && entries.every(([, x]) => typeof x === 'string')) return 'texts';
    return 'json';
  }

  function set(v) {
    obj[key] = v;
    onchange?.();
  }

  function applyJson() {
    try {
      set(JSON.parse(json));
      invalid = false;
    } catch {
      invalid = true;
    }
  }
</script>

{#if type === 'texts'}
  <fieldset class="group">
    <legend>{key}</legend>
    {#each Object.keys(value) as k (k)}
      <Field obj={value} key={k} {onchange} />
    {/each}
  </fieldset>
{:else if type === 'boolean'}
  <label class="ui-check"><input type="checkbox" checked={value} onchange={(e) => set(e.currentTarget.checked)} /> {key}</label>
{:else}
  <label class="ui-field">
    <span>{key}{#if type === 'null'} <small>(empty)</small>{/if}</span>
    {#if type === 'long'}
      <textarea class="ui-textarea" value={value} oninput={(e) => set(e.currentTarget.value)}></textarea>
    {:else if type === 'number'}
      <input class="ui-input ui-num" type="number" step="any" value={value} oninput={(e) => e.currentTarget.value !== '' && set(Number(e.currentTarget.value))} />
    {:else if type === 'json'}
      <textarea class="ui-textarea is-code" rows={Math.min(12, json.split('\n').length)} bind:value={json} onblur={applyJson} aria-invalid={invalid}></textarea>
      {#if invalid}<small>Not valid JSON, so not applied.</small>{/if}
    {:else}
      <input class="ui-input" value={value ?? ''} oninput={(e) => set(type === 'null' && e.currentTarget.value === '' ? null : e.currentTarget.value)} />
    {/if}
  </label>
{/if}

<style>
  .group { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--s-3); margin: 0; padding: var(--s-3); border: 1px solid var(--rule); border-radius: var(--r-3); }
  .group legend { padding: 0 var(--s-1); font-size: var(--t-sm); color: var(--muted); }
</style>
