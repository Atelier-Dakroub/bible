import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { docOf } from '../app/lib/note-doc.js';
import { FORMATS, barPosition } from '../app/lib/note-format.js';

/** A note of one line with "grace" (positions 1 to 6) selected. */
const selected = () => {
  const doc = docOf({ text: 'grace and truth' });
  return EditorState.create({ doc, selection: TextSelection.create(doc, 1, 6) });
};
/** @param {EditorState} state @param {string} name */
const press = (state, name) => {
  const format = FORMATS.find((each) => each.name === name);
  assert.ok(format, name);
  let next = state;
  format.run(state, (tr) => {
    next = state.apply(tr);
  });
  return next;
};
const on = (/** @type {EditorState} */ state, /** @type {string} */ name) => FORMATS.find((each) => each.name === name)?.on(state);

test('a highlight goes on, changes pigment, and comes off', () => {
  let state = press(selected(), 'lapis');
  assert.equal(on(state, 'lapis'), true);
  state = press(state, 'ochre');
  assert.equal(on(state, 'ochre'), true);
  assert.equal(on(state, 'lapis'), false);
  state = press(state, 'ochre');
  assert.equal(on(state, 'ochre'), false);
});

test('bold and a heading toggle', () => {
  let state = press(selected(), 'bold');
  assert.equal(on(state, 'bold'), true);
  state = press(state, 'heading');
  assert.equal(state.doc.firstChild?.type.name, 'heading');
  state = press(state, 'heading');
  assert.equal(state.doc.firstChild?.type.name, 'paragraph');
});

test('a list goes on, turns numbered, and comes off', () => {
  let state = press(selected(), 'list');
  assert.equal(state.doc.firstChild?.type.name, 'bullet_list');
  state = press(state, 'numbered');
  assert.equal(state.doc.firstChild?.type.name, 'ordered_list');
  state = press(state, 'numbered');
  assert.equal(state.doc.firstChild?.type.name, 'paragraph');
});

test('a heading made a list becomes a list item', () => {
  let state = press(press(selected(), 'heading'), 'list');
  assert.equal(state.doc.firstChild?.type.name, 'bullet_list');
  assert.equal(state.doc.firstChild?.firstChild?.firstChild?.type.name, 'paragraph');
});

test('a reference takes no bold or highlight, and a marked one loses its marks', async () => {
  const { docOf } = await import('../app/lib/note-doc.js');
  const ref = { type: 'ref', attrs: { address: 'person:abraham_58', label: 'Abraham', kind: 'person' } };
  const doc = docOf({ text: '', doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'with ' }, { ...ref, marks: [{ type: 'strong' }] }] }] } });
  assert.equal(doc.firstChild?.lastChild?.type.name, 'ref');
  assert.equal(doc.firstChild?.lastChild?.marks.length, 0);
  const state = EditorState.create({ doc, selection: TextSelection.create(doc, 1, doc.content.size - 1) });
  const after = press(press(state, 'bold'), 'lapis');
  assert.equal(after.doc.firstChild?.lastChild?.marks.length, 0);
  assert.equal(after.doc.firstChild?.firstChild?.marks.length, 2);
});

test('the bar goes over the words, or under them for a finger, and stays on the screen', () => {
  const screen = { top: 8, bottom: 792, right: 1192 };
  const bar = { width: 200, height: 40 };
  const words = { left: 400, right: 500, top: 300, bottom: 320 };
  assert.deepEqual(barPosition(words, bar, screen, false), { left: 350, top: 250 });
  assert.deepEqual(barPosition(words, bar, screen, true), { left: 350, top: 332 });
  // No room over the words: under them. No room under them: over.
  assert.deepEqual(barPosition({ ...words, top: 20, bottom: 40 }, bar, screen, false), { left: 350, top: 52 });
  assert.deepEqual(barPosition({ ...words, top: 760, bottom: 780 }, bar, screen, true), { left: 350, top: 710 });
  // At an edge of the screen: inside it.
  assert.deepEqual(barPosition({ ...words, left: 0, right: 20 }, bar, screen, false), { left: 8, top: 250 });
  assert.deepEqual(barPosition({ ...words, left: 1180, right: 1200 }, bar, screen, false), { left: 992, top: 250 });
});
