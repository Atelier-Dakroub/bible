// data/commentaries.js and lib/commentary-address.js: a commentary card's
// comments, its pages, and where synced cards go.

import test from 'node:test';
import assert from 'node:assert/strict';

import { commentariesOn, commentaryView, entriesOn, entryAddress, pagesOf } from '../app/data/commentaries.js';
import { passageOf, syncedAddress } from '../app/lib/commentary-address.js';

test('a passage shows the comments in it, or the one before it in the chapter', () => {
  const entries = [{ from: 'JHN.3.1', to: 'JHN.3.8', blocks: [] }, { from: 'JHN.3.22', to: 'JHN.3.36', blocks: [] }];
  assert.deepEqual(entriesOn(entries, { book: 'JHN', chapter: 3, from: 16 }), { first: 0, last: 0 });
  assert.deepEqual(entriesOn(entries, { book: 'JHN', chapter: 3, from: 20, to: 25 }), { first: 1, last: 1 });
  assert.deepEqual(entriesOn(entries, { book: 'JHN', chapter: 3 }), { first: 0, last: 1 });
  assert.deepEqual(entriesOn(entries, { book: 'JHN', chapter: 4, from: 1 }), { first: -1, last: -1 });
  assert.equal(entryAddress(entries[0]), 'JHN.3.1-8');
  assert.equal(entryAddress({ from: 'JHN.3.36', to: 'JHN.4.2', blocks: [] }), 'JHN.3.36-4.2');
});

test('a long comment is cut into pages between paragraphs', () => {
  const paragraph = { p: ['x'.repeat(1500)] };
  const pages = pagesOf([{ from: 'GEN.1.1', blocks: [paragraph, paragraph, paragraph, paragraph] }]);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].label, 'Verse 1');
});

test("the commentary's own verses line is left out, as the label says it", () => {
  const [page] = pagesOf([{ from: 'JHN.3.22', to: 'JHN.3.36', blocks: [{ p: [{ b: 'Verses 22-36' }] }, { p: ['John was satisfied.'] }] }]);
  assert.deepEqual(page.map((shown) => shown.label || shown.runs[0]?.text), ['Verses 22–36', 'John was satisfied.']);
});

test('a card of Matthew Henry on John 3:16, with its steps', async () => {
  const view = await commentaryView('commentary:mhcc:JHN.3.16');
  assert.ok(view);
  assert.equal(view.title, 'Matthew Henry on John 3:16');
  assert.equal(view.shown[0].label, 'Verses 1–8');
  assert.match(view.next, /^commentary:mhcc:JHN\.3\.(?:1-8~2|22-36)$/);
  assert.equal(await commentaryView('commentary:nope:JHN.3.16'), null);
  const catena = await commentaryView('commentary:catena:GEN.1.1');
  assert.deepEqual(catena?.shown, [], 'the Catena is on the Gospels only');
});

test('the guide lists each commentary with a comment, with its first words', async () => {
  const found = await commentariesOn({ book: 'JHN', chapter: 3, from: 16 });
  assert.deepEqual(found.map((each) => each.address.split(':')[1]), ['mhcc', 'jfb', 'wesley', 'geneva', 'catena']);
  assert.ok(found.every((each) => each.text.length > 0 && each.text.length <= 161));
});

test('a synced card follows to the same passage', () => {
  assert.equal(passageOf('commentary:mhcc:JHN.3.1-8~2'), 'JHN.3.1-8');
  assert.equal(syncedAddress('commentary:jfb:JHN.3.16', 'JHN.3.17'), 'commentary:jfb:JHN.3.17');
  assert.equal(syncedAddress('JHN.3.16', 'commentary:mhcc:JHN.3.22-36'), 'JHN.3.22-36');
  assert.equal(syncedAddress('commentary:wesley:JHN.3.16', 'commentary:mhcc:JHN.3.22-36~2'), 'commentary:wesley:JHN.3.22-36');
});
