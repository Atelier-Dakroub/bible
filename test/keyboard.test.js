import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSystemKeys, wantKeys } from '../app/lib/keyboard.js';

test('phones and tablets have a keyboard of their own; a laptop or the panel does not', () => {
  assert.equal(hasSystemKeys({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
  assert.equal(hasSystemKeys({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile' }), true);
  // An iPad says it is a Mac, with touch points.
  assert.equal(hasSystemKeys({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true);
  assert.equal(hasSystemKeys({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 }), false);
  assert.equal(hasSystemKeys({ userAgent: 'Mozilla/5.0 (X11; Fedora; Linux x86_64) Chrome/156', maxTouchPoints: 10 }), false);
  assert.equal(hasSystemKeys({ userAgent: 'x', userAgentData: { mobile: true } }), true);
});

test('the app keyboard shows for a finger on a screen with no keyboard, until a real key is pressed', () => {
  const panel = { choice: /** @type {const} */ ('auto'), systemKeys: false, realKeys: false };
  assert.equal(wantKeys({ ...panel, pointer: 'touch' }), true);
  assert.equal(wantKeys({ ...panel, pointer: 'mouse' }), false);
  assert.equal(wantKeys({ ...panel, pointer: 'pen' }), false);
  assert.equal(wantKeys({ ...panel, pointer: 'touch', realKeys: true }), false);
  // A phone: its own keyboard.
  assert.equal(wantKeys({ ...panel, pointer: 'touch', systemKeys: true }), false);
  // The reader's choice wins.
  assert.equal(wantKeys({ ...panel, pointer: 'touch', systemKeys: true, choice: 'always' }), true);
  assert.equal(wantKeys({ ...panel, pointer: 'touch', choice: 'never' }), false);
  assert.equal(wantKeys({ ...panel, pointer: 'mouse', choice: 'always' }), false);
});

test('nothing is typing outside a page', async () => {
  const { typing } = await import('../app/lib/keyboard.js');
  assert.equal(typing(null), false);
});
