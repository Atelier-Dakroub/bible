import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passage, plainText, search } from '../app/data/bible.js';
import { pan } from '../app/lib/gesture.js';
import { parse } from '../app/lib/workspace.js';

test('a passage holds the verses of its range', async () => {
  const { title, verses } = await passage({ book: 'JHN', chapter: 3, from: 16, to: 18 });
  assert.equal(title, 'John 3:16–18');
  assert.deepEqual(verses.map((verse) => verse.id), ['JHN.3.16', 'JHN.3.17', 'JHN.3.18']);
});

test('a whole chapter has every verse', async () => {
  const { verses } = await passage({ book: 'PSA', chapter: 117 });
  assert.equal(verses.length, 2);
  assert.match(plainText(verses[0]), /^O praise the LORD/);
});

test('a reference query gives the passage', async () => {
  const found = await search('jn 3:16');
  assert.equal(found.results.length, 1);
  assert.equal(found.results[0].address, 'JHN.3.16');
  assert.equal(found.summary, 'Passage, 1 verse');
});

test('words find verses that hold all of them, and mark whole words', async () => {
  const found = await search('beginning word');
  assert.ok(found.results.some((result) => result.address === 'JHN.1.1'));
  const john = found.results.find((result) => result.address === 'JHN.1.1');
  const marked = john?.parts.filter((part) => part.hit).map((part) => part.text);
  assert.deepEqual(marked, ['beginning', 'Word', 'Word', 'Word']);
});

test('a word matches the start of a word', async () => {
  const found = await search('begin');
  assert.ok(found.results.some((result) => result.address === 'GEN.1.1'));
});

test('a short word matches only itself, and the phrase comes first', async () => {
  const found = await search('in the beginning');
  assert.equal(found.results[0].address, 'GEN.1.1');
  const marked = found.results.flatMap((result) => result.parts.filter((part) => part.hit).map((part) => part.text.toLowerCase()));
  assert.ok(!marked.includes('they'));
  assert.ok(!marked.includes('into'));
});

test('a quoted phrase must appear as written', async () => {
  const found = await search('"Jesus wept"');
  assert.deepEqual(found.results.map((result) => result.address), ['JHN.11.35']);
});

test('a common word is cut to the limit and says so', async () => {
  const found = await search('the');
  assert.equal(found.results.length, 50);
  assert.match(found.summary, /^The first 50 of [\d,]+ verses$/);
});

test('the table pans by the mean move of the fingers in both frames', () => {
  const before = new Map([[1, { x: 0, y: 0 }], [2, { x: 10, y: 0 }]]);
  const after = new Map([[1, { x: 4, y: 2 }], [2, { x: 16, y: 2 }], [3, { x: 99, y: 99 }]]);
  assert.deepEqual(pan(before, after), { x: 5, y: 2 });
});

test('a broken or old workspace reads as an empty table', () => {
  assert.deepEqual(parse(null), { offset: { x: 0, y: 0 }, cards: [] });
  assert.deepEqual(parse('not json'), { offset: { x: 0, y: 0 }, cards: [] });
  const kept = parse(
    JSON.stringify({
      offset: { x: 5, y: 6 },
      cards: [{ address: 'JHN.3.16', matrix: { a: 1, b: 0, c: 0, d: 1, e: 2, f: 3 } }, { address: 'BAD' }],
    }),
  );
  assert.deepEqual(kept.offset, { x: 5, y: 6 });
  assert.deepEqual(kept.cards.map((card) => card.address), ['JHN.3.16']);
});
