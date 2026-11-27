// The admin's API, mounted into Vite's dev server (vite.config.js). It listens on 127.0.0.1 only and has no
// sign-in: it is a local tool. It can write only the CURATED data files and run only scripts it discovered.
//
//   GET  /api/status            git state, search-index freshness, smoke-test runs
//   GET  /api/pages             every page and its convention checks
//   GET  /api/scripts           every build script
//   GET  /api/datasets          every data file
//   GET  /api/file?path=…       one data file, parsed, with its layout
//   PUT  /api/file?path=…       write one curated file ({ data }) in its own layout
//   POST /api/run?id=…          run a script; the response streams its output, the last line is `exit <code>`
//
// It also serves /shared/ and /fonts/ from the repository, so the admin uses the hub's own design core.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as repo from './repo.js';

const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

export function api() {
  return {
    name: 'azadbilik-admin-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://local');
        try {
          if (/^\/(shared|fonts)\//.test(url.pathname) || url.pathname === '/favicon.svg') return await serveStatic(url.pathname, res);
          if (!url.pathname.startsWith('/api/')) return next();
          const route = `${req.method} ${url.pathname}`;
          const handler = ROUTES[route];
          if (!handler) return send(res, 404, { error: `no route ${route}` });
          await handler({ req, res, url });
        } catch (e) {
          send(res, 500, { error: e.message });
        }
      });
    },
  };
}

const ROUTES = {
  'GET /api/status': async ({ res }) => send(res, 200, await repo.status()),
  'GET /api/pages': async ({ res }) => send(res, 200, await repo.pages()),
  'GET /api/scripts': async ({ res }) => send(res, 200, await repo.scripts()),
  'GET /api/datasets': async ({ res }) => send(res, 200, await repo.datasets()),

  'GET /api/file': async ({ res, url }) => {
    const file = url.searchParams.get('path');
    const text = await fs.readFile(repo.inside(file), 'utf8');
    const { data, indent, roundtrip } = repo.layout(text);
    send(res, 200, { file, data, indent, roundtrip, curated: repo.CURATED.includes(file) });
  },

  'PUT /api/file': async ({ req, res, url }) => {
    const file = url.searchParams.get('path');
    if (!repo.CURATED.includes(file)) return send(res, 403, { error: `${file} is built by a script, not edited by hand` });
    const abs = repo.inside(file);
    const { indent, newline } = repo.layout(await fs.readFile(abs, 'utf8'));
    const { data } = JSON.parse(await body(req));
    await fs.writeFile(abs, JSON.stringify(data, null, indent) + (newline ? '\n' : ''));
    const stat = (await repo.git('diff', '--numstat', '--', file)).trim().split(/\s+/);
    send(res, 200, { file, added: Number(stat[0] || 0), removed: Number(stat[1] || 0) });
  },

  'POST /api/run': async ({ res, url }) => {
    const script = (await repo.scripts()).find((s) => s.id === url.searchParams.get('id'));
    if (!script) return send(res, 404, { error: 'unknown script' });
    const { cmd, args, cwd } = repo.command(script);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.write(`$ cd ${script.cwd} && ${cmd} ${script.name}\n`);
    const child = spawn(cmd, args, { cwd, env: { ...process.env, FORCE_COLOR: '0' } });
    child.stdout.on('data', (d) => res.write(d));
    child.stderr.on('data', (d) => res.write(d));
    child.on('error', (e) => { res.write(`\n${e.message}\nexit 127\n`); res.end(); });
    child.on('close', (code, signal) => { res.write(`\nexit ${signal ? signal : code}\n`); res.end(); });
    // the page stopped the run (or went away): stop the script too
    res.on('close', () => { if (child.exitCode === null) child.kill('SIGTERM'); });
  },
};

async function serveStatic(pathname, res) {
  try {
    const file = await fs.readFile(repo.inside(pathname.slice(1)));
    res.writeHead(200, { 'content-type': TYPES[path.extname(pathname)] ?? 'application/octet-stream' });
    res.end(file);
  } catch {
    send(res, 404, { error: 'not found' });
  }
}

function send(res, code, json) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(json));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', (d) => (s += d));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}
