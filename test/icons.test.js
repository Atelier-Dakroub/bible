// tools/icons.js: the .ico it writes, and the maskable drawing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ico, maskable } from '../tools/icons.js';

test('an .ico names each image, its size and where it starts', () => {
  const small = Buffer.from('aaaa');
  const large = Buffer.from('bbbbbb');
  const file = ico([
    { size: 16, data: small },
    { size: 256, data: large },
  ]);

  assert.deepEqual([file.readUInt16LE(0), file.readUInt16LE(2), file.readUInt16LE(4)], [0, 1, 2]);
  // First entry: 16 pixels, 4 bytes, after the header and both entries.
  assert.deepEqual([file[6], file[7], file.readUInt32LE(14), file.readUInt32LE(18)], [16, 16, 4, 38]);
  // 256 is written as 0, and the second image follows the first.
  assert.deepEqual([file[22], file[23], file.readUInt32LE(30), file.readUInt32LE(34)], [0, 0, 6, 42]);
  assert.equal(file.subarray(38).toString(), 'aaaabbbbbb');
});

test('the maskable icon draws the book smaller, on the same square', () => {
  const app = readFileSync('app/public/icons/app.svg', 'utf8');
  const marked = maskable(app);
  assert.match(marked, /<rect width="512" height="512"/);
  assert.match(marked, /<g transform="translate\(256 256\) scale\(0\.84\)/);
  assert.throws(() => maskable('<svg></svg>'), /no <g>/);
});

test('the manifest and the page name icons that exist', () => {
  const manifest = JSON.parse(readFileSync('app/public/manifest.webmanifest', 'utf8'));
  const layout = readFileSync('app/routes/_layout.html', 'utf8');
  const named = [
    ...manifest.icons.map((/** @type {{ src: string }} */ icon) => icon.src),
    ...[...layout.matchAll(/rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.ok(named.includes('/favicon.ico'));
  assert.ok(manifest.icons.some((/** @type {{ purpose?: string }} */ icon) => icon.purpose === 'maskable'));
  for (const src of named) assert.ok(readFileSync(`app/public${src}`).length > 0, src);
});
