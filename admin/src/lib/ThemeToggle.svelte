<script>
  // Light / dark, stored as the hub stores it (localStorage.theme, <html data-theme>), so the choice is shared
  // with azadbilik.org's pages.
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let dark = $state(root.dataset.theme ? root.dataset.theme === 'dark' : system.matches);

  function toggle() {
    dark = !dark;
    root.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  }
</script>

<button class="ui-btn is-ghost theme" onclick={toggle} aria-label={dark ? 'Switch to light' : 'Switch to dark'}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {#if dark}
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    {:else}
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    {/if}
  </svg>
</button>
