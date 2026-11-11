import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSystemKeys, keyText, typeInto, typesFromKeyboard, wantKeys } from '../app/lib/keyboard.js';

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

test('a key from a keyboard types; a shortcut or a key the page made does not', () => {
  const key = { isTrusted: true, ctrlKey: false, metaKey: false, altKey: false };
  assert.equal(typesFromKeyboard({ ...key, key: 'a' }), true);
  assert.equal(typesFromKeyboard({ ...key, key: 'Backspace' }), true);
  assert.equal(typesFromKeyboard({ ...key, key: 'Enter' }), true);
  assert.equal(typesFromKeyboard({ ...key, key: 'ArrowLeft' }), false);
  assert.equal(typesFromKeyboard({ ...key, key: 'Shift' }), false);
  assert.equal(typesFromKeyboard({ ...key, key: 'z', metaKey: true }), false);
  assert.equal(typesFromKeyboard({ ...key, key: 'z', ctrlKey: true }), false);
  assert.equal(typesFromKeyboard({ ...key, key: 'z', altKey: true }), false);
  assert.equal(typesFromKeyboard({ ...key, key: 'a', isTrusted: false }), false);
});

test('the app keyboard types into a field', () => {
  assert.equal(typeInto('joh', 'n', false), 'john');
  assert.equal(typeInto('', 'j', true), 'J');
  assert.equal(typeInto('john', 'back', false), 'joh');
  assert.equal(typeInto('', 'back', false), '');
  assert.equal(typeInto('john', 'clear', true), '');
  assert.equal(typeInto('john', 'space', false), 'john ');
  assert.equal(typeInto('a', 'enter', false), 'a\n');
  assert.equal(typeInto('3', ':', true), '3:');
  assert.equal(keyText('a', true), 'A');
  assert.equal(keyText('a', false), 'a');
  assert.equal(keyText('space', true), 'space');
});
