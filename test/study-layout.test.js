import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEAST, columnsOf, layOut, linksOf, studyDoc } from '../app/lib/study.js';

const plan = {
  address: 'MAT.1.23', title: 'Matthew 1:23', short: 'Matt 1:23', quoting: true,
  quotations: ['ISA.7.14'], parallels: ['LUK.1.31'], references: ['JHN.1.14', 'GAL.4.4'],
  people: ['person:mary_1938'], mapIds: '',
};

test('a study has its columns: the Old Testament on the left of the New', () => {
  assert.deepEqual(columnsOf(plan, 'note:n1'), [['ISA.7.14'], ['MAT.1.23', 'note:n1', 'person:mary_1938'], ['LUK.1.31'], ['JHN.1.14', 'GAL.4.4']]);
  // An Old Testament passage: the New Testament quotations come after it.
  const old = { ...plan, address: 'ISA.7.14', quoting: false, quotations: ['MAT.1.23'], parallels: [], people: [] };
  assert.deepEqual(columnsOf(old, 'note:n1'), [['ISA.7.14', 'note:n1'], ['MAT.1.23'], ['JHN.1.14', 'GAL.4.4']]);
});

test('every card of a study links to its passage; a quotation quotes, New to Old', () => {
  const links = linksOf(plan, 'note:n1');
  assert.deepEqual(links[0], { a: { address: 'MAT.1.23' }, b: { address: 'ISA.7.14' }, type: 'quotes' });
  assert.equal(links.length, 6);
  assert.ok(links.slice(1).every((link) => link.b.address === 'MAT.1.23' && !link.type));
  const old = linksOf({ ...plan, address: 'ISA.7.14', quoting: false, quotations: ['MAT.1.23'] }, 'note:n1');
  assert.deepEqual(old[0], { a: { address: 'MAT.1.23' }, b: { address: 'ISA.7.14' }, type: 'quotes' });
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

test('a study note says what the study holds, with headings to write under', () => {
  const doc = studyDoc(plan);
  assert.equal(doc.content[0].content[0].text, 'From the guide: 1 passage it quotes, 1 parallel, 2 cross-references and 1 person.');
  assert.deepEqual(doc.content.filter((/** @type {any} */ node) => node.type === 'heading').map((/** @type {any} */ node) => node.content[0].text), ['Observations', 'Questions', 'Application']);
  const bare = studyDoc({ ...plan, quotations: [], parallels: [], references: [], people: [], mapIds: 'place:moab_815' });
  assert.equal(bare.content[0].content[0].text, 'From the guide: its places on the map.');
  assert.equal(studyDoc({ ...plan, quotations: [], parallels: [], references: [], people: [] }).content[0].content[0].text, 'From the guide: no more than the passage.');
});
