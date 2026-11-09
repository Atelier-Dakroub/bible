import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_STEPS, dropCurrent, emptyTrail, record, toTrail, windowOf } from '../app/lib/trail.js';
import { empty, parse } from '../app/lib/workspace.js';

/** @param {string} query */
const step = (query, kind = 'place') => ({ query, label: query, kind });

test('a new step goes after the one on show, and drops the steps after it', () => {
  let trail = emptyTrail();
  for (const query of ['a', 'b', 'c']) trail = record(trail, step(query));
  assert.deepEqual(trail.steps.map((s) => s.query), ['a', 'b', 'c']);
  trail = { ...trail, index: 0 };
  trail = record(trail, step('d'));
  assert.deepEqual(trail.steps.map((s) => s.query), ['a', 'd']);
  assert.equal(trail.index, 1);
});

test('opening the step on show, or one in the trail, adds nothing', () => {
  let trail = emptyTrail();
  for (const query of ['a', 'b', 'c']) trail = record(trail, step(query));
  assert.equal(record(trail, step('c')).steps.length, 3);
  const back = record(trail, step('a'));
  assert.deepEqual(back.steps.map((s) => s.query), ['a', 'b', 'c']);
  assert.equal(back.index, 0);
});

test('a search being typed keeps one step', () => {
  let trail = record(emptyTrail(), step('entity=x'));
  trail = record(trail, { query: 'q=lo', label: '“lo”', kind: 'search', typed: 'lo' });
  trail = record(trail, { query: 'q=love', label: '“love”', kind: 'search', typed: 'love' }, true);
  assert.deepEqual(trail.steps.map((s) => s.query), ['entity=x', 'q=love']);
  assert.deepEqual(dropCurrent(trail).steps.map((s) => s.query), ['entity=x']);
});

test('the trail keeps its newest steps', () => {
  let trail = emptyTrail();
  for (let i = 0; i < MAX_STEPS + 5; i += 1) trail = record(trail, step(`s${i}`));
  assert.equal(trail.steps.length, MAX_STEPS);
  assert.equal(trail.steps[0].query, 's5');
  assert.equal(trail.index, MAX_STEPS - 1);
});

test('the chips are a window around the step on show', () => {
  const steps = Array.from({ length: 10 }, (_, i) => step(`s${i}`));
  assert.deepEqual(windowOf({ steps, index: 9 }), { start: 4, end: 10, before: true, after: false });
  assert.deepEqual(windowOf({ steps, index: 0 }), { start: 0, end: 6, before: false, after: true });
  assert.deepEqual(windowOf({ steps, index: 5 }), { start: 2, end: 8, before: true, after: true });
  assert.deepEqual(windowOf({ steps: steps.slice(0, 3), index: 1 }), { start: 0, end: 3, before: false, after: false });
});

test('a stored trail is checked, and the workspace keeps it', () => {
  assert.deepEqual(toTrail(null), emptyTrail());
  const trail = toTrail({ steps: [step('a'), { query: 'b', label: 'b', kind: 'nonsense' }, step('c')], index: 7 });
  assert.deepEqual(trail.steps.map((s) => s.query), ['a', 'c']);
  assert.equal(trail.index, 1);
  const kept = parse(JSON.stringify({ ...empty(), trail: { steps: [step('a')], index: 0 } }));
  assert.deepEqual(kept.trail, { steps: [step('a')], index: 0 });
  assert.deepEqual(empty().trail, emptyTrail());
});
