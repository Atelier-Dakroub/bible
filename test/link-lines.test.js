import assert from 'node:assert/strict';
import test from 'node:test';
import { besidePort, curvePath, labelSpot, marginBar, pointOn, port, wholeCard } from '../app/lib/link-lines.js';

/**
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 */
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

const left = box(0, 0, 200, 300);
const right = box(400, 0, 200, 300);

test('a link leaves a card on the side that faces the other, at the height of its words', () => {
  const words = box(20, 100, 60, 20);
  assert.deepEqual(port(left, words, right), { x: 200, y: 110, side: 1 });
  assert.deepEqual(port(right, box(420, 40, 60, 20), left), { x: 400, y: 50, side: -1 });
  // A link to the whole card leaves from its middle.
  assert.deepEqual(port(left, left, right), { x: 200, y: 150, side: 1 });
  // Words scrolled out of the card: the port stays on its edge, in from the corner.
  assert.deepEqual(port(left, box(20, -80, 60, 20), right), { x: 200, y: 6, side: 1 });
});

test('the curve goes out sideways from each port', () => {
  const a = port(left, left, right);
  const b = port(right, right, left);
  assert.equal(curvePath(a, b), 'M200,150 C300,150 300,150 400,150');
  assert.deepEqual(pointOn(a, b, 0), { x: 200, y: 150 });
  assert.deepEqual(pointOn(a, b, 1), { x: 400, y: 150 });
  // Two cards one above the other: the curve bulges out to the right.
  const top = box(0, 0, 200, 100);
  const below = box(0, 200, 200, 100);
  const out = pointOn(port(top, top, below), port(below, below, top), 0.5);
  assert.ok(out.x > 200);
});

test("a link's label stands beside a port, or along the curve, where no card is", () => {
  const a = port(left, left, right);
  const b = port(right, right, left);
  assert.deepEqual(labelSpot(a, b, 'quotes', [left, right]), besidePort(a, 'quotes'));
  // A card beside the start: beside the end.
  const near = box(205, 100, 40, 100);
  assert.deepEqual(labelSpot(a, b, 'link', [left, right, near]), besidePort(b, 'link'));
  // A card over the whole gap: no place.
  assert.equal(labelSpot(a, b, 'link', [left, right, box(150, 0, 300, 300)]), null);
});

test('a link to the whole card has no bar in its margin; words have one beside them', () => {
  assert.equal(wholeCard(left, left), true);
  const words = box(20, 100, 60, 20);
  assert.equal(wholeCard(words, left), false);
  assert.deepEqual(marginBar(port(left, words, right), left, words), { x: 194, y: 100, width: 3, height: 20 });
  assert.deepEqual(marginBar(port(right, box(420, 40, 60, 20), left), right, box(420, 40, 60, 20)), { x: 403, y: 40, width: 3, height: 20 });
});
