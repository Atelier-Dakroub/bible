// lib/lists.js: what a list card holds.

import test from 'node:test';
import assert from 'node:assert/strict';

import { holds, inAList, listHolding, listName, listText, moved, withItems } from '../app/lib/lists.js';

const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** @param {string} id @param {string} address */
const item = (id, address) => ({ id, address, matrix, title: address, text: '' });

test('a gathered card holds its own whole-card links, and the words in its passage', () => {
  const passage = item('c1', 'JHN.3.16-18');
  assert.ok(holds(passage, { address: 'JHN.3.16-18' }));
  assert.ok(!holds(passage, { address: 'JHN.3.16' }));
  assert.ok(holds(passage, { from: 'JHN.3.17.w2', to: 'JHN.3.17.w4' }));
  assert.ok(!holds(passage, { from: 'JHN.3.19.w1', to: 'JHN.3.19.w1' }));
  assert.ok(holds(item('c2', 'PSA.23'), { from: 'PSA.23.4.w1', to: 'PSA.23.4.w3' }));
  assert.ok(holds(item('c3', 'note:n1'), { address: 'note:n1' }));
});

test('the list that holds an end, and whether an address is in a list', () => {
  const lists = [{ id: 'a', items: [item('c1', 'ROM.8.28')] }, { id: 'b', items: [item('c2', 'JHN.1.1')] }];
  assert.equal(listHolding(lists, { address: 'JHN.1.1' })?.id, 'b');
  assert.equal(listHolding(lists, { address: 'GEN.1.1' }), null);
  assert.ok(inAList(lists, 'ROM.8.28'));
  assert.ok(!inAList(lists, 'ROM.8.29'));
});

test('rows are added once, and move up and down', () => {
  const list = withItems({ id: 'a', items: [item('c1', 'ROM.8.28')] }, [item('c1', 'ROM.8.28'), item('c2', 'JHN.1.1')]);
  assert.deepEqual(list.items.map((each) => each.id), ['c1', 'c2']);
  assert.deepEqual(moved(list, 'c2', -1).items.map((each) => each.id), ['c2', 'c1']);
  assert.equal(moved(list, 'c1', -1), list);
});

test('a list as text, and its name', () => {
  const list = { id: 'a', title: 'Grace', items: [{ ...item('c1', 'EPH.2.8'), title: 'Ephesians 2:8', text: 'For by grace' }] };
  assert.equal(listText(list), 'Grace\nEphesians 2:8 — For by grace');
  assert.equal(listName(list), 'Grace · 1 card');
  assert.equal(listName({ id: 'b', items: [] }), 'List · 0 cards');
});
