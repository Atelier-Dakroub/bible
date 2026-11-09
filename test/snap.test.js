import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply, multiply, rotation, scaleAbout, translation } from '../app/lib/affine.js';
import { boxOf, GAP, isUpright, snapBox, snapTurnAndScale } from '../app/lib/snap.js';

const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-9, `${message}: ${a} is not ${b}`);

test('a card turned a little stands upright, and the point under the fingers stays', () => {
  const about = { x: 300, y: 200 };
  const turned = multiply(translation(about.x, about.y), multiply(rotation(0.05), translation(-about.x, -about.y)));
  const card = multiply(turned, translation(100, 50));
  const snapped = snapTurnAndScale(card, about);
  assert.ok(isUpright(snapped));
  assert.equal(snapped.b, 0);
  const under = { x: 200, y: 150 }; // the point of the card under `about`
  const before = apply(card, under);
  const after = apply(snapped, under);
  near(after.x, before.x, 'x');
  near(after.y, before.y, 'y');
});

test('a card turned far from upright keeps its turn, and one near a quarter turn takes it', () => {
  const card = rotation(0.4);
  assert.equal(snapTurnAndScale(card, { x: 0, y: 0 }), card);
  const quarter = snapTurnAndScale(rotation(Math.PI / 2 - 0.03), { x: 0, y: 0 });
  assert.equal(quarter.a, 0);
  assert.equal(quarter.b, 1);
});

test('a card near full size takes full size', () => {
  const card = scaleAbout(1.03, { x: 50, y: 50 });
  const snapped = snapTurnAndScale(card, { x: 50, y: 50 });
  assert.equal(snapped.a, 1);
  near(snapped.e, 0, 'the point under the fingers stays');
  assert.equal(snapTurnAndScale(scaleAbout(1.2, { x: 0, y: 0 }), { x: 0, y: 0 }).a, 1.2);
});

test('a box lines up with the edges of another, or sits a gap beside it', () => {
  const other = { left: 100, top: 100, right: 300, bottom: 400 };
  // Its left edge 8 px from the other's: it moves onto it.
  const aligned = snapBox({ left: 108, top: 500, right: 208, bottom: 600 }, [other]);
  assert.equal(aligned.dx, -8);
  assert.equal(aligned.dy, 0);
  assert.deepEqual(aligned.guides, [{ x1: 100, y1: 100, x2: 100, y2: 600 }]);
  // Its left edge near the other's right edge plus the gap: it sits beside it.
  const beside = snapBox({ left: 300 + GAP + 5, top: 103, right: 500, bottom: 300 }, [other]);
  assert.equal(beside.dx, -5);
  assert.equal(beside.dy, -3, 'and its top lines up');
  // Far from everything: it stays.
  assert.deepEqual(snapBox({ left: 1000, top: 1000, right: 1100, bottom: 1100 }, [other]), { dx: 0, dy: 0, guides: [] });
});

test('an upright card covers its scaled size from its corner', () => {
  assert.deepEqual(boxOf({ a: 0.5, b: 0, c: 0, d: 0.5, e: 10, f: 20 }, 400, 200), { left: 10, top: 20, right: 210, bottom: 120 });
});
