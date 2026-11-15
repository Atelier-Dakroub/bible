// tools/lib/commentary-markup.js and tools/lib/sword.js: the commentaries'
// markup as the app's blocks, and where a verse is in a SWORD module.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { blocksOf, decode, osisAddress } from '../tools/lib/commentary-markup.js';
import { verseIndex } from '../tools/lib/sword.js';

const books = JSON.parse(readFileSync('app/data/kjv/books.json', 'utf8'));

test('OSIS references become addresses', () => {
  assert.equal(osisAddress('John.3.16', books), 'JHN.3.16');
  assert.equal(osisAddress('John.12.32-John.12.33', books), 'JHN.12.32-33');
  assert.equal(osisAddress('1John.5.20', books), '1JN.5.20');
  assert.equal(osisAddress('Ps.23', books), 'PSA.23');
  assert.equal(osisAddress('Nope.1.1', books), '');
});

test('OSIS markup: paragraphs, bold, references and headings', () => {
  const markup =
    '<title type="x-s2">Chapter 3</title> <div sID="g1" type="x-p"/><hi type="bold">14-16. And as Moses, &amp;c.--</hi>Here, as in <reference osisRef="John.3.12">Joh 3:12</reference>.<div eID="g1" type="x-p"/>';
  assert.deepEqual(blocksOf(markup, books), [
    { h: 'Chapter 3' },
    { p: [{ b: '14-16. And as Moses, &c.--' }, 'Here, as in ', { ref: 'JHN.3.12', t: 'Joh 3:12' }, '.'] },
  ]);
});

test('ThML markup: a reference named by its text, and breaks', () => {
  assert.deepEqual(blocksOf('He gave himself, <scripRef>Gal 4:4</scripRef>, truly.<br /> Next', books), [
    { p: ['He gave himself, ', { ref: 'GAL.4.4', t: 'Gal 4:4' }, ', truly.'] },
    { p: ['Next'] },
  ]);
});

test('a note of the editor, a table row, and verse numbers run together', () => {
  assert.deepEqual(blocksOf('Hebrew <note type="x-footnote">ed. note: a copy.</note>; so', books), [{ p: ['Hebrew ', { note: 'ed. note: a copy.' }, '; so'] }]);
  assert.deepEqual(blocksOf('<table><row><cell>The discourse.</cell><cell>(1-21)</cell></row></table>', books), [{ p: ['The discourse. (1-21)'] }]);
  assert.deepEqual(blocksOf('everlasting life.17. For God', books), [{ p: ['everlasting life. 17. For God'] }]);
  assert.equal(decode('&#8217;&#x2014;&lt;'), '’—<');
});

test('the verse index counts a heading before each book and chapter', () => {
  const index = verseIndex(books.slice(0, 1));
  // Two headings of the module and testament, the book's, the chapter's.
  assert.equal(index.get('GEN.1.1'), 4);
  // Chapter 1 has 31 verses, then chapter 2's heading.
  assert.equal(index.get('GEN.2.1'), 4 + 31 + 1);
});
