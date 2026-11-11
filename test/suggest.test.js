import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/routes/suggest/[text].js';

/** @param {string} text @param {string} kind */
const suggest = async (text, kind) => {
  const response = await GET({ params: { text: encodeURIComponent(text) }, request: new Request(`http://localhost/suggest/x?kind=${kind}`) });
  return /** @type {{ kind: string, address: string, label: string }[]} */ (await response.json());
};

test('a reference typed in a note suggests its passage', async () => {
  const [found, ...more] = await suggest('John 3:16', 'ref');
  assert.equal(found.address, 'JHN.3.16');
  assert.equal(found.label, 'John 3:16');
  assert.equal(more.length, 0);
  assert.deepEqual(await suggest('not a reference', 'ref'), []);
});

test('@ and a name suggests people and places, a whole name first', async () => {
  const found = await suggest('abraham', 'at');
  assert.ok(found.length > 0 && found.length <= 6);
  const people = found.filter((each) => each.kind !== 'word');
  assert.equal(people[0].label, 'Abraham');
  assert.equal(people[0].kind, 'person');
  assert.ok(found.every((each) => each.label.toLowerCase().startsWith('abraham') || each.kind === 'word'));
  assert.deepEqual(await suggest('   ', 'at'), []);
});

test('@ and a Strong number, or a word as it is said, suggests the word first', async () => {
  const [word] = await suggest('h0430', 'at');
  assert.equal(word.kind, 'word');
  assert.equal(word.address, 'H430');
  const said = await suggest('agape', 'at');
  assert.ok(said.some((each) => each.kind === 'word' && each.address === 'G26'));
});
