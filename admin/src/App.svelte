<script>
  // The admin's frame: the hub's brand, four tabs (kept in the URL's hash) and the theme switch.
  import Status from './tabs/Status.svelte';
  import Data from './tabs/Data.svelte';
  import Pipelines from './tabs/Pipelines.svelte';
  import Design from './tabs/Design.svelte';
  import ThemeToggle from './lib/ThemeToggle.svelte';

  const TABS = [
    { id: 'status', label: 'Status', view: Status },
    { id: 'data', label: 'Data', view: Data },
    { id: 'pipelines', label: 'Pipelines', view: Pipelines },
    { id: 'design', label: 'Design system', view: Design },
  ];
  const fromHash = () => TABS.find((t) => t.id === location.hash.slice(1)) ?? TABS[0];

  let tab = $state(fromHash().id);
  const View = $derived(TABS.find((t) => t.id === tab).view);

  function open(t) {
    tab = t.id;
    history.replaceState(null, '', `#${t.id}`);
  }
</script>

<svelte:window onhashchange={() => (tab = fromHash().id)} />

<header class="bar">
  <a class="brand" href="https://azadbilik.org/">
    <svg viewBox="0 0 512 512" aria-hidden="true">
      <g class="star"><rect x="126" y="126" width="260" height="260" /><polygon points="256,72 440,256 256,440 72,256" /></g>
      <polygon class="gem" points="256,196 316,256 256,316 196,256" />
    </svg>
    Azad Bilik
  </a>
  <span class="ui-label">Admin</span>
  <ThemeToggle />
</header>

<div class="ui-tabs tabs" role="tablist" aria-label="Admin sections">
  {#each TABS as t (t.id)}
    <button role="tab" aria-selected={tab === t.id} onclick={() => open(t)}>{t.label}</button>
  {/each}
</div>

<main class="main">
  {#key tab}<View />{/key}
</main>

<style>
  .bar { display: flex; align-items: center; gap: var(--s-4); padding: var(--s-5) var(--gutter) var(--s-3); }
  .brand { display: inline-flex; align-items: center; gap: .6rem; font-weight: 600; font-size: var(--t-md); text-decoration: none; }
  .brand svg { width: 1.375rem; height: 1.375rem; }
  .star { fill: currentColor; }
  .gem { fill: var(--accent); }
  .bar :global(.theme) { margin-left: auto; }
  .tabs { padding-inline: var(--gutter); }
  .main { padding: var(--s-5) var(--gutter) var(--s-7); }
</style>
