#!/usr/bin/env node
// The app's data files, linked into dist/edge/data after the build, so that
// on Cloudflare the edge serves them and app/data/load.js fetches them
// through the worker's ASSETS binding. Under Node the app reads app/data off
// the disk and this folder is not used.
//
//   node tools/edge-data.js      (npm run build runs it)
//
// Every .json file under app/data, except the recordings' times
// (app/data/audio), which only a copy with recordings reads. Hard links, so
// the data is not on the disk twice. Cloudflare serves no file over 25 MiB,
// so a larger one stops the build here rather than failing on the site.

import { copyFileSync, linkSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const FROM = 'app/data';
const TO = 'dist/edge/data';
/** Cloudflare's limit for one file of a worker's assets. */
const MAX_BYTES = 25 * 1024 * 1024;
/** Folders under app/data that the site does not read. */
const LEFT_OUT = new Set(['audio']);

/**
 * Every .json file under a folder, but not in the folders left out.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function jsonFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return LEFT_OUT.has(relative(FROM, full)) ? [] : jsonFiles(full);
    return entry.name.endsWith('.json') ? [full] : [];
  });
}

/**
 * A hard link where the disk allows one, and a copy where it does not.
 *
 * @param {string} from
 * @param {string} to
 */
function linkOrCopy(from, to) {
  try {
    linkSync(from, to);
  } catch {
    copyFileSync(from, to);
  }
}

const files = jsonFiles(FROM);
const tooLarge = files.filter((file) => statSync(file).size > MAX_BYTES);
if (tooLarge.length) {
  console.error(`These data files are over Cloudflare's 25 MiB limit for one file:\n  ${tooLarge.join('\n  ')}`);
  process.exit(1);
}

rmSync(TO, { recursive: true, force: true });
for (const file of files) {
  const target = join(TO, relative(FROM, file));
  mkdirSync(dirname(target), { recursive: true });
  linkOrCopy(file, target);
}
console.log(`${files.length} data files linked into ${TO}`);
