import assert from 'node:assert/strict';
import { test } from 'node:test';
import { angleOf, apply, clampScale, multiply, rotation, scaleOf, similarity, translation } from '../app/lib/affine.js';
import { centroid, step } from '../app/lib/gesture.js';

/** @param {{ x: number, y: number }} actual @param {{ x: number, y: number }} expected */
function near(actual, expected) {
  assert.ok(Math.abs(actual.x - expected.x) < 1e-9 && Math.abs(actual.y - expected.y) < 1e-9, `${JSON.stringify(actual)} is not ${JSON.stringify(expected)}`);
}

test('multiply applies the right-hand matrix first', () => {
  const m = multiply(translation(10, 0), rotation(Math.PI / 2));
  near(apply(m, { x: 1, y: 0 }), { x: 10, y: 1 });
});

test('similarity sends both points where the fingers went', () => {
  const p1 = { x: 0, y: 0 };
  const p2 = { x: 10, y: 0 };
  const q1 = { x: 5, y: 5 };
  const q2 = { x: 5, y: 25 };
  const m = similarity(p1, p2, q1, q2);
  near(apply(m, p1), q1);
  near(apply(m, p2), q2);
  assert.equal(scaleOf(m), 2);
  assert.equal(angleOf(m), Math.PI / 2);
});

test('similarity follows the first finger when the two touch the same spot', () => {
  const m = similarity({ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 7, y: 1 }, { x: 7, y: 1 });
  near(apply(m, { x: 0, y: 0 }), { x: 4, y: -2 });
});

test('clampScale stops a pinch at the limit and keeps the center still', () => {
  const about = { x: 50, y: 50 };
  const grown = similarity({ x: 40, y: 50 }, { x: 60, y: 50 }, { x: 0, y: 50 }, { x: 100, y: 50 });
  const held = clampScale(grown, 0.5, 3, about);
  assert.ok(Math.abs(scaleOf(held) - 3) < 1e-9);
  near(apply(held, about), about);
});

test('one finger moves, two fingers turn and scale', () => {
  const before = new Map([[1, { x: 0, y: 0 }]]);
  near(apply(step(before, new Map([[1, { x: 4, y: 3 }]])), { x: 0, y: 0 }), { x: 4, y: 3 });

  const pair = new Map([[1, { x: 0, y: 0 }], [2, { x: 10, y: 0 }]]);
  const turned = new Map([[1, { x: 0, y: 0 }], [2, { x: 0, y: 10 }]]);
  assert.equal(angleOf(step(pair, turned)), Math.PI / 2);
});

test('a finger that just joined does not move the card in its first frame', () => {
  const before = new Map([[1, { x: 0, y: 0 }]]);
  const after = new Map([[1, { x: 0, y: 0 }], [2, { x: 50, y: 50 }]]);
  near(apply(step(before, after), { x: 9, y: 9 }), { x: 9, y: 9 });
});

test('centroid is the mean of the points', () => {
  near(centroid(new Map([[1, { x: 0, y: 0 }], [2, { x: 10, y: 4 }]])), { x: 5, y: 2 });
});
