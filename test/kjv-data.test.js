// Checks the imported files in app/data/kjv, so a rerun of the import that
// loses or changes text fails here.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { BLOCK_STYLES, MARKS, plainText } from '../tools/lib/usfm.js';

const read = (name) => JSON.parse(readFileSync(new URL(`../app/data/kjv/${name}.json`, import.meta.url), 'utf8'));
const index = read('books');
const books = index.map((entry) => read(entry.id));
const verses = books.flatMap((book) => book.chapters.flatMap((chapter) => chapter.verses));

test('the canon is complete', () => {
  assert.equal(books.length, 66);
  assert.equal(books.reduce((sum, book) => sum + book.chapters.length, 0), 1189);
  assert.equal(verses.length, 31102);
});

test('the index counts the same verses as the books', () => {
  for (const [i, entry] of index.entries()) {
    assert.deepEqual(entry.verses, books[i].chapters.map((chapter) => chapter.verses.length), entry.id);
  }
});

test('every verse has text, one number, and only known styles', () => {
  for (const verse of verses) {
    assert.ok(plainText(verse.blocks).length > 0, verse.id);
    assert.equal(verse.blocks.filter((block) => block.numbered).length, 1, verse.id);
    for (const block of verse.blocks) {
      assert.ok(BLOCK_STYLES.has(block.style), verse.id);
      for (const run of block.runs) for (const mark of run.marks) assert.ok(MARKS.has(mark), verse.id);
    }
  }
});

test('the source is the public-domain eBible text', () => {
  const source = JSON.parse(readFileSync(new URL('../app/data/kjv/source.json', import.meta.url), 'utf8'));
  assert.match(source.source, /eBible\.org\/Scriptures\/eng-kjv2006_usfm\.zip$/);
  assert.match(source.license, /^Public domain/);
});

test('known verses read as printed', () => {
  const text = (id) => plainText(verses.find((verse) => verse.id === id).blocks);
  assert.equal(text('GEN.1.1'), 'In the beginning God created the heaven and the earth.');
  assert.equal(text('JHN.11.35'), 'Jesus wept.');
  assert.equal(text('REV.22.21'), 'The grace of our Lord Jesus Christ be with you all. Amen.');
});
