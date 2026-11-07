import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseContent, plainText } from '../tools/lib/kjv-content.js';

test('a prose verse becomes one block with the number removed', () => {
  const html = '<p class="p"><span data-number="1" data-sid="GEN 1:1" class="v">1</span>In the beginning God created the heaven and the earth. </p>';
  assert.deepEqual(parseContent(html, '1'), [
    { style: 'p', numbered: true, runs: [{ text: 'In the beginning God created the heaven and the earth.', marks: [] }] },
  ]);
});

test('a psalm title is its own block, before the numbered one', () => {
  const html =
    '<p class="d">A Psalm of David, when he fled from Absalom his son.</p><p class="q1"><span data-number="1" data-sid="PSA 3:1" class="v">1</span><span class="nd">LORD</span>, how are they increased that trouble me! many <span class="add">are</span> they that rise up against me.</p>';
  const blocks = parseContent(html, '1');
  assert.deepEqual(blocks.map((block) => [block.style, block.numbered ?? false]), [['d', false], ['q1', true]]);
  assert.deepEqual(blocks[1].runs[0], { text: 'LORD', marks: ['nd'] });
  assert.deepEqual(blocks[1].runs[2], { text: 'are', marks: ['add'] });
  assert.equal(plainText(blocks), 'A Psalm of David, when he fled from Absalom his son. LORD, how are they increased that trouble me! many are they that rise up against me.');
});

test('nested marks keep the outer mark first', () => {
  const html = '<p class="p"><span data-number="3" data-sid="MAT 5:3" class="v">3</span><span class="wj">Blessed <span class="add">are</span> the poor</span></p>';
  assert.deepEqual(parseContent(html, '3')[0].runs, [
    { text: 'Blessed ', marks: ['wj'] },
    { text: 'are', marks: ['wj', 'add'] },
    { text: ' the poor', marks: ['wj'] },
  ]);
});

test('an unknown class, tag or entity throws', () => {
  const v = '<span data-number="1" data-sid="X 1:1" class="v">1</span>';
  assert.throws(() => parseContent(`<p class="zz">${v}a</p>`, '1'), /Unknown block style/);
  assert.throws(() => parseContent(`<p class="p">${v}<span class="zz">a</span></p>`, '1'), /Unknown character style/);
  assert.throws(() => parseContent(`<p class="p">${v}<i>a</i></p>`, '1'), /Unknown tag/);
  assert.throws(() => parseContent(`<p class="p">${v}a &amp; b</p>`, '1'), /entity/);
});

test('a verse number that does not match throws', () => {
  assert.throws(() => parseContent('<p class="p"><span data-number="2" data-sid="X 1:2" class="v">2</span>a</p>', '1'), /data-number/);
});
