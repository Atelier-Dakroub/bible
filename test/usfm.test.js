import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inlineRuns, plainText, readBook } from '../tools/lib/usfm.js';

test('character styles become marks, and the space after an opening marker is the marker\'s', () => {
  assert.deepEqual(inlineRuns('darkness \\add was\\add* upon'), [
    { text: 'darkness ', marks: [] },
    { text: 'was', marks: ['add'] },
    { text: ' upon', marks: [] },
  ]);
});

test('Strong\'s tags and footnotes leave only the words', () => {
  assert.deepEqual(inlineRuns('In the \\w beginning|strong="H7225"\\w*\\f + \\fr 1:1 \\ft a note\\f* God'), [
    { text: 'In the beginning God', marks: [] },
  ]);
});

test('nested marks keep the outer mark first, and a mark can run across pieces', () => {
  const open = [];
  const first = inlineRuns('\\wj Blessed \\+add are\\+add* the', open);
  assert.deepEqual(first, [
    { text: 'Blessed ', marks: ['wj'] },
    { text: 'are', marks: ['wj', 'add'] },
    { text: ' the', marks: ['wj'] },
  ]);
  assert.deepEqual(open, ['wj']);
  assert.deepEqual(inlineRuns(' poor\\wj*.', open), [{ text: ' poor', marks: ['wj'] }, { text: '.', marks: [] }]);
});

test('an unknown character style throws', () => {
  assert.throws(() => inlineRuns('\\zz odd\\zz*'), /Unknown character style/);
});

test('a psalm title joins verse 1, and poetry and breaks keep their styles', () => {
  const usfm = [
    '\\c 3',
    '\\d A Psalm of David.',
    '\\q1',
    '\\v 1 \\nd LORD\\nd*, how are they increased!',
    '\\b',
    '\\q1',
    '\\v 2 Many \\add there be\\add* which say.',
  ].join('\n');
  const [chapter] = readBook(usfm, 'PSA');
  assert.equal(chapter.n, 3);
  const [one, two] = chapter.verses;
  assert.equal(one.id, 'PSA.3.1');
  assert.deepEqual(one.blocks.map((block) => [block.style, block.numbered ?? false]), [['d', false], ['q1', true], ['b', false]]);
  assert.equal(plainText(one.blocks), 'A Psalm of David. LORD, how are they increased!');
  assert.equal(plainText(two.blocks), 'Many there be which say.');
});

test('an epistle\'s closing heading is not verse text', () => {
  const [chapter] = readBook('\\c 16\n\\p\n\\v 27 To God only wise, be glory.\n\\s1 Written to the Romans from Corinthus.', 'ROM');
  assert.equal(plainText(chapter.verses[0].blocks), 'To God only wise, be glory.');
});
