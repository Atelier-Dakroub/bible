#!/usr/bin/env node
// Makes the app's icons from its two drawings, so a change to a drawing is a
// change to one file and a run of this tool (npm run icons).
//
//   app/public/icons/app.svg      the app icon: a full square, which the
//                                 phone or the computer rounds or masks itself
//   app/public/icons/favicon.svg  the browser tab: a rounded square, with
//                                 thicker lines that stay visible at 16 pixels
//
// From them:
//
//   app/public/favicon.ico              16 and 32 pixels, at the address a
//                                       browser or a feed reader asks for
//                                       when a page names no icon
//   app/public/icons/app-192.png        the manifest's icons
//   app/public/icons/app-512.png
//   app/public/icons/app-maskable-512.png  the book smaller, inside the
//                                       circle a mask keeps (80% of the side)
//   app/public/icons/apple-touch-icon.png  180 pixels, for the Home Screen
//
// rsvg-convert draws the PNGs (brew install librsvg). The .ico holds them as
// PNG, which every browser in use reads.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ICONS = 'app/public/icons';

/**
 * A drawing as a square PNG.
 *
 * @param {string} svg
 * @param {number} size in pixels
 * @returns {Buffer}
 */
function png(svg, size) {
  return execFileSync('rsvg-convert', ['--width', String(size), '--height', String(size)], {
    input: svg,
    maxBuffer: 16 * 1024 * 1024,
  });
}

/**
 * The app icon with the book drawn smaller, so that no mask cuts it.
 *
 * @param {string} svg
 */
export function maskable(svg) {
  const marked = svg.replace('<g ', '<g transform="translate(256 256) scale(0.84) translate(-256 -256)" ');
  if (marked === svg) throw new Error('app.svg has no <g> to make smaller');
  return marked;
}

/**
 * An .ico file of PNG images: a 6-byte header, a 16-byte entry for each
 * image, then the images.
 *
 * @param {{ size: number, data: Buffer }[]} images
 * @returns {Buffer}
 */
export function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1: an icon, not a cursor
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // no palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

function main() {
  const app = readFileSync(`${ICONS}/app.svg`, 'utf8');
  const favicon = readFileSync(`${ICONS}/favicon.svg`, 'utf8');
  const made = {
    'app/public/favicon.ico': ico([16, 32].map((size) => ({ size, data: png(favicon, size) }))),
    [`${ICONS}/app-192.png`]: png(app, 192),
    [`${ICONS}/app-512.png`]: png(app, 512),
    [`${ICONS}/app-maskable-512.png`]: png(maskable(app), 512),
    [`${ICONS}/apple-touch-icon.png`]: png(app, 180),
  };
  for (const [path, data] of Object.entries(made)) {
    writeFileSync(path, data);
    process.stdout.write(`${path}  ${data.length} bytes\n`);
  }
}

// Run, not imported (the tests import ico and maskable).
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
