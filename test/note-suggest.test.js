import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { docOf } from '../app/lib/note-doc.js';
import { listPosition, triggerOf } from '../app/lib/note-suggest.js';

/** A note of one line, with the caret at its end. */
const at = (/** @type {string} */ text) => {
  const doc = docOf({ text });
  return EditorState.create({ doc, selection: TextSelection.atEnd(doc) });
};

test('a reference before the caret asks for a passage', () => {
  assert.deepEqual(triggerOf(at('read John 3:16')), { kind: 'ref', text: 'John 3:16', from: 6, to: 15 });
  assert.equal(triggerOf(at('read 1 Cor 13'))?.text, '1 Cor 13');
  assert.equal(triggerOf(at('read John')), null);
  assert.equal(triggerOf(at('in the year 30 ')), null);
});

test('@ and a name asks for people, places and words', () => {
  assert.deepEqual(triggerOf(at('with @abra')), { kind: 'at', text: 'abra', from: 6, to: 11 });
  assert.equal(triggerOf(at('@H430'))?.text, 'H430');
  assert.equal(triggerOf(at('mail@home')), null);
});

test('the suggestions go under the words, or over them where the screen ends', () => {
  const screen = { bottom: 800, right: 1200 };
  const list = { width: 300, height: 200 };
  assert.deepEqual(listPosition({ left: 100, top: 300, bottom: 320 }, list, screen), { left: 100, top: 326 });
  assert.deepEqual(listPosition({ left: 100, top: 700, bottom: 720 }, list, screen), { left: 100, top: 494 });
  assert.deepEqual(listPosition({ left: 100, top: 100, bottom: 790 }, list, screen), { left: 100, top: 8 });
  assert.deepEqual(listPosition({ left: 1100, top: 300, bottom: 320 }, list, screen), { left: 892, top: 326 });
});
