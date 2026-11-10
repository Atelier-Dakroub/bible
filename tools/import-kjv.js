#!/usr/bin/env node
// Builds the KJV data from eBible.org's eng-kjv2006 USFM: one file per book.
//
//   node tools/import-kjv.js <usfm directory> [output directory]
//
// Source: https://eBible.org/Scriptures/eng-kjv2006_usfm.zip. Public domain
// (outside the United Kingdom, where the Crown letters patent restrict
// printing). The output directory defaults to app/data/kjv. The parser and the
// format are in tools/lib/usfm.js.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OSIS } from './lib/osis.js';
import { readBook } from './lib/usfm.js';

const [usfmDir, out = 'app/data/kjv'] = process.argv.slice(2);

if (!usfmDir) {
  console.error('Usage: node tools/import-kjv.js <usfm directory> [output directory]');
  process.exit(1);
}

/**
 * The value of a header line, such as \toc1, with its Strong's tags removed.
 *
 * @param {string} usfm
 * @param {string} marker
 */
function header(usfm, marker) {
  const match = new RegExp(`^\\\\${marker}\\s+(.*)$`, 'm').exec(usfm);
  return (match?.[1] ?? '').replace(/\\\+?w\s+([^|\\]*?)\|[^\\]*?\\\+?w\*/g, '$1').trim();
}

const files = await readdir(usfmDir);
await mkdir(out, { recursive: true });

const index = [];
let chapterCount = 0;
let verseCount = 0;

for (const [, id] of OSIS) {
  const file = files.find((name) => name.slice(3, 6) === id && name.endsWith('.usfm'));
  if (!file) throw new Error(`No USFM file for ${id}`);
  const usfm = await readFile(path.join(usfmDir, file), 'utf8');
  const chapters = readBook(usfm, id);

  const book = {
    id,
    name: header(usfm, 'h'),
    nameLong: header(usfm, 'toc1'),
    abbreviation: header(usfm, 'toc3'),
    chapters,
  };
  await writeFile(path.join(out, `${id}.json`), JSON.stringify(book));
  index.push({
    id,
    name: book.name,
    nameLong: book.nameLong,
    abbreviation: book.abbreviation,
    verses: chapters.map((chapter) => chapter.verses.length),
  });
  chapterCount += chapters.length;
  verseCount += chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0);
}

await writeFile(path.join(out, 'books.json'), JSON.stringify(index, null, 2) + '\n');
await writeFile(
  path.join(out, 'source.json'),
  JSON.stringify(
    {
      translation: 'King James Version',
      source: 'https://eBible.org/Scriptures/eng-kjv2006_usfm.zip',
      license:
        'Public domain, except in the United Kingdom, where the Crown letters patent restrict printing.',
    },
    null,
    2,
  ) + '\n',
);

console.log(`${index.length} books, ${chapterCount} chapters, ${verseCount} verses. Written to ${out}.`);
