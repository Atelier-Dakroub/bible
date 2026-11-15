// app/lib/footnotes.js, and tools/lib/bsb-notes.js, which keeps the footnotes
// in the BSB import.

import test from 'node:test';
import assert from 'node:assert/strict';

import { footnoteLabel, footnoteTitle, footnoted } from '../app/lib/footnotes.js';
import { CLOSE, OPEN, footnoteText, takeNotes, withNotes } from '../tools/lib/bsb-notes.js';
import { tokenize } from '../app/lib/words.js';

const HOLD = (n) => `${n}`;

test('a footnote is its words, without the marker or the reference', () => {
  assert.equal(footnoteText('\\f + \\fr 1:14 \\ft Or and tabernacled among us\\f*'), 'Or and tabernacled among us');
});

test('a footnote taken out leaves the text as it was without one', () => {
  const notes = ['one', 'two', 'three'];
  assert.deepEqual(takeNotes(`among us.${HOLD(0)} We`, notes), { text: 'among us. We', notes: [{ at: 9, text: 'one' }] });
  // A space on both sides becomes one, and the note stays on the word.
  assert.deepEqual(takeNotes(`the Word ${HOLD(1)} was`, notes), { text: 'the Word was', notes: [{ at: 8, text: 'two' }] });
  assert.deepEqual(takeNotes(`truth. ${HOLD(2)}`, notes), { text: 'truth.', notes: [{ at: 6, text: 'three' }] });
});

test('a block that was only a footnote gives it to the block before', () => {
  const blocks = withNotes(
    [
      { style: 'q1', text: 'a line' },
      { style: 'q2', text: HOLD(0) },
    ],
    ['note'],
  );
  assert.deepEqual(blocks, [{ style: 'q1', text: 'a line', notes: [{ at: 6, text: 'note' }] }]);
});

test('each footnote goes on the word it follows, lettered through the verse', () => {
  const { tokens } = tokenize('among us. We have seen', 1);
  const { tokens: placed, next } = footnoted(tokens, [{ at: 9, text: 'Or tabernacled' }], 1);
  const us = placed[1];
  assert.equal(us.text, 'us. ', 'the token keeps its whole text');
  assert.equal(us.head, 'us.');
  assert.equal(us.tail, ' ');
  assert.deepEqual(us.notes, [{ text: 'Or tabernacled', label: 'b' }]);
  assert.equal(us.w, 2, 'the word keeps its number');
  assert.equal(next, 2);
  assert.equal(placed.map((token) => token.text).join(''), 'among us. We have seen');
  assert.equal(placed.map((token) => (token.head ?? token.text) + (token.tail ?? '')).join(''), 'among us. We have seen');
});

test('a block with no footnotes is left alone', () => {
  const { tokens } = tokenize('no notes', 1);
  assert.equal(footnoted(tokens, undefined, 0).tokens, tokens);
  assert.equal(footnoteLabel(0), 'a');
  assert.equal(footnoteLabel(26), '27');
});

test('the popover names the verse and the letter', () => {
  assert.equal(footnoteTitle({ ref: 'JHN.1.14' }, 'b'), 'Verse 14, footnote b');
  assert.equal(footnoteTitle({ bsbRef: 'JHN.1.18' }, 'a'), 'Verse 18, footnote a');
  assert.equal(footnoteTitle({}, 'a'), 'Footnote a');
});
