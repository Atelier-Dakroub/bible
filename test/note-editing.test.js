import assert from 'node:assert/strict';
import test from 'node:test';
import { EditorState, TextSelection } from 'prosemirror-state';
import { docOf } from '../app/lib/note-doc.js';
import { deleteBack } from '../app/lib/note-editing.js';

/** @param {string} text @param {number} at the caret */
const caretIn = (text, at) => {
  const doc = docOf({ text });
  return EditorState.create({ doc, selection: TextSelection.create(doc, at) });
};
/** @param {EditorState} state */
const back = (state) => {
  let next = state;
  const done = deleteBack(state, (tr) => {
    next = state.apply(tr);
  });
  return { done, text: next.doc.textContent, caret: next.selection.from };
};

test("the app keyboard's delete key takes the character before the caret", () => {
  assert.deepEqual(back(caretIn('grace', 6)), { done: true, text: 'grac', caret: 5 });
  assert.deepEqual(back(caretIn('grace', 3)), { done: true, text: 'gace', caret: 2 });
  // At the start of a line it does nothing here: the line joins the one before.
  assert.equal(back(caretIn('grace', 1)).done, false);
});

test('a whole emoji goes, not half of it', () => {
  assert.deepEqual(back(caretIn('ok 🙏', 6)), { done: true, text: 'ok ', caret: 4 });
});
