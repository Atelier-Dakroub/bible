import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { passage, phrase } from '../app/data/bible.js';
import { createHistory } from '../app/lib/history.js';
import { nextType, TYPES } from '../app/lib/links.js';
import { formatReference, parseAddress, parseReference, stepAddress, toAddress, versesIn } from '../app/lib/reference.js';
import { parseSpanAddress, spanAddress, toggle } from '../app/lib/words.js';
import { diffCards, empty, fromFile, parse, snapshot, toFile } from '../app/lib/workspace.js';

const books = JSON.parse(readFileSync(new URL('../app/data/kjv/books.json', import.meta.url), 'utf8'));
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

test('undo steps back through the changes, and redo forward again', () => {
  const history = createHistory();
  history.reset('a');
  assert.equal(history.canUndo(), false);
  assert.equal(history.record('a'), false, 'the same state is not a change');
  history.record('b');
  history.record('c');
  assert.equal(history.undo(), 'b');
  assert.equal(history.undo(), 'a');
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), 'b');
  history.record('d');
  assert.equal(history.canRedo(), false, 'a new change drops what was undone');
  assert.equal(history.undo(), 'b');
});

test('the history keeps only so many steps', () => {
  const history = createHistory(2);
  history.reset('0');
  for (const step of ['1', '2', '3']) history.record(step);
  assert.equal(history.undo(), '2');
  assert.equal(history.undo(), '1');
  assert.equal(history.undo(), null);
});

test('a snapshot leaves out the pan and the order the cards arrived in', () => {
  const one = { ...empty(), offset: { x: 5, y: 5 }, cards: [{ id: 'b', address: 'JHN.3', matrix }, { id: 'a', address: 'GEN.1', matrix }] };
  const two = { ...empty(), cards: [{ id: 'a', address: 'GEN.1', matrix }, { id: 'b', address: 'JHN.3', matrix }] };
  assert.equal(snapshot(one), snapshot(two));
});

test('the cards to move, fetch and take away, to show another state', () => {
  const now = [
    { id: 'a', address: 'GEN.1', matrix },
    { id: 'b', address: 'JHN.3', matrix },
    { id: 'c', address: 'ROM.8', matrix, version: 'kjv' },
  ];
  const then = [
    { id: 'a', address: 'GEN.1', matrix: { ...matrix, e: 9 } },
    { id: 'c', address: 'ROM.8', matrix, version: 'both' },
    { id: 'd', address: 'PSA.23', matrix },
  ];
  const { move, add, remove } = diffCards(now, then);
  assert.deepEqual(move.map((card) => card.id), ['a']);
  assert.deepEqual(add.map((card) => card.id), ['c', 'd']);
  assert.deepEqual(remove, ['b', 'c']);
});

