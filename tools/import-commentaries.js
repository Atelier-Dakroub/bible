#!/usr/bin/env node
// Converts five public-domain commentaries from CrossWire's SWORD modules
// into one file per commentary and book, by verse address.
//
//   node tools/import-commentaries.js <folder of the unpacked modules> [output directory]
//
// The folder holds each module unpacked in a folder of its name: MHCC/,
// JFB/, Wesley/, Geneva/, Catena/, each from crosswire.org/ftpmirror/pub/
// sword/packages/rawzip/<name>.zip. The output directory defaults to
// app/data/commentaries:
//
//   <id>/<BOOK>.json   [{ "from": "JHN.3.1", "to": "JHN.3.8", "blocks": [...] }, ...]
//   source.json        each commentary: its name, its source, and its books
//
// An entry is the comment on one verse, or on a range ("to") that the module
// writes once. Its blocks are headings and paragraphs of runs
// (tools/lib/commentary-markup.js). A book's introduction comes with its
// first verse, as the modules have it.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { openTestament, verseIndex } from './lib/sword.js';
import { blocksOf } from './lib/commentary-markup.js';

const [modules, out = 'app/data/commentaries'] = process.argv.slice(2);
if (!modules) {
  console.error('Usage: node tools/import-commentaries.js <folder of the unpacked modules> [output directory]');
  process.exit(1);
}

const COMMENTARIES = [
  { id: 'mhcc', module: 'MHCC', wide: false, name: "Matthew Henry's Concise Commentary", short: 'Matthew Henry', year: '1706–1721' },
  { id: 'jfb', module: 'JFB', wide: true, name: 'Jamieson, Fausset and Brown, Commentary Critical and Explanatory', short: 'Jamieson-Fausset-Brown', year: '1871' },
  { id: 'wesley', module: 'Wesley', wide: false, name: "John Wesley's Explanatory Notes", short: 'Wesley', year: '1754–1765' },
  { id: 'geneva', module: 'Geneva', wide: false, name: 'The Geneva Bible notes', short: 'Geneva notes', year: '1599' },
  { id: 'catena', module: 'Catena', wide: false, name: 'Catena Aurea, Thomas Aquinas, translated by John Henry Newman', short: 'Catena Aurea', year: '1842' },
];

const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
const firstNt = books.findIndex((/** @type {{ id: string }} */ book) => book.id === 'MAT');
const testaments = /** @type {const} */ ([['ot', books.slice(0, firstNt)], ['nt', books.slice(firstNt)]]);
const sources = [];

for (const commentary of COMMENTARIES) {
  const dir = path.join(modules, commentary.module, 'modules/comments/zcom', commentary.module.toLowerCase());
  await mkdir(path.join(out, commentary.id), { recursive: true });
  /** @type {string[]} */
  const written = [];
  let entries = 0;
  for (const [testament, list] of testaments) {
    const module = openTestament(dir, testament, commentary.wide);
    if (!module) continue;
    /** @type {Map<string, { from: string, to?: string, blocks: any[] }[]>} */
    const byBook = new Map();
    let lastKey = '';
    /** @type {{ from: string, to?: string, blocks: any[] } | null} */
    let current = null;
    for (const [address, n] of verseIndex(list)) {
      const found = module.entry(n);
      if (!found) {
        lastKey = '';
        current = null;
        continue;
      }
      const book = address.split('.')[0];
      // The same text as the verse before, in the same book: a range.
      if (found.key === lastKey && current && current.from.startsWith(`${book}.`)) {
        current.to = address;
        continue;
      }
      lastKey = found.key;
      const blocks = blocksOf(found.text, books);
      if (!blocks.length) {
        current = null;
        continue;
      }
      current = { from: address, blocks };
      if (!byBook.has(book)) byBook.set(book, []);
      /** @type {any[]} */ (byBook.get(book)).push(current);
    }
    for (const [book, list] of byBook) {
      const kept = list.map(({ from, to, blocks }) => (to ? { from, to, blocks } : { from, blocks }));
      entries += kept.length;
      written.push(book);
      await writeFile(path.join(out, commentary.id, `${book}.json`), JSON.stringify(kept));
    }
  }
  sources.push({
    id: commentary.id,
    name: commentary.name,
    short: commentary.short,
    year: commentary.year,
    source: `https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=${commentary.module}`,
    license: 'Public domain.',
    books: written,
  });
  console.log(`${commentary.id}: ${entries} entries in ${written.length} books`);
}

await writeFile(path.join(out, 'source.json'), `${JSON.stringify(sources, null, 2)}\n`);
