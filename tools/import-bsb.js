#!/usr/bin/env node
// Converts the Berean Standard Bible into one file per book, by verse address,
// for the parallel view.
//
//   node tools/import-bsb.js <usfm directory> [output directory]
//
// Source: eBible.org engbsb_usfm.zip. Public domain.
// The output directory defaults to app/data/bsb:
//   <BOOK>.json   { "JHN.3.16": [{ "style": "p", "text": "For God so loved ..." }], ... }
//
// A verse is a list of blocks, each a paragraph style and plain text: `p` for
// prose, `q1` and `q2` for lines of poetry, `d` for a psalm title. Footnotes,
// section headings and Strong's tags are left out; the parallel view shows the
// text. A psalm title, which the USFM puts before verse 1, joins verse 1, as it
// does in the KJV data.
//
// The verse addresses are the KJV data's. A verse the BSB leaves out of its
// main text, such as Matthew 17:21, has no entry.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [usfmDir, out = 'app/data/bsb'] = process.argv.slice(2);

if (!usfmDir) {
  console.error('Usage: node tools/import-bsb.js <usfm directory> [output directory]');
  process.exit(1);
}

// Paragraph markers and the block style each starts. Anything else that starts
// a line (headings, references, book titles) is not verse text.
const BLOCKS = { p: 'p', m: 'p', pmo: 'p', pc: 'p', li1: 'q1', li2: 'q2', q1: 'q1', q2: 'q2', qr: 'q1', d: 'd' };
const SKIP = /^\\(id|h|toc\d|mt\d?|ms\d?|mr|s\d?|r|b|qa)\b/;

/** @param {string} text */
function clean(text) {
  return text
    .replace(/\\f .*?\\f\*/g, '')
    .replace(/\\\+?w\s+([^|\\]*?)\|[^\\]*?\\\+?w\*/g, '$1')
    .replace(/\\\+?[a-z]+\d?\*?/g, '')
    .replace(/\s+/g, ' ');
}

const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
const files = await readdir(usfmDir);
await mkdir(out, { recursive: true });

let total = 0;
const missing = [];
const loaderLines = [];

for (const { id, verses: counts } of books) {
  const file = files.find((name) => name.slice(3, 6) === id && name.endsWith('.usfm'));
  if (!file) throw new Error(`No USFM file for ${id}`);
  const lines = (await readFile(path.join(usfmDir, file), 'utf8')).replace(/\\f .*?\\f\*/gs, '').split('\n');

  /** @type {Record<string, { style: string, text: string }[]>} */
  const result = {};
  let chapter = 0;
  /** @type {{ style: string, text: string }[] | null} */
  let verse = null;
  let style = 'p';
  /** @type {{ style: string, text: string }[]} the title before verse 1, if any */
  let pending = [];

  // A paragraph marker begins a new block, even of the same style: two
  // lines of poetry in a row (\q2, \q2) are two lines, not one run of text
  // ("righteousness" and "for the sake" were once joined). Text that goes on
  // over a line break, with no marker, keeps a space at the break.
  let fresh = false;
  let broken = false;

  /** @param {string} text */
  const add = (text) => {
    const words = clean(text);
    if (!words.trim()) return;
    const target = verse ?? pending;
    const last = target.at(-1);
    if (last && last.style === style && !fresh) last.text += broken && !/\s$/.test(last.text) && !/^\s/.test(words) ? ` ${words}` : words;
    else target.push({ style, text: words.trimStart() });
    fresh = false;
    broken = false;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const chapterMatch = /^\\c\s+(\d+)/.exec(line);
    if (chapterMatch) {
      chapter = Number(chapterMatch[1]);
      verse = null;
      pending = [];
      continue;
    }
    if (!line || SKIP.test(line) || chapter === 0) continue;

    let rest = line;
    broken = true;
    const marker = /^\\([a-z]+\d?)\s?/.exec(rest);
    if (marker && marker[1] !== 'v') {
      const next = BLOCKS[/** @type {keyof typeof BLOCKS} */ (marker[1])];
      if (!next) continue;
      style = next;
      fresh = true;
      rest = rest.slice(marker[0].length);
      if (style === 'd') verse = null;
    }

    for (const piece of rest.split(/(\\v\s+\d+\s?)/)) {
      const verseMatch = /^\\v\s+(\d+)\s?$/.exec(piece);
      if (verseMatch) {
        verse = verseMatch[1] === '1' ? pending : [];
        if (verseMatch[1] !== '1') pending = [];
        if (style === 'd') style = 'q1';
        result[`${id}.${chapter}.${verseMatch[1]}`] = verse;
        continue;
      }
      add(piece);
    }
  }

  for (const blocks of Object.values(result)) {
    for (const block of blocks) block.text = block.text.trim();
  }
  counts.forEach((count, i) => {
    for (let n = 1; n <= count; n += 1) if (!result[`${id}.${i + 1}.${n}`]?.length) missing.push(`${id}.${i + 1}.${n}`);
  });
  total += Object.keys(result).length;
  await writeFile(path.join(out, `${id}.json`), JSON.stringify(result));
  loaderLines.push(`  '${id}': () => json('bsb/${id}.json'),`);
}

await writeFile(
  path.join(out, 'index.js'),
  ['// Written by tools/import-bsb.js. Do not edit.', '', "import { json } from '../load.js';", '', 'export const loaders = {', ...loaderLines, '};', ''].join('\n'),
);
await writeFile(
  path.join(out, 'source.json'),
  JSON.stringify(
    {
      translation: 'Berean Standard Bible',
      source: 'https://eBible.org/Scriptures/engbsb_usfm.zip',
      license: 'Public domain.',
      note: 'Verses the BSB leaves out of its main text have no entry.',
    },
    null,
    2,
  ) + '\n',
);

console.log(`${total} verses written to ${out}. ${missing.length} KJV verses have no BSB text: ${missing.slice(0, 20).join(' ')}${missing.length > 20 ? ' …' : ''}`);
