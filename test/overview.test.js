import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEAST, MARGIN, around, centre, centring, fit, keeping, keyAsks, middle, onTable, pinchAsks, spread, tappedIn } from '../app/lib/overview.js';

const box = (left, top, right, bottom) => ({ left, top, right, bottom });

test('the box around the cards, and none for an empty table', () => {
  assert.deepEqual(around([box(0, 0, 10, 10), box(-5, 20, 3, 40)]), box(-5, 0, 10, 40));
  assert.equal(around([]), null);
  assert.deepEqual(middle(box(0, 0, 10, 20)), { x: 5, y: 10 });
});

test('a box on the screen is a box on the table', () => {
  assert.deepEqual(onTable(box(110, 220, 130, 240), { x: 100, y: 200 }, 0.5), box(20, 40, 60, 80));
});

test('the overview shows the whole table in the free part of the screen', () => {
  const free = box(0, 0, 1000, 600);
  const table = box(0, 0, 4000, 1000);
  const { scale, offset } = fit(table, free);
  assert.equal(scale, (1000 - 2 * MARGIN) / 4000);
  // Its middle is in the middle of the free part.
  assert.deepEqual({ x: offset.x + scale * 2000, y: offset.y + scale * 500 }, { x: 500, y: 300 });
});

test('a table that fits keeps its size, and a huge one has the least scale', () => {
  assert.equal(fit(box(0, 0, 100, 100), box(0, 0, 1000, 1000)).scale, 1);
  assert.equal(fit(box(0, 0, 1e7, 10), box(0, 0, 500, 500)).scale, LEAST);
});

test('a zoom keeps the point under the finger', () => {
  const offset = { x: 40, y: -20 };
  const point = { x: 300, y: 200 };
  const next = keeping(point, offset, 0.25, 1);
  const before = { x: (point.x - offset.x) / 0.25, y: (point.y - offset.y) / 0.25 };
  assert.deepEqual({ x: (point.x - next.x) / 1, y: (point.y - next.y) / 1 }, before);
});

test('a card comes to the middle of the free part at full size', () => {
  assert.deepEqual(centring(box(1000, 1000, 1200, 1100), box(100, 0, 900, 600)), { x: -600, y: -750 });
});

test('a card longer or wider than the screen comes back with its top and start in view', () => {
  // 3000 tall in a room 600 tall: its top a margin below the room's.
  assert.deepEqual(centring(box(1000, 1000, 1200, 4000), box(100, 0, 900, 600)), { x: -600, y: MARGIN - 1000 });
  assert.deepEqual(centring(box(0, 0, 2000, 100), box(100, 0, 900, 600)), { x: 100 + MARGIN, y: 250 });
});

test('a pinch in goes to the overview, and a spread comes back', () => {
  assert.equal(spread([{ x: 0, y: 0 }, { x: 10, y: 0 }]), 5);
  assert.equal(spread([{ x: 0, y: 0 }]), 0);
  assert.deepEqual(centre([{ x: 0, y: 0 }, { x: 10, y: 4 }]), { x: 5, y: 2 });
  assert.deepEqual(centre([]), { x: 0, y: 0 });
  assert.equal(pinchAsks(100, 90, false), null);
  assert.equal(pinchAsks(100, 70, false), 'in');
  assert.equal(pinchAsks(100, 70, true), null, 'in the overview, a pinch in does nothing more');
  assert.equal(pinchAsks(100, 150, true), 'out');
  assert.equal(pinchAsks(100, 150, false), null);
  assert.equal(pinchAsks(0, 10, false), null);
});

test('a tap in the overview is on the card on top', () => {
  const cards = [
    { box: box(0, 0, 100, 100), z: 2 },
    { box: box(50, 50, 150, 150), z: 1 },
    { box: box(60, 60, 90, 90), z: 2 },
  ];
  assert.equal(tappedIn(cards, { x: 70, y: 70 }), 2, 'the same z: the last');
  assert.equal(tappedIn(cards, { x: 120, y: 120 }), 1);
  assert.equal(tappedIn(cards, { x: 10, y: 10 }), 0);
  assert.equal(tappedIn(cards, { x: 500, y: 500 }), -1);
});

test('O shows the overview or leaves it, and Escape leaves it', () => {
  assert.equal(keyAsks('o', false), 'toggle');
  assert.equal(keyAsks('O', true), 'toggle');
  assert.equal(keyAsks('Escape', true), 'leave');
  assert.equal(keyAsks('Escape', false), '');
  assert.equal(keyAsks('p', true), '');
});
