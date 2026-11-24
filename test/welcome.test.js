import assert from 'node:assert/strict';
import { test } from 'node:test';
import { phrase } from '../app/data/bible.js';
import { sameEnd } from '../app/lib/links.js';
import { firstVisit, HIGHLIGHTS, LINKS, PASSAGES, SEARCH } from '../app/lib/welcome.js';
import { isWordAddress } from '../app/lib/words.js';
import { KEY } from '../app/lib/workspace.js';

test('the first table marks the words it searches for, in each passage', async () => {
  assert.equal(HIGHLIGHTS.length, PASSAGES.length);
  for (const [i, mark] of HIGHLIGHTS.entries()) {
    assert.ok(isWordAddress(mark.from) && isWordAddress(mark.to));
    assert.ok(PASSAGES[i].startsWith(mark.from.split('.').slice(0, 2).join('.')), `${mark.from} is in ${PASSAGES[i]}`);
    const found = await phrase(mark);
    const words = found?.verses[0].blocks.flatMap((block) => block.runs.flatMap((run) => run.tokens)).map((token) => token.text).join('').trim();
    assert.equal(words, SEARCH);
  }
});

test('the first table links its marks', () => {
  for (const link of LINKS) {
    for (const end of [link.a, link.b]) assert.ok(HIGHLIGHTS.some((mark) => sameEnd(mark, end)));
  }
});

test('the first visit is a browser with no table kept, and one that can keep it', () => {
  assert.equal(firstVisit({ getItem: () => null }), true);
  assert.equal(firstVisit({ getItem: (key) => (key === KEY ? '{}' : null) }), false, 'an empty table kept is not a first visit');
  assert.equal(firstVisit({ getItem: () => { throw new Error('storage is off'); } }), false);
});
