// What the admin knows about the repository: its pages, its build scripts, its data files and the state of
// git. Everything is discovered from the files themselves, so a new page or script shows up without being
// registered anywhere. The one hand-kept list is CURATED: the data files people edit by hand.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '../..');

// Data files edited by hand (their READMEs say so). Only these can be saved from the admin;
// every other JSON in the repo is built by a script and shown read-only.
export const CURATED = [
  'arxiv/data/catalogue.json',
  'atlas/xanliqlar/data/khanates.json',
  'atlas/rayonlar/data/raions.json',
  'atlas/rayonlar/data/raions-1939.json',
  'atlas/rayonlar/data/raions-1926.json',
  'musiqi/bestekarlar/data/kx-links.json',
  'musiqi/silsile/data/lineage.text.json',
  'musiqi/caz/data/jazz.text.spec.json',
  'musiqi/data/mugham.json',
  'xeriteler/iskender/route.json',
  'xeriteler/xosrov-sirin/route.json',
  'xeriteler/yeddi-gozel/route.json',
];

const run = promisify(execFile);
export async function git(...args) {
  const { stdout } = await run('git', args, { cwd: ROOT, maxBuffer: 64 << 20 });
  return stdout;
}
const lines = (s) => s.split('\n').filter(Boolean);

// The date of the last commit that touched each file, from one `git log` instead of one per file
async function lastCommits() {
  const out = await git('log', '--format=@%cs', '--name-only', '--no-renames');
  const seen = new Map();
  let date = '';
  for (const l of lines(out)) {
    if (l.startsWith('@')) date = l.slice(1);
    else if (!seen.has(l)) seen.set(l, date);
  }
  return seen;
}

