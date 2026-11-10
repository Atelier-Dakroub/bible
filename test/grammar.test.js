import assert from 'node:assert/strict';
import test from 'node:test';
import grammar from '../app/data/original/grammar.json' with { type: 'json' };
import { accepts, codeTest, describe, parseGrammar, partsOf, vocabularyOf } from '../app/lib/grammar.js';
import { findBook, parseReference } from '../app/lib/reference.js';
import { GROUPS } from '../app/data/canon.js';
import { books, grammarFind, grammarQuery, original, search } from '../app/data/bible.js';

const vocabulary = vocabularyOf(grammar);
const canon = {
  books,
  groups: GROUPS,
  findBook: (/** @type {string} */ text) => findBook(text, books),
  parseReference: (/** @type {string} */ text) => parseReference(text, books),
};
/** @param {string} text */
const parse = (text) => parseGrammar(text, vocabulary, canon);

test('a query of grammar words, with a scope', () => {
  const query = parse('aorist imperative in John');
  assert.deepEqual(query?.terms, ['aorist', 'imperative']);
  assert.deepEqual([...(query?.books ?? [])], ['JHN']);
  assert.equal(query?.scope, 'John');
  assert.equal(describe(/** @type {any} */ (query), grammar), 'Aorist imperative in John');
});

test('first and 1st are the same, and "person" after them is read with them', () => {
  assert.deepEqual(parse('first person plural aorist subjunctive')?.terms, ['1st', 'plural', 'aorist', 'subjunctive']);
  assert.deepEqual(parse('third masculine singular')?.terms, ['3rd', 'masculine', 'singular']);
});

test('the names grammars use: wayyiqtol, a Strong\'s number, a code, a group of books', () => {
  assert.deepEqual(parse('wayyiqtol')?.terms, ['consecutive imperfect']);
  const narrow = parse('G26 accusative in the NT');
  assert.equal(narrow?.strongs, 'G26');
  assert.equal(narrow?.scope, 'the New Testament');
  assert.equal(parse('V-AAM-2S')?.code, 'V-AAM-2S');
  assert.equal(parse('HVqw3ms in Ruth')?.code, 'HVqw3ms');
  assert.deepEqual([...(parse('participle in the gospels')?.books ?? [])], ['MAT', 'MRK', 'LUK', 'JHN']);
  assert.ok(parse('verb in Romans 8')?.ref);
});

test('text that is not grammar is not read as grammar', () => {
  assert.equal(parse('love one another'), null);
  assert.equal(parse('the first day'), null);
  assert.equal(parse('aorist in Narnia'), null);
  assert.equal(parse('G26'), null);
});

test('a word matches the values that hold it, but not a consecutive form', () => {
  assert.ok(accepts('aorist', '2nd aorist'));
  assert.ok(accepts('middle', 'middle or passive deponent'));
  assert.ok(accepts('pronoun', 'personal pronoun'));
  assert.ok(!accepts('imperfect', 'consecutive imperfect'));
  assert.ok(accepts('consecutive imperfect', 'consecutive imperfect'));
  assert.ok(!accepts('perfect', 'pluperfect'));
});

test('a Hebrew word is read part by part', () => {
  // and/ he said: a conjunction, then the verb.
  assert.equal(partsOf('HC/Vqw3ms', grammar).length, 2);
  const verb = codeTest(/** @type {any} */ (parse('qal consecutive imperfect')), grammar);
  assert.ok(verb('HVqw3ms'));
  assert.ok(verb('Hc/Vqw3ms'));
  // The conjunction and the verb are in different parts: no single part is both.
  const both = codeTest(/** @type {any} */ (parse('conjunction qal')), grammar);
  assert.equal(both('HC/Vqp3ms'), false);
});

test('a search by grammar finds the words, verse by verse', async () => {
  const query = await grammarQuery('aorist imperative in John');
  assert.ok(query);
  const hits = await grammarFind(query);
  // John 2:5: "Whatsoever he saith unto you, do it" (ποιήσατε).
  const cana = hits.find((hit) => hit.address === 'JHN.2.5');
  assert.ok(cana);
  assert.ok(cana.found.some((n) => cana.words[n][1] === 'poiēsate'));
  assert.ok(hits.every((hit) => hit.address.startsWith('JHN.')));
});

test('the search panel reads a grammar query, and keeps one KJV word a search of the text', async () => {
  const results = await search('wayyiqtol in Ruth');
  assert.match(results.stats?.summary ?? '', /^Consecutive imperfect in Ruth: \d+ words in \d+ verses/);
  assert.equal(results.results[0].address, 'RUT.1.1');
  assert.equal(results.results[0].lang, 'hbo');
  // Each word found narrows the search to it, before the scope.
  assert.match(results.stats?.renderings[0].search ?? '', /^wayyiqtol H\d+ in Ruth$/);
  // "perfect" is in the KJV: a search of the text.
  assert.equal((await search('perfect')).stats, null);
});

test('a word on a card searches for its own form, the main part of a Hebrew word', async () => {
  const ref = parseReference('Genesis 1:3', books);
  assert.ok(ref);
  const [said] = (await original(ref)).verses[0].words;
  // וַיֹּאמֶר, "and he said": Hc/Vqw3ms, searched as HVqw3ms.
  assert.equal(said.code, 'Hc/Vqw3ms');
  assert.equal(said.search, 'HVqw3ms');
});
