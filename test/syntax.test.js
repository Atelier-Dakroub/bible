import assert from 'node:assert/strict';
import test from 'node:test';
import { rowsOf, syntaxOf, syntaxQuery } from '../app/data/syntax.js';
import { search } from '../app/data/bible.js';

test('a passage as clauses: each clause on a row, its parts by role', async () => {
  const { sentences, dir } = await syntaxOf({ book: 'JHN', chapter: 3, from: 16 });
  assert.equal(dir, 'ltr');
  const [first, second] = sentences[0].rows;
  assert.deepEqual(
    first.parts.map((part) => [part.label, part.gloss]),
    [['', 'for'], ['adverbial', 'Thus'], ['verb', 'loved'], ['subject', 'God'], ['object', 'the world']],
  );
  // "that he gave his only begotten Son", indented under it.
  assert.equal(second.depth, 1);
  assert.ok(second.parts.some((part) => part.label === 'verb' && part.gloss === 'He gave'));
});

test('the Hebrew joins each "and" to its own clause, and a psalm keeps its verse 1', async () => {
  const genesis = await syntaxOf({ book: 'GEN', chapter: 1, from: 2 });
  assert.equal(genesis.dir, 'rtl');
  assert.equal(genesis.sentences[0].rows.length, 3);
  assert.ok(genesis.sentences[0].rows.every((row) => row.parts[0].gloss === 'and'));
  const psalm = await syntaxOf({ book: 'PSA', chapter: 23, from: 1 });
  assert.ok(psalm.sentences.length);
  assert.deepEqual(rowsOf([]), []);
});

test('a search by syntax: roles, each with a Strong number, a word of the original, or an English word', async () => {
  assert.equal(await syntaxQuery('aorist imperative'), null);
  const query = await syntaxQuery('subject G2316 verb agapao in John');
  assert.ok(query);
  assert.deepEqual([...(query?.books ?? [])], ['JHN']);
  const john = await search('subject G2316 verb agapao in John');
  assert.deepEqual(john.results.map((each) => each.address), ['JHN.3.16']);
  const english = await search('verb love object world');
  assert.ok(english.results.some((each) => each.address === '1JN.2.15'));
  assert.ok(english.results[0].parts.some((part) => part.hit));
});