// ---- Pages: every index.html, with the hub's conventions checked
export async function pages() {
  const [files, dates] = await Promise.all([git('ls-files', '*.html'), lastCommits()]);
  const out = [];
  for (const file of lines(files)) {
    if (file.startsWith('admin/') || file === 'og.html') continue;
    const html = await fs.readFile(path.join(ROOT, file), 'utf8');
    const redirect = /http-equiv="refresh"/.test(html);
    const map = /maplibre-gl|story-map\.css/.test(html);
    // the page's own scripts, read too: a page may switch language or theme from a shared script
    const own = await Promise.all([...html.matchAll(/<script src="([^"]+)"/g)]
      .map((m) => m[1]).filter((src) => !/^https?:/.test(src))
      .map((src) => fs.readFile(path.join(ROOT, src.startsWith('/') ? src : path.join(path.dirname(file), src)), 'utf8').catch(() => '')));
    const code = html + own.join('\n');
    out.push({
      file,
      url: '/' + file.replace(/index\.html$/, ''),
      title: (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').replace(/ · Azad Bilik$/, ''),
      kb: Math.round(Buffer.byteLength(html) / 1024),
      updated: dates.get(file) ?? null,
      redirect,
      kind: redirect ? 'redirect' : map ? 'map' : 'page',
      checks: redirect ? {} : {
        core: html.includes('/shared/core.css'),
        theme: html.includes('/shared/theme.js'),
        // document pages carry the hub header; map pages their panel header
        header: map || html.includes('/shared/header.js'),
        lang: /localStorage\.getItem\('lang'\)/.test(code),
        noindex: /name="robots"[^>]*noindex/.test(html),
      },
    });
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

// ---- Scripts: every file in a scripts/ folder, described by its own header comment
const RUNNERS = { '.mjs': ['node'], '.js': ['node'], '.py': [process.env.PYTHON || 'python3'], '.sh': ['bash'] };
const NETWORK = /\b(fetch(es|ed)?|Wikidata|Overpass|OpenAlex|API|download|iTunes|YouTube)\b/i;

export async function scripts() {
  const files = lines(await git('ls-files', '*/scripts/*', 'scripts/*'))
    .filter((f) => RUNNERS[path.extname(f)] && !f.includes('/.deps/'));
  return Promise.all(files.map(async (file) => {
    const src = await fs.readFile(path.join(ROOT, file), 'utf8');
    const head = [];
    for (const l of src.split('\n').slice(0, 30)) {
      if (/^#!/.test(l)) continue;
      const m = l.match(/^\s*(?:\/\/|#)\s?(.*)$/);
      if (!m) { if (head.length) break; else continue; }
      head.push(m[1]);
    }
    // a script runs from the folder holding its scripts/ folder, as the READMEs show (`node scripts/build.mjs`)
    const cut = file.lastIndexOf('scripts/');
    const cwd = file.slice(0, cut).replace(/\/$/, '') || '.';
    const description = head.join(' ').replace(/\s+/g, ' ').trim();
    return {
      id: file,
      name: file.slice(cut),
      section: cwd === '.' ? 'hub' : cwd,
      cwd,
      runner: RUNNERS[path.extname(file)][0],
      description,
      network: NETWORK.test(description),
    };
  }));
}

export function command(script) {
  return { cmd: script.runner, args: [path.join(ROOT, script.id)], cwd: path.join(ROOT, script.cwd) };
}

// ---- Data files: every JSON the pages read (raw downloads and caches left out)
export async function datasets() {
  const files = lines(await git('ls-files', '*.json'))
    .filter((f) => !/\/raw\/|\/\.cache\/|^admin\/|package(-lock)?\.json$/.test(f));
  const out = await Promise.all(files.map(async (file) => {
    const { size } = await fs.stat(path.join(ROOT, file));
    return { file, kb: Math.round(size / 1024), curated: CURATED.includes(file) };
  }));
  return out.sort((a, b) => (b.curated - a.curated) || a.file.localeCompare(b.file));
}

// The indentation a JSON file was written with, and whether writing it back that way gives the same bytes.
// Files laid out by hand (one record per line…) don't round-trip; the editor warns before reformatting them.
export function layout(text) {
  const indent = text.match(/^[{[]\n([ \t]+)/)?.[1] ?? 0;
  const data = JSON.parse(text);
  const roundtrip = JSON.stringify(data, null, indent) + (text.endsWith('\n') ? '\n' : '') === text;
  return { data, indent, roundtrip, newline: text.endsWith('\n') };
}

export function inside(file) {
  const abs = path.resolve(ROOT, file);
  if (!abs.startsWith(ROOT + path.sep)) throw new Error('outside the repository');
  return abs;
}

// ---- Git and the hub's health
export async function status() {
  const [branch, porcelain, counts, dates] = await Promise.all([
    git('rev-parse', '--abbrev-ref', 'HEAD'),
    git('status', '--porcelain', '--untracked-files=all', '--', '.', ':!admin/node_modules'),
    git('rev-list', '--left-right', '--count', '@{u}...HEAD').catch(() => '0\t0'),
    lastCommits(),
  ]);
  const [behind, ahead] = counts.trim().split(/\s+/).map(Number);
  const changed = lines(porcelain).map((l) => ({ code: l.slice(0, 2).trim(), file: l.slice(3) }));

  // Search index: stale when a page or data file was committed after it, or is changed and not committed
  const indexDate = dates.get('shared/search.json');
  const newer = [...dates].filter(([f, d]) => d > indexDate && /(\.html|\/data\/[^/]+\.json)$/.test(f) && !f.includes('/raw/')).map(([f]) => f);
  const dirty = changed.filter((c) => /(\.html|\/data\/[^/]+\.json)$/.test(c.file)).map((c) => c.file);

  return {
    branch: branch.trim(), ahead, behind, changed,
    search: { updated: indexDate, newer: [...new Set([...newer, ...dirty])] },
    smoke: await smoke(),
  };
}

// The daily smoke test's last runs on GitHub, when the gh CLI is there and signed in
async function smoke() {
  try {
    const { stdout } = await run('gh', ['run', 'list', '--workflow=smoke.yml', '-L', '5', '--json', 'conclusion,status,createdAt,url'], { cwd: ROOT, timeout: 15000 });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}
