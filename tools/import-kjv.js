#!/usr/bin/env node
// Converts the KJV export in github.com/joe-dakroub/data_bible-json into one
// compact file per book.
//
//   node tools/import-kjv.js <path to data_bible-json> [output directory]
//
// The output directory defaults to app/data/kjv. The export holds one file per
// verse, each with a copy of the copyright notice and an API.Bible tracking
// script (`meta.fums`). This keeps the text, the markup classes and the
// versification mapping, and removes everything else.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseContent } from './lib/kjv-content.js';

const [source, out = 'app/data/kjv'] = process.argv.slice(2);

if (!source) {
  console.error('Usage: node tools/import-kjv.js <path to data_bible-json> [output directory]');
  process.exit(1);
}

/** @param {string} file */
async function readJSON(file) {
  return JSON.parse(await readFile(path.join(source, file), 'utf8'));
}

await mkdir(out, { recursive: true });

const books = (await readJSON('books.json')).data;
const index = [];
let chapterCount = 0;
let verseCount = 0;
let remapCount = 0;

for (const book of books) {
  const chapterList = (await readJSON(path.join(book.id, 'chapters.json'))).data;
  const chapters = [];

  for (const chapter of chapterList) {
    // The intro is the book's title page, which `nameLong` already holds.
    if (chapter.number === 'intro') continue;

    const verseList = (await readJSON(path.join(book.id, chapter.id, 'verses.json'))).data;
    const verses = [];

    for (const entry of verseList) {
      const verse = (await readJSON(path.join(book.id, chapter.id, `${entry.id}.json`))).data;
      const number = verse.id.split('.').at(-1);
      const record = { n: Number(number), id: verse.id };

      // `orgId` is the verse's number in the original-language versification.
      // It is kept only where it differs, which is 1,969 verses.
      if (verse.orgId !== verse.id) {
        record.org = verse.orgId;
        remapCount += 1;
      }

      record.blocks = parseContent(verse.content, number);
      verses.push(record);
    }

    chapters.push({ n: Number(chapter.number), verses });
    chapterCount += 1;
    verseCount += verses.length;
  }

  const file = {
    id: book.id,
    name: book.name,
    nameLong: book.nameLong,
    abbreviation: book.abbreviation,
    chapters,
  };
  await writeFile(path.join(out, `${book.id}.json`), JSON.stringify(file));

  index.push({
    id: book.id,
    name: book.name,
    nameLong: book.nameLong,
    abbreviation: book.abbreviation,
    verses: chapters.map((chapter) => chapter.verses.length),
  });
}

const provenance = {
  translation: 'King James Version',
  source: 'https://github.com/joe-dakroub/data_bible-json',
  origin: 'An export from API.Bible, bible id de4e12af7f28f599-02',
  license:
    'The KJV text is in the public domain, except in the United Kingdom, where the Crown letters patent restrict printing.',
  note: 'This data came through API.Bible. Read their terms, or rebuild it from a public-domain source, before it is published on a public site.',
};

await writeFile(path.join(out, 'books.json'), JSON.stringify(index, null, 2) + '\n');
await writeFile(path.join(out, 'source.json'), JSON.stringify(provenance, null, 2) + '\n');

console.log(
  `${books.length} books, ${chapterCount} chapters, ${verseCount} verses, ${remapCount} remapped. Written to ${out}.`,
);
