import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAST, MOST, NOTE, columnsOf, counted, layOut, linksOf, listed, planOf, studyDoc } from '../app/lib/study.js';

// Matthew 1:23: it quotes Isaiah 7:14, which goes on its left.
const plan = planOf({
  kind: 'passage', address: 'MAT.1.23', title: 'Matthew 1:23', short: 'Matt 1:23',
  left: [{ cards: ['ISA.7.14'], type: 'quotes' }],
  under: ['person:mary_1938'],
  right: [{ cards: ['LUK.1.31'], toward: true }, { cards: ['JHN.1.14', 'GAL.4.4'], toward: true }],
  lines: ['From the guide: 1 passage it quotes.'],
});

test('a study has its columns: the middle card, its note and what belongs with it', () => {
  assert.deepEqual(columnsOf(plan, 'note:n1'), [['ISA.7.14'], ['MAT.1.23', 'note:n1', 'person:mary_1938'], ['LUK.1.31'], ['JHN.1.14', 'GAL.4.4']]);
  // A topic has no card: its note is the middle. A long side goes on in the next column.
  const many = Array.from({ length: MOST + 2 }, (_, i) => `PSA.${i + 1}.1`);
  const topic = planOf({ kind: 'topic', address: NOTE, title: 'Prayer', short: 'Prayer', right: [{ cards: many, toward: true }] });
  assert.deepEqual(columnsOf(topic, 'note:n2').map((column) => column.length), [1, MOST, 2]);
  assert.equal(columnsOf(topic, 'note:n2')[0][0], 'note:n2');
});

test('every card of a study links to the middle; a quotation quotes, New to Old', () => {
  const links = linksOf(plan, 'note:n1');
  assert.deepEqual(links[0], { a: { address: 'MAT.1.23' }, b: { address: 'ISA.7.14' }, type: 'quotes' });
  assert.equal(links.length, 6);
  assert.ok(links.slice(1).every((link) => link.b.address === 'MAT.1.23' && !link.type));
  assert.ok(links.some((link) => link.a.address === 'note:n1'), 'the note too');
  // An Old Testament passage: the New Testament passage quotes it, toward the middle.
  const old = planOf({ kind: 'passage', address: 'ISA.7.14', title: '', short: '', right: [{ cards: ['MAT.1.23'], type: 'quotes', toward: true }] });
  assert.deepEqual(linksOf(old, 'note:n1')[0], { a: { address: 'MAT.1.23' }, b: { address: 'ISA.7.14' }, type: 'quotes' });
  // A topic's passages link to its note, and the note is not linked to itself.
  const topic = planOf({ kind: 'topic', address: NOTE, title: '', short: '', right: [{ cards: ['PSA.5.3'], toward: true }] });
  assert.deepEqual(linksOf(topic, 'note:n2'), [{ a: { address: 'PSA.5.3' }, b: { address: 'note:n2' } }]);
});

test('a study is laid out in columns, scaled to fit the room', () => {
  const card = { width: 400, height: 300 };
  const { scale, at } = layOut([[card], [card, card]], { x: 10, y: 20 }, 2000, 20);
  assert.equal(scale, 1, 'never above full size');
  assert.deepEqual(at, [[{ x: 10, y: 20 }], [{ x: 430, y: 20 }, { x: 430, y: 340 }]]);
  const half = layOut([[card], [card]], { x: 0, y: 0 }, 820 * 0.8, 20);
  assert.equal(half.scale, 0.8);
  assert.deepEqual(half.at[1][0], { x: 420 * 0.8, y: 0 });
  assert.equal(layOut([[card], [card], [card], [card]], { x: 0, y: 0 }, 100, 20).scale, LEAST);
  assert.deepEqual(layOut([], { x: 0, y: 0 }, 100, 20), { scale: 1, at: [] });
});

test('a study note opens with its lines, then headings to write under', () => {
  const doc = studyDoc(plan);
  assert.equal(doc.content[0].content[0].text, 'From the guide: 1 passage it quotes.');
  assert.deepEqual(doc.content.filter((/** @type {any} */ node) => node.type === 'heading').map((/** @type {any} */ node) => node.content[0].text), ['Observations', 'Questions', 'Application']);
  assert.equal(counted(1, 'parallel'), '1 parallel');
  assert.equal(counted(3, 'person', 'people'), '3 people');
  assert.equal(listed(['a', '', 'b', 'c'], 'none'), 'a, b and c');
  assert.equal(listed(['a'], 'none'), 'a');
  assert.equal(listed([], 'none'), 'none');
});
