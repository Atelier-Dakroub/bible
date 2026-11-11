import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { docOf } from '../app/lib/note-doc.js';
import { triggerOf } from '../app/lib/note-suggest.js';

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
