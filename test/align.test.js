import assert from 'node:assert/strict';
import test from 'node:test';
import { align } from '../tools/lib/align.js';

const words = (/** @type {string} */ text) => text.split(' ');

test('the words heard are matched to the text, past misheard names and missing numbers', () => {
  const text = words('and hamor and shechem his son came unto the gate of their city and communed with the men of their city saying these men are peaceable with us');
  // Misheard (sheikam, commuted), and a phrase heard twice in another place.
  const heard = words('end of section and hamor and sheikam his son came unto the gate of their city and commuted with the men of their city saying these men are peaceable with us');
  const at = align(text, heard);
  assert.equal(at[0], 3);
  assert.equal(at[3], null);
  assert.equal(heard[/** @type {number} */ (at[text.indexOf('peaceable')])], 'peaceable');
  assert.ok(at.filter((each) => each !== null).length >= text.length - 2);
});

test('a common phrase further on does not pull the match ahead', () => {
  const text = words('and he said unto him what is thy name and he said jacob and he said thy name shall be called no more jacob');
  // The first "and he said ... jacob" was not heard at all.
  const heard = words('and he said thy name shall be called no more jacob');
  const at = align(text, heard);
  // "thy name shall be called" is matched to its own place, not the first "thy name".
  assert.equal(at[text.lastIndexOf('thy')], 3);
  assert.equal(at[text.indexOf('thy')], null);
  // Each match runs forward.
  const found = at.filter((each) => each !== null);
  assert.deepEqual(found, [...found].sort((a, b) => /** @type {number} */ (a) - /** @type {number} */ (b)));
});
