# Admin

A local tool for azadbilik.org, built in Svelte 5 on Vite. It runs on your machine only (127.0.0.1, no sign-in) and works on this checkout.

```sh
cd admin
npm install
npm run dev          # opens http://127.0.0.1:5178
PYTHON=~/venvs/ab/bin/python npm run dev   # to run the Python scripts in a venv
```

| Tab | What it does |
|---|---|
| Status | Git state, whether the search index is stale, the daily smoke test's last runs (needs `gh` signed in), and every page checked against the hub's conventions (core.css, theme, header, languages) |
| Data | Every data file. The hand-curated ones (`CURATED` in `server/repo.js`) can be edited record by record and saved in their own JSON layout; the rest are read-only, because a script builds them |
| Pipelines | Every script in a `scripts/` folder, described by its own header comment. Runs one from its section's folder and streams the output, then lists the files the run changed |
| Design system | The living reference of `/shared/core.css`: every token and component, in the current theme |

Nothing is committed for you. Review the diff and commit as usual.

## Layout

```
admin/
  server/repo.js     discovers pages, scripts and data files; git; the CURATED list
  server/api.js      the HTTP API (mounted into Vite's dev server) and /shared, /fonts from the repo
  src/App.svelte     frame and tabs
  src/tabs/          one component per tab
  src/lib/           api.js (calls to the server), Field.svelte (one value, edited by its type), ThemeToggle
  src/admin.css      the admin's few own rules; anything reusable goes in /shared/core.css
```

Styling comes from `/shared/core.css`, the same file the public pages use: the components are its `ui-` classes, not Svelte copies of them.

## Safety

- It writes only the files listed in `CURATED`, and only inside the repository.
- It runs only scripts it found in `scripts/` folders, without a shell, and stops a run when you press Stop or close the page.
- On azadbilik.org this folder is served as plain files. The page has no server behind it there and does nothing.