test('stored cards get ids, and highlights, links and notes keep only what is valid', () => {
  const kept = parse(
    JSON.stringify({
      cards: [{ address: 'JHN.3', matrix }, { id: 'x', address: 'GEN.1', matrix, sync: true }, { id: 'x', address: 'ROM.8', matrix }],
      highlights: [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4', style: 'box' }, { from: 'JHN.3.17.w1', to: 'JHN.3.17.w2', style: 'glitter' }],
      links: [{ a: { from: 'JHN.3.16.w1', to: 'JHN.3.16.w1' }, b: { from: 'GEN.1.1.w1', to: 'GEN.1.1.w1' }, type: 'fulfills' }],
      notes: [{ id: 'n1', text: 'Love', quotes: [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4' }, { from: 'no', to: 'no' }] }, { text: 'no id' }],
    }),
  );
  const ids = kept.cards.map((card) => card.id);
  assert.equal(new Set(ids).size, 3, 'every card has its own id');
  assert.equal(kept.cards[1].sync, true);
  assert.deepEqual(kept.highlights.map((each) => each.style), ['box', undefined]);
  assert.equal(kept.links[0].type, 'fulfills');
  assert.deepEqual(kept.notes, [{ id: 'n1', text: 'Love', quotes: [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4' }] }]);
});

test('a workspace goes out to a file and comes back the same', () => {
  const workspace = { ...empty(), cards: [{ id: 'a', address: 'GEN.1', matrix, version: 'bsb' }], notes: [{ id: 'n', text: 'x', quotes: [] }] };
  const back = fromFile(toFile('Genesis', workspace));
  assert.equal(back?.name, 'Genesis');
  assert.deepEqual(back?.workspace, workspace);
  assert.equal(fromFile('{"something": "else"}'), null);
  assert.equal(fromFile('not json'), null);
});

test('marking a highlight again in another style restyles it, and in the same style removes it', () => {
  let list = toggle([], 'JHN.3.16.w1', 'JHN.3.16.w4');
  assert.deepEqual(list, [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4' }]);
  list = toggle(list, 'JHN.3.16.w1', 'JHN.3.16.w4', 'underline');
  assert.deepEqual(list, [{ from: 'JHN.3.16.w1', to: 'JHN.3.16.w4', style: 'underline' }]);
  list = toggle(list, 'JHN.3.16.w4', 'JHN.3.16.w1', 'underline');
  assert.deepEqual(list, []);
});

test('a link type goes round and back to a plain link', () => {
  assert.equal(TYPES[0], '');
  let type = '';
  const seen = [];
  for (let i = 0; i < TYPES.length; i += 1) {
    type = nextType(type);
    seen.push(type);
  }
  assert.deepEqual(seen, ['quotes', 'fulfills', 'contrasts', '']);
});

test('a span address names a run of words in one book', () => {
  const range = { from: 'JHN.3.16.w3', to: 'JHN.3.17.w2' };
  assert.equal(spanAddress(range), 'JHN.3.16.w3-JHN.3.17.w2');
  assert.deepEqual(parseSpanAddress('JHN.3.17.w2-JHN.3.16.w3'), range, 'ends in reading order');
  assert.equal(parseSpanAddress('JHN.3.16.w3-ROM.5.8.w1'), null);
  assert.equal(parseSpanAddress('JHN.3.16-18'), null);
});

test('a reference can run into a later chapter', () => {
  const ref = parseReference('Gen 1:1-2:3', books);
  assert.deepEqual(ref, { book: 'GEN', chapter: 1, from: 1, toChapter: 2, to: 3 });
  assert.equal(toAddress(ref), 'GEN.1.1-2.3');
  assert.equal(formatReference(ref, books), 'Genesis 1:1–2:3');
  assert.deepEqual(parseAddress('GEN.1.1-2.3', books), ref);
  assert.equal(versesIn(ref, books).length, 34);
  assert.equal(parseAddress('GEN.2.1-1.3', books), null, 'a range cannot run backwards');
  assert.equal(parseAddress('GEN.1.1-1.3', books)?.to, 3, 'the same chapter named twice is a plain range');
});

test('a passage that crosses a chapter labels the first verse of the new chapter', async () => {
  const { title, verses } = await passage({ book: 'GEN', chapter: 1, from: 31, toChapter: 2, to: 2 });
  assert.equal(title, 'Genesis 1:31–2:2');
  assert.deepEqual(verses.map((verse) => verse.label), ['31', '2:1', '2']);
});

test('a card steps through the text by its own size', () => {
  const step = (address, direction) => stepAddress(address, direction, books);
  assert.equal(step('JHN.3', 1), 'JHN.4');
  assert.equal(step('MAL.4', 1), 'MAT.1', 'a chapter steps into the next book');
  assert.equal(step('GEN.1', -1), null);
  assert.equal(step('REV.22', 1), null);
  assert.equal(step('JHN.3.16', 1), 'JHN.3.17');
  assert.equal(step('JHN.3.36', 1), 'JHN.4.1');
  assert.equal(step('JHN.4.1', -1), 'JHN.3.36');
  assert.equal(step('JHN.3.16-18', 1), 'JHN.3.19-21');
  assert.equal(step('JHN.3.34-36', 1), 'JHN.4.1-3');
  assert.equal(step('JHN.3.35-36', -1), 'JHN.3.33-34');
  assert.equal(step('JHN.3.1-3', -1), 'JHN.2.23-25');
  assert.equal(step('JHN.21.24-25', 1), 'ACT.1.1-2', 'past the end of a book, into the next');
  assert.equal(step('GEN.1.1', -1), null);
});

test('a phrase keeps only the words of its span, and their addresses', async () => {
  const found = await phrase({ from: 'JHN.3.16.w2', to: 'JHN.3.16.w5' });
  assert.equal(found?.title, 'John 3:16');
  const tokens = found.verses[0].blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens));
  assert.deepEqual(tokens.filter((token) => token.w).map((token) => token.w), [2, 3, 4, 5]);
  assert.equal(tokens.map((token) => token.text).join('').trim(), 'God so loved the');
  assert.equal(found.verses[0].blocks.some((block) => block.numbered), false, 'a phrase that starts inside a verse has no number');
});

test('a phrase across two verses keeps the second verse number', async () => {
  const found = await phrase({ from: 'JHN.3.16.w20', to: 'JHN.3.17.w3' });
  assert.equal(found?.title, 'John 3:16–17');
  assert.equal(found.verses.length, 2);
  assert.equal(found.verses[1].blocks[0].numbered, true);
});
