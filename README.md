# azadbilik.org

Azad Bilik ("free knowledge"): open maps, data, music and archives on Azerbaijani culture and history. This repository is the site, served as-is by GitHub Pages.

## Stack

Plain HTML, CSS and JavaScript, with no framework and no build step. Each page is one `index.html` that loads only what it needs: MapLibre for maps, a shared graph renderer for networks, and its own data as JSON. What you read in the repository is exactly what the browser gets.

The data is built ahead of time by scripts in each section's `scripts/` folder (Node, some Python), and their output is committed.

The admin (`admin/`) is the one exception: a local Svelte app for editing data and running the scripts. It is never part of the public site.

## Layout

```
index.html              home
<section>/index.html    a page: atlas/, musiqi/, sebeke/, xeriteler/, arxiv/, soz/ and their sub-pages
<section>/data/         what the page reads (data/raw/ is git-ignored downloads)
<section>/scripts/      what builds data/ (each script describes itself in its header comment)
<section>/README.md     sources, licences, how to rebuild
shared/                 what every page shares (below)
fonts/                  Inter and Literata, self-hosted
scripts/                hub-wide: search index, smoke test, graph layout
admin/                  local admin (Svelte); see admin/README.md
```

## Shared

| File | Role |
|---|---|
| `shared/core.css` | The design core: colour, type, space and shape tokens (light and dark), a minimal base, and `ui-` components. Every page links it |
| `shared/theme.js` | Light/dark switch (`localStorage.theme`), also re-colours maps in place; loads `hub.js` |
| `shared/hub.js` | Site search (`/` or ⌘K) over `shared/search.json` |
| `shared/header.js` + `hub.css` | The hub header of document pages |
| `shared/story-map.{js,css}` | The panel-over-map frame of the map pages |
| `shared/graph.{js,css}` | Network pages |

## A new page

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="/shared/theme.js"></script>
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/shared/core.css">
<link rel="stylesheet" href="/shared/hub.css">
…
<body>
<header class="hub-header"></header><script src="/shared/header.js"></script>
```

- Use the tokens (`var(--ink)`, `var(--accent)`, `var(--s-4)` …) and the `ui-` components; see the admin's Design system tab. A page's own CSS overrides the core without `!important`, because the core sits in cascade layers.
- Write every text three times, `<span data-l="az">…</span><span data-l="ru">…</span><span data-l="en">…</span>`.
- Write any dark colours of your own twice, as `core.css` does: under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }`, and under `:root[data-theme="dark"]`.
- Then run `node scripts/search-index.mjs`, and check the page in the admin's Status tab.

## Run locally

```sh
python3 -m http.server 8000      # the site, at http://localhost:8000
cd admin && npm i && npm run dev # the admin
```
