import assert from 'node:assert/strict';
import test from 'node:test';
import { besidePort, clearOf, curvePath, dotPort, labelSpot, marginBar, pointOn, port, tickPath, tickPoint, wholeCard, within } from '../app/lib/link-lines.js';

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

test('a line to a place on the map goes into its dot from the side', () => {
  const dot = box(500, 95, 10, 10);
  const a = port(left, dot, dot);
  assert.deepEqual(a, { x: 200, y: 100, side: 1 });
  // From the left: on the left of the rim, 2 px clear.
  assert.deepEqual(dotPort(dot, a), { x: 498, y: 100, side: -1 });
  assert.deepEqual(dotPort(dot, { x: 900, y: 100 }), { x: 512, y: 100, side: 1 });
});

test('a line to a tick on the timeline goes into it from above', () => {
  const tick = box(290, 700, 4, 20);
  const a = port(left, tick, tick);
  // The tick is to the right and far below: the right edge, low on the card.
  assert.deepEqual(a, { x: 200, y: 294, side: 1 });
  const at = tickPoint(tick, left);
  assert.deepEqual(at, { x: 292, y: 700 });
  assert.equal(tickPath(a, at), 'M200,294 C240,294 292,497 292,700');
  // A tick above the card: its lower edge, and in from below.
  assert.deepEqual(tickPoint(box(290, -60, 4, 20), left), { x: 292, y: -40 });
});

test('a point in any of some boxes', () => {
  assert.ok(within({ x: 200, y: 50 }, [box(150, 0, 200, 200)]));
  assert.ok(!within({ x: 400, y: 50 }, [box(150, 0, 200, 200)]));
  assert.ok(!within({ x: 0, y: 0 }, []));
});

test('a label keeps clear of the panels as of the cards', () => {
  const a = port(left, left, right);
  const b = port(right, right, left);
  assert.equal(clearOf({ x: 300, y: 150 }, 'link', [box(280, 140, 40, 40)]), false);
  assert.equal(clearOf({ x: 300, y: 150 }, 'link', []), true);
  // A panel over the gap beside the start: beside the end.
  assert.deepEqual(labelSpot(a, b, 'link', [left, right, box(200, 100, 60, 100)]), besidePort(b, 'link'));
});
