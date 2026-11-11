import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, NodeSelection } from 'prosemirror-state';
import { docOf, quotesIn, toText } from '../app/lib/note-doc.js';
import { foldedIn, openRef } from '../app/lib/note-quotes.js';

const REF = { type: 'ref', attrs: { address: 'JHN.3.16-17', label: 'John 3:16–17', kind: 'passage' } };

test('a reference to verses opens into a quote after its line', () => {
  const doc = docOf({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'See ' }, REF] }] }, text: '' });
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 5) });
  let next = state;
  assert.equal(openRef(state, (tr) => { next = state.apply(tr); }), true);
  assert.deepEqual(quotesIn(next.doc), ['JHN.3.16.w1-JHN.3.17.w999']);
  assert.equal(toText(next.doc), 'See ');
});

test('a reference alone on its line becomes the quote, and folds back', () => {
  const doc = docOf({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [REF] }] }, text: '' });
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 1) });
  let next = state;
  openRef(state, (tr) => { next = state.apply(tr); });
  assert.equal(next.doc.firstChild?.type.name, 'quote');
  const back = foldedIn(next.doc, 'JHN.3.16.w1-JHN.3.17.w999');
  assert.equal(back?.firstChild?.firstChild?.attrs.address, 'JHN.3.16-17');
  assert.equal(back?.firstChild?.firstChild?.attrs.label, 'John 3:16–17');
});

test('a chapter cannot open into a quote', () => {
  const doc = docOf({ doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ ...REF, attrs: { ...REF.attrs, address: 'JHN.3' } }] }] }, text: '' });
  const state = EditorState.create({ doc, selection: NodeSelection.create(doc, 1) });
  assert.equal(openRef(state), false);
});

test('a note\'s quotes match its list: gone, doubled, and missing ones', () => {
  const quote = (/** @type {string} */ span) => ({ type: 'quote', attrs: { span, title: '' } });
  const doc = docOf({
    doc: { type: 'doc', content: [quote('JHN.1.1.w1-JHN.1.1.w3'), quote('JHN.1.1.w1-JHN.1.1.w3'), quote('GEN.1.1.w1-GEN.1.1.w2')] },
    text: '',
    quotes: [{ from: 'JHN.1.1.w1', to: 'JHN.1.1.w3' }, { from: 'PSA.23.1.w1', to: 'PSA.23.1.w4' }],
  });
  assert.deepEqual(quotesIn(doc), ['JHN.1.1.w1-JHN.1.1.w3', 'PSA.23.1.w1-PSA.23.1.w4']);
});
