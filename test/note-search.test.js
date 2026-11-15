// lib/note-search.js: the reader's notes in a search.

import test from 'node:test';
import assert from 'node:assert/strict';

import { fold, notesMatching, snippet } from '../app/lib/note-search.js';

const notes = [
  { id: 'a', title: 'Jacob and Esaú', text: 'The birthright is sold for a meal of stew.' },
  { id: 'b', text: 'Grace and truth came through Jesus Christ.' },
  { id: 'c', title: 'Question', text: 'Why does John call him the Word?', kind: 'question' },
];

test('every word must be in the note, without regard to case or accents', () => {
  assert.deepEqual(notesMatching('esau birthright', notes).map((note) => note.id), ['a']);
  assert.deepEqual(notesMatching('GRACE', notes).map((note) => note.id), ['b']);
  assert.deepEqual(notesMatching('grace word', notes), []);
});

test('the title counts, and words of one letter do not', () => {
  assert.deepEqual(notesMatching('question a', notes).map((note) => note.id), ['c']);
  assert.deepEqual(notesMatching('a', notes), []);
});

test('the words shown are around the first match', () => {
  const long = `${'x '.repeat(60)}the covenant with Abraham ${'y '.repeat(60)}`;
  const shown = snippet(long, [fold('covenant')]);
  assert.ok(shown.startsWith('…') && shown.endsWith('…'));
  assert.ok(shown.includes('the covenant with Abraham'));
  assert.equal(notesMatching('stew', notes)[0].text, 'The birthright is sold for a meal of stew.');
});
