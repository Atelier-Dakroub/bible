import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatReference, parseAddress, parseReference, toAddress } from '../app/lib/reference.js';

const books = JSON.parse(readFileSync(new URL('../app/data/kjv/books.json', import.meta.url), 'utf8'));
const typed = (text) => {
  const ref = parseReference(text, books);
  return ref && toAddress(ref);
};

test('typed references find their book by name, prefix, abbreviation or alias', () => {
  assert.equal(typed('John 3:16'), 'JHN.3.16');
  assert.equal(typed('jn 3:16-18'), 'JHN.3.16-18');
  assert.equal(typed('Gen 1'), 'GEN.1');
  assert.equal(typed('1 cor 13'), '1CO.13');
  assert.equal(typed('1cor 13:4'), '1CO.13.4');
  assert.equal(typed('I Corinthians 13'), '1CO.13');
  assert.equal(typed('Ps 23'), 'PSA.23');
  assert.equal(typed('psalm 119:105'), 'PSA.119.105');
  assert.equal(typed('Song of Solomon 2:1'), 'SNG.2.1');
  assert.equal(typed('Rev. 22:21'), 'REV.22.21');
  assert.equal(typed('joh 1:1'), 'JHN.1.1');
});

test('text that is not a reference, or names a missing place, is refused', () => {
  assert.equal(typed('in the beginning'), null);
  assert.equal(typed('light'), null);
  assert.equal(typed('John 22'), null);
  assert.equal(typed('John 3:99'), null);
  assert.equal(typed('John 3:18-16'), null);
});

test('a range past the end of the chapter stops at the last verse', () => {
  assert.equal(typed('John 3:30-99'), 'JHN.3.30-36');
});

test('an address parses back to the same reference', () => {
  for (const address of ['JHN.3', 'JHN.3.16', 'JHN.3.16-18', '1CO.13.4-7']) {
    assert.equal(toAddress(/** @type {any} */ (parseAddress(address, books))), address);
  }
  assert.equal(parseAddress('XYZ.1', books), null);
  assert.equal(parseAddress('john 3', books), null);
});

test('a reference reads as people write it', () => {
  assert.equal(formatReference({ book: 'JHN', chapter: 3, from: 16, to: 18 }, books), 'John 3:16–18');
  assert.equal(formatReference({ book: 'PSA', chapter: 23 }, books), 'Psalm 23');
});

test('a cross-reference keeps its whole range when it runs into the next chapter', async () => {
  const { referenceResults } = await import('../app/data/bible.js');
  const results = await referenceResults('JHN.1.18');
  // Joshua 5:13–6:2, the captain of the Lord's host, once cut at 5:15.
  assert.ok(results.results.some((result) => result.address === 'JOS.5.13-6.2'));
});

test('a book of one chapter is cited by verse alone', () => {
  assert.equal(typed('Jude 5'), 'JUD.1.5');
  assert.equal(typed('Obadiah 3'), 'OBA.1.3');
  assert.equal(typed('3 John 2'), '3JN.1.2');
  assert.equal(typed('Jude 3-5'), 'JUD.1.3-5');
  assert.equal(typed('Jude 1:5'), 'JUD.1.5');
  assert.equal(typed('Jude 30'), null);
  assert.equal(typed('John 3-4'), null);
});
