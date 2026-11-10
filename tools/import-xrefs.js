#!/usr/bin/env node
// Converts the OpenBible.info cross-references into one file per source book.
//
//   node tools/import-xrefs.js <path to cross_references.txt> [output directory]
//
// Source: https://a.openbible.info/data/cross-references.zip, CC BY, from the
// Treasury of Scripture Knowledge with votes from OpenBible.info's readers.
// The output directory defaults to app/data/xrefs.
//
// Each file maps a verse address to its references, best first:
//   { "JHN.3.16": [["ROM.5.8", 315], ["1JN.4.9-10", 250], ...] }
//
// What is dropped, and why:
//   - a reference with zero or fewer votes: readers judged it wrong;
//   - a reference to a verse the KJV data does not have.
// A target range that runs into a later chapter keeps its whole range, as an
// address can cross a chapter (JHN.3.36-4.2); one that runs into another
// book stops at the end of its first chapter.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { OSIS, ids } from './lib/osis.js';

const [source, out = 'app/data/xrefs'] = process.argv.slice(2);

if (!source) {
  console.error('Usage: node tools/import-xrefs.js <path to cross_references.txt> [output directory]');
  process.exit(1);
}



const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
/** @type {Map<string, number[]>} book id to the verse count of each chapter */
const counts = new Map(books.map((book) => [book.id, book.verses]));

/**
 * `Prov.8.22` to { book, chapter, verse }, or null when the KJV has no such verse.
 *
 * @param {string} osis
 */
function verse(osis) {
  const [name, chapter, number] = osis.split('.');
  const book = ids.get(name);
  const chapterCount = book ? counts.get(book)?.[Number(chapter) - 1] : undefined;
  if (!book || !chapterCount || Number(number) < 1 || Number(number) > chapterCount) return null;
  return { book, chapter: Number(chapter), verse: Number(number), last: chapterCount };
}

/**
 * `Prov.8.22-Prov.8.30` to `PRO.8.22-30`, `John.3.36-John.4.2` to
 * `JHN.3.36-4.2`, or null.
 *
 * @param {string} osis
 */
function target(osis) {
  const [startText, endText] = osis.split('-');
  const start = verse(startText);
  if (!start) return null;
  const base = `${start.book}.${start.chapter}.${start.verse}`;
  if (!endText) return base;
  const end = verse(endText);
  if (!end) return base;
  if (end.book === start.book && end.chapter > start.chapter) return `${base}-${end.chapter}.${end.verse}`;
  const sameChapter = end.book === start.book && end.chapter === start.chapter;
  const to = sameChapter ? end.verse : start.last;
  return to > start.verse ? `${base}-${to}` : base;
}

const lines = (await readFile(source, 'utf8')).split('\n').slice(1);
/** @type {Map<string, Map<string, [string, number][]>>} book to verse to references */
const byBook = new Map();
let kept = 0;
let dropped = 0;

for (const line of lines) {
  if (!line.trim()) continue;
  const [fromText, toText, votesText] = line.split('\t');
  const votes = Number(votesText);
  const from = verse(fromText);
  const to = target(toText);
  if (!from || !to || !(votes > 0)) {
    dropped += 1;
    continue;
  }
  const address = `${from.book}.${from.chapter}.${from.verse}`;
  let verses = byBook.get(from.book);
  if (!verses) byBook.set(from.book, (verses = new Map()));
  let list = verses.get(address);
  if (!list) verses.set(address, (list = []));
  list.push([to, votes]);
  kept += 1;
}

await mkdir(out, { recursive: true });
for (const [book, verses] of byBook) {
  const file = Object.fromEntries(
    [...verses].map(([address, list]) => [address, list.sort((a, b) => b[1] - a[1])]),
  );
  await writeFile(path.join(out, `${book}.json`), JSON.stringify(file));
}

await writeFile(
  path.join(out, 'source.json'),
  JSON.stringify(
    {
      name: 'OpenBible.info cross-references',
      source: 'https://a.openbible.info/data/cross-references.zip',
      origin: 'The Treasury of Scripture Knowledge, with votes from OpenBible.info readers',
      license: 'CC BY: credit OpenBible.info where the references are shown.',
    },
    null,
    2,
  ) + '\n',
);

console.log(`${kept} references kept, ${dropped} dropped, ${byBook.size} books. Written to ${out}.`);
