import assert from 'node:assert/strict';
import test from 'node:test';
import { topic, topicFor, topicsOf } from '../app/data/topics.js';
import { search } from '../app/data/bible.js';
import { KINDS } from '../app/lib/trail.js';

test("a topic of Nave's has its headings, its references as links, and where it sends the reader", async () => {
  const found = await topic('FORGIVENESS');
  assert.ok(found);
  assert.equal(found.name, 'Forgiveness');
  const enemies = found.lines.find((line) => line.label === 'Of enemies');
  assert.ok(enemies?.parts.some((part) => part.address === 'MAT.18.21-35'));
  assert.ok(found.lines.some((line) => line.see === 'ENEMY'));
  // "Instances of", and the people in small letters with their capitals.
  assert.ok(found.lines.some((line) => line.label === 'Instances of'));
  assert.ok(found.lines.some((line) => line.label === 'Esau forgives Jacob' && line.depth === 1));
});

test('a search names a topic, in the singular or the plural', async () => {
  assert.equal(await topicFor('prayer'), 'PRAYER');
  assert.equal(await topicFor('Prayers'), 'PRAYER');
  assert.equal(await topicFor('John 3:16'), '');
  const results = await search('forgiveness');
  assert.equal(results.topic?.key, 'FORGIVENESS');
  assert.equal(results.topicOpen, false);
});

test('the topics that cite a passage, and a topic step on the trail', async () => {
  const names = (await topicsOf('ROM.4.1-5')).map((each) => each.key);
  assert.ok(names.includes('FAITH'));
  assert.ok(names.includes('JUSTIFICATION'));
  assert.ok(KINDS.includes('topic'));
});
