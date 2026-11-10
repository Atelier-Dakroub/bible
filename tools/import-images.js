#!/usr/bin/env node
// Downloads the chosen images and writes their record.
//
//   node tools/import-images.js [picks file]
//
// The picks (tools/images.json) are chosen by hand: each image, the people,
// places and events it shows (Theographic ids), and a short caption. Two
// sources, both free of conditions:
//   matson  the G. Eric and Edith Matson Photograph Collection, Library of
//           Congress: photographs of the Holy Land, 1898-1946, "no known
//           restrictions on publication"
//   met     The Metropolitan Museum of Art, Open Access (CC0)
//
// The outputs:
//   app/public/images/<source>-<id>.jpg   each image, at most SIZE pixels on
//                                         its long side (macOS sips)
//   app/data/images.json                  the record: caption, title, date,
//                                         credit, link, size, entities
//
// It asks one thing at a time, with a pause, as a polite client should; an
// image already downloaded is not asked for again. If a server answers with
// a page instead (a bot check), it stops: it does not try to get past one.
// Needs macOS, for sips.

import { execFile } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const [picksFile = 'tools/images.json'] = process.argv.slice(2);
const OUT = 'app/public/images';
const RECORD = 'app/data/images.json';
const SIZE = 1100;
const PAUSE_MS = 1500;
const AGENT = 'bible-research-app (a personal study app; images fetched once)';

const picks = JSON.parse(await readFile(picksFile, 'utf8'));
await mkdir(OUT, { recursive: true });
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

/** @param {string} url */
async function json(url) {
  const response = await fetch(url, { headers: { 'User-Agent': AGENT } });
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.includes('json')) throw new Error(`${url} answered ${response.status} ${type}: stopping (a bot check, or the service is down)`);
  return response.json();
}

/**
 * Downloads an image and makes it smaller, unless it is there already.
 *
 * @param {string} url
 * @param {string} file
 */
async function image(url, file) {
  try {
    await access(file);
  } catch {
    const response = await fetch(url, { headers: { 'User-Agent': AGENT } });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !type.startsWith('image/')) throw new Error(`${url} answered ${response.status} ${type}: stopping`);
    const original = `${file}.original`;
    await writeFile(original, Buffer.from(await response.arrayBuffer()));
    await run('sips', ['-Z', String(SIZE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', original, '--out', file]);
    await run('rm', [original]);
    await pause();
  }
  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const width = Number(/pixelWidth: (\d+)/.exec(stdout)?.[1] ?? 0);
  const height = Number(/pixelHeight: (\d+)/.exec(stdout)?.[1] ?? 0);
  return { width, height };
}

const record = [];

for (const pick of picks.matson) {
  const id = `matson-${pick.pk}`;
  const file = path.join(OUT, `${id}.jpg`);
  const size = await image(pick.image, file);
  record.push({
    id,
    file: `/images/${id}.jpg`,
    ...size,
    caption: pick.caption,
    title: pick.title,
    date: String(pick.date).replace(/^\[|\]$/g, ''),
    credit: 'G. Eric and Edith Matson Photograph Collection, Library of Congress. No known restrictions on publication.',
    url: `https://www.loc.gov/pictures/item/${pick.pk}/`,
    entities: pick.entities,
  });
  console.log(`${id} ${size.width}×${size.height} ${pick.caption}`);
}

for (const pick of picks.met) {
  const id = `met-${pick.id}`;
  const file = path.join(OUT, `${id}.jpg`);
  const known = record.length;
  const object = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${pick.id}`);
  await pause();
  if (!object.isPublicDomain || !object.primaryImageSmall) {
    console.log(`${id}: not in the public domain, or no image; left out`);
    continue;
  }
  const size = await image(object.primaryImageSmall, file);
  record.push({
    id,
    file: `/images/${id}.jpg`,
    ...size,
    caption: pick.caption,
    title: [object.title, object.culture].filter(Boolean).join(', '),
    date: object.objectDate ?? '',
    credit: `The Metropolitan Museum of Art, ${object.creditLine ?? 'Open Access'}. Public domain (CC0).`,
    url: object.objectURL,
    entities: pick.entities,
  });
  console.log(`${id} ${size.width}×${size.height} ${pick.caption}${record.length === known ? '' : ''}`);
}

await writeFile(RECORD, `${JSON.stringify(record, null, 1)}\n`);
console.log(`${record.length} images written to ${OUT}, their record to ${RECORD}.`);
