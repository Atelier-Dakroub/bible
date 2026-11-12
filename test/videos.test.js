import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoById, videos, videosFor } from '../app/data/videos.js';

test('every video has a source to play and passages that parse', () => {
  for (const video of videos) {
    const play = video.play;
    const playable =
      play.kind === 'stream' ? /^https:\/\/stream\.mux\.com\/\w+\.m3u8$/.test(play.url)
      : play.kind === 'youtube' ? /^[\w-]{11}$/.test(play.id)
      : /^https:\/\/watch\.thechosen\.tv\/video\/\d+$/.test(video.link);
    assert.ok(playable, video.id);
    assert.ok(videoById(video.id)?.shows.length, `${video.id} shows no passage`);
  }
});

test('a passage finds the scene before the book overview', () => {
  const found = videosFor('LUK.2.1-20');
  assert.deepEqual(found.map((each) => each.id), ['jesus-02', 'bibleproject-luk-1']);
});

test('a passage in a book of two parts finds its part only', () => {
  assert.deepEqual(videosFor('GEN.15.1').map((each) => each.id), ['bibleproject-gen-2']);
  assert.deepEqual(videosFor('ISA.53.5').map((each) => each.id), ['bibleproject-isa-2']);
});

test('a book read with another finds their joint overview', () => {
  assert.deepEqual(videosFor('2KI.2.11').map((each) => each.id), ['bibleproject-1ki']);
  assert.deepEqual(videosFor('3JN.1.4').map((each) => each.id), ['bibleproject-1jn']);
});

test('a video shows its passages and its length as words', () => {
  const scene = videoById('jesus-02');
  assert.equal(scene?.where, 'Luke 1:26–2:20');
  assert.match(scene?.length ?? '', /^\d+:\d\d$/);
  assert.equal(videosFor('not an address').length, 0);
});

test('The Chosen links to its own site, seasons 1 to 5 only, and finds its passage', () => {
  const chosen = videos.filter((each) => each.source === 'the-chosen');
  assert.ok(chosen.length >= 35);
  for (const video of chosen) {
    assert.equal(video.play.kind, 'link');
    assert.equal(video.poster, '');
    assert.doesNotMatch(video.link, /amazon|prime/i);
  }
  assert.ok(videosFor('JHN.2.1-11').some((each) => each.id === 'chosen-s1e5'));
});

test('one source does not hide the others', () => {
  const sources = new Set(videosFor('JHN.1.1-51').map((each) => each.source));
  assert.ok(sources.has('the-chosen') && sources.has('bibleproject'), [...sources].join());
});
