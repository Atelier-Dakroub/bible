import assert from 'node:assert/strict';
import test from 'node:test';
import { chapterTimes, versesIn } from '../tools/join-verses.js';

test("a chapter's times: each verse after the last and a pause", () => {
  // 2 s, then 3 s, then 1 s, with 0.5 s between: they begin at 0, 2.5 and 6.
  assert.deepEqual(chapterTimes([2, 3, 1], 0.5), [7, [0, 25, 60]]);
  // No pause after the last verse: 4 + 0.55 + 4 is 8.55, rounded.
  assert.deepEqual(chapterTimes([4, 4]), [9, [0, 46]]);
  assert.deepEqual(chapterTimes([]), [0, []]);
});

test("a chapter's verse files, in the order of the verses", () => {
  assert.deepEqual(versesIn(['10.wav', '2.wav', '1.wav', '3.m4a', '4.mp3', '5.flac', '6.wav', '7.wav', '8.wav', '9.wav']), [
    '1.wav',
    '2.wav',
    '3.m4a',
    '4.mp3',
    '5.flac',
    '6.wav',
    '7.wav',
    '8.wav',
    '9.wav',
    '10.wav',
  ]);
  // Other files are left alone.
  assert.deepEqual(versesIn(['1.wav', 'notes.txt', '.DS_Store', '2.wav']), ['1.wav', '2.wav']);
});

test('a verse left out is named, so the chapter is not joined', () => {
  assert.equal(versesIn(['1.wav', '3.wav']), 2);
  assert.equal(versesIn(['2.wav']), 1);
  assert.equal(versesIn([]), 1);
});
