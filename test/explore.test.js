import assert from 'node:assert/strict';
import test from 'node:test';
import { journeys, journeysFor } from '../app/data/journeys.js';
import { entities } from '../app/data/entities.js';
import { facts, didYouKnow } from '../app/data/facts.js';
import { entityResults } from '../app/data/bible.js';

test('every stop of every journey is a place on the map, named in its verse', async () => {
  const known = await entities();
  for (const journey of journeys) {
    for (const stop of journey.stops) {
      const place = known[stop.place];
      assert.ok(place, `${journey.id}: ${stop.place}`);
      assert.ok(place.lat !== null && place.lon !== null, `${journey.id}: ${stop.place} has no coordinates`);
      // The verse names the place, or names the region the stop reads it from.
      if (!stop.reading) assert.ok(place.verses.includes(stop.ref), `${journey.id}: ${place.title} is not in ${stop.ref}`);
    }
    assert.ok(known[journey.event]?.kind === 'event', `${journey.id}: ${journey.event}`);
  }
  const viewed = await journeysFor({ person: 'person:paul_2479' });
  assert.equal(viewed.length, 4);
  for (const journey of viewed) {
    assert.equal(journey.stops.length, journeys.find((each) => each.id === journey.id)?.stops.length);
    assert.ok(journey.km > 1000, `${journey.title}: ${journey.km} km`);
    assert.match(journey.years, /^AD \d+/);
  }
  assert.deepEqual((await journeysFor({ address: 'ACT.16.11' })).map((journey) => journey.id), ['paul-2']);
});

test('See also names who is named with whom, not who is named everywhere', async () => {
  const paul = await entityResults('person:paul_2479', 1);
  const names = paul.seeAlso.map((each) => each.title);
  assert.ok(names.includes('Barnabas'), names.join(', '));
  assert.ok(!names.includes('God'), names.join(', '));
});

test('every Did you know? names its source, and Another goes through them all', async () => {
  const list = await facts();
  assert.ok(list.length >= 15, `${list.length} facts`);
  for (const fact of list) {
    assert.ok(fact.text.length > 20 && fact.source.length > 10, fact.text);
  }
  assert.ok(list.some((fact) => /John 11:35/.test(fact.text)));
  const first = await didYouKnow(0);
  assert.equal(first.next, 1);
  assert.equal((await didYouKnow(list.length - 1)).next, 0);
});

test('every picture has its file, a credit, a record, and subjects that exist', async () => {
  const { images, imagesFor } = await import('../app/data/images.js');
  const { existsSync } = await import('node:fs');
  const known = await entities();
  assert.ok(images.length >= 40, `${images.length} pictures`);
  for (const image of images) {
    assert.ok(existsSync(`app/public${image.file}`), image.file);
    assert.ok(image.width > 0 && image.height > 0, image.id);
    assert.match(image.credit, /Library of Congress|Metropolitan Museum/);
    assert.match(image.url, /^https:\/\//);
    for (const id of image.entities) assert.ok(known[id], `${image.id}: ${id}`);
  }
  assert.ok(imagesFor('place:jerusalem_636').length >= 2);
});
