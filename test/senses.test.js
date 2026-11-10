import assert from 'node:assert/strict';
import test from 'node:test';
import { sensesOf } from '../app/data/senses.js';
import { search } from '../app/data/bible.js';

test('a word has its senses, each with how many verses use it so', async () => {
  const pneuma = await sensesOf('G4151');
  assert.ok(pneuma.length >= 10);
  const wind = pneuma.find((each) => each.gloss.startsWith('wind'));
  assert.ok(wind);
  assert.equal(wind.search, `G4151 sense ${wind.n}`);
  // The Hebrew in the KJV's verse numbers: chesed is a loyalty in Genesis 19:19.
  const chesed = await sensesOf('H2617');
  assert.ok(chesed[0].count > 200);
});

test('a search for one sense lists only the verses that use the word so', async () => {
  const pneuma = await sensesOf('G4151');
  const wind = /** @type {NonNullable<typeof pneuma[0]>} */ (pneuma.find((each) => each.gloss.startsWith('wind')));
  const results = await search(wind.search);
  assert.deepEqual(results.results.map((each) => each.address), ['JHN.3.8', 'HEB.1.7']);
  assert.equal(results.sense, wind.n);
  assert.match(results.summary, /^In the sense “wind/);
  assert.equal((await search('G4151')).sense, 0);
});
