import assert from 'node:assert/strict';
import test from 'node:test';
import { plain } from '../app/lib/lemma.js';
import { lemmaCodes, search } from '../app/data/bible.js';

test('a transliteration and what is typed come to one spelling', () => {
  assert.equal(plain('agápē'), plain('agape'));
  assert.equal(plain('chêçêd'), plain('hesed'));
  assert.equal(plain('shâlôwm'), plain('shalom'));
  assert.equal(plain('ʼemeth'), plain('emet'));
  assert.equal(plain('tsᵉdâqâh'), plain('tzedakah'));
});

test('a word of the original as it is said finds its Strong\'s number, the most used first', async () => {
  assert.deepEqual(await lemmaCodes('agape'), ['G26']);
  assert.deepEqual(await lemmaCodes('kurios'), ['G2962']);
  assert.equal((await lemmaCodes('torah'))[0], 'H8451');
  assert.deepEqual(await lemmaCodes('Yahweh'), ['H3068']);
});

test('the search field opens the word study, and a KJV word offers it beside the text', async () => {
  const agape = await search('agape');
  assert.equal(agape.entry?.code, 'G26');
  const amen = await search('amen');
  assert.equal(amen.entry, null);
  assert.deepEqual(amen.also.map((each) => each.code).sort(), ['G281', 'H543']);
});
