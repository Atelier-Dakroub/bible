#!/usr/bin/env node
// Prepares a build (npm run build) for Cloudflare: npm run deploy runs it.
//
//   node tools/build-edge.js
//
// Transclude's build puts every byte the app serves into dist/server/assets.js,
// for a Worker that reads no disk. For this app that is about 28 MB, with the
// map's images and the design page; and the data in app/data is about 60 MB
// more. A Worker's code has a limit of 10 MB. So the Worker serves only what it
// renders, and the rest goes to the Worker's static assets, which Cloudflare
// serves before the Worker runs:
//
//   dist/edge/assets/       the static assets (wrangler.jsonc, "assets")
//     the prerendered pages (table.html for /table), the public files, the
//     built scripts and styles under /assets, and the data under /data
//     (data/store.js reads it through the binding; wrangler.jsonc sends a
//     request for /data to the Worker, which has no such page, so the data
//     files are not served as they are)
//     _headers                 the headers the Node server gives the same files
//   dist/edge/pages.js       what worker.js still needs from assets.js: the
//                            404 and error pages, and the precache list
//
// The bytes are taken from assets.js, so each file has the path the app
// gives it under Node.

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'dist/edge');
const assets = path.join(out, 'assets');

/** @type {Record<string, { type: string, body: string }>} */
const bundle = await import(path.join(root, 'dist/server/assets.js'));
const { statics, assets: built, publicFiles, notFound, errorPage, precache } = /** @type {any} */ (bundle);

await rm(out, { recursive: true, force: true });
await mkdir(assets, { recursive: true });

let count = 0;
let bytes = 0;

/** @param {string} url @param {{ body: string }} file */
async function put(url, file) {
  const target = path.join(assets, url);
  const body = Buffer.from(file.body, 'base64');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  count += 1;
  bytes += body.length;
}

// A page at /table is table.html, which Cloudflare serves at /table; the
// home page is index.html.
for (const [url, file] of Object.entries(statics)) await put(url === '/' ? '/index.html' : `${url}.html`, file);
for (const [url, file] of Object.entries({ ...built, ...publicFiles })) await put(url, file);

// The data: every JSON file in app/data, at its path there.
/** @param {string} folder */
async function copyData(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const from = path.join(folder, entry.name);
    if (entry.isDirectory()) await copyData(from);
    else if (entry.name.endsWith('.json')) {
      const to = path.join(assets, 'data', path.relative(path.join(root, 'app/data'), from));
      await mkdir(path.dirname(to), { recursive: true });
      await cp(from, to);
      count += 1;
    }
  }
}
await copyData(path.join(root, 'app/data'));

// The headers the Node server sends with these files (Transclude's defaults
// in transclude.config.js: csp, permissionsPolicy).
await writeFile(
  path.join(assets, '_headers'),
  [
    '/*',
    "  Content-Security-Policy: frame-ancestors 'self'",
    '  Permissions-Policy: accelerometer=(), browsing-topics=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
    '  X-Content-Type-Options: nosniff',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
);

await writeFile(
  path.join(out, 'pages.js'),
  `// Written by tools/build-edge.js. Do not edit.\nexport const notFound = ${JSON.stringify(notFound ?? null)};\nexport const errorPage = ${JSON.stringify(errorPage ?? null)};\nexport const precache = ${JSON.stringify(precache ?? null)};\n`,
);

console.log(`dist/edge: ${count} static files (${Math.round(bytes / 1e6)} MB besides the data), and pages.js.`);
