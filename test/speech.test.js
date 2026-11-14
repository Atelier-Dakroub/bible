import assert from 'node:assert/strict';
import test from 'node:test';
import { accentScore, chaptersFrom, qualityScore, sayableHebrew, speaks, voiceScore } from '../app/lib/speech.js';

test('a voice speaks its language; Hebrew is also iw', () => {
  assert.equal(speaks({ lang: 'en-GB' }, 'en'), true);
  assert.equal(speaks({ lang: 'en_US' }, 'en'), true);
  assert.equal(speaks({ lang: 'he-IL' }, 'he'), true);
  assert.equal(speaks({ lang: 'iw-IL' }, 'he'), true);
  assert.equal(speaks({ lang: 'el-GR' }, 'el'), true);
  assert.equal(speaks({ lang: 'iw-IL' }, 'el'), false);
  assert.equal(speaks({ lang: 'fr-FR' }, 'en'), false);
});

test('the better voice reads: not one for fun, of high quality, on the device, British for English', () => {
  const voice = { name: 'Daniel', lang: 'en-GB', localService: true, default: false };
  assert.equal(voiceScore(voice, 'en', []), 3);
  assert.equal(voiceScore({ ...voice, name: 'Daniel (Enhanced)' }, 'en', []), 7);
  assert.equal(voiceScore({ ...voice, name: 'Zarvox' }, 'en', []), -7);
  assert.equal(voiceScore({ ...voice, lang: 'en-US', localService: false, default: true }, 'en', []), 0.5);
  assert.equal(voiceScore(voice, 'he', []), 2);
});

test('a voice in the reader\'s own accent reads first', () => {
  assert.equal(accentScore('en-AU', 'en', ['en-AU', 'en-GB', 'en']), 6);
  assert.equal(accentScore('en_GB', 'en', ['en-AU', 'en-GB', 'en']), 5);
  assert.equal(accentScore('en-US', 'en', ['en-AU', 'en-GB', 'en']), 0);
  assert.equal(accentScore('en-GB', 'en', ['en']), 1, 'no region: British, as the KJV is');
  assert.equal(accentScore('en-GB', 'en', ['fr-FR']), 1);
  assert.equal(accentScore('el-GR', 'el', ['en-GB']), 0);
  // In Australia, a plain Australian voice comes before an enhanced American one.
  const karen = { name: 'Karen', lang: 'en-AU', localService: true, default: false };
  const ava = { name: 'Ava (Premium)', lang: 'en-US', localService: true, default: true };
  assert.ok(voiceScore(karen, 'en', ['en-AU']) > voiceScore(ava, 'en', ['en-AU']));
  assert.ok(voiceScore(ava, 'en', ['en-US']) > voiceScore(karen, 'en', ['en-US']));
});

test('an iPhone\'s Enhanced or Premium voice is known by its identifier, as its name does not say', () => {
  assert.equal(qualityScore({ name: 'Ava', voiceURI: 'com.apple.voice.premium.en-US.Ava' }), 5);
  assert.equal(qualityScore({ name: 'Ava (Premium)' }), 5);
  assert.equal(qualityScore({ name: 'Evan', voiceURI: 'com.apple.voice.enhanced.en-US.Evan' }), 4);
  assert.equal(qualityScore({ name: 'Microsoft Libby Online (Natural) - English (United Kingdom)' }), 4);
  assert.equal(qualityScore({ name: 'Samantha', voiceURI: 'com.apple.voice.compact.en-US.Samantha' }), 0);
  assert.equal(qualityScore({ name: 'Samantha', voiceURI: 'com.apple.voice.super-compact.en-US.Samantha' }), -1);
  // An American reader: the Enhanced voice, not the old Siri voice, which is the default.
  const voice = (name, uri, extra = {}) => ({ name, voiceURI: `com.apple.voice.${uri}`, lang: 'en-US', localService: true, default: false, ...extra });
  const samantha = voice('Samantha', 'compact.en-US.Samantha', { default: true });
  const evan = voice('Evan', 'enhanced.en-US.Evan');
  assert.ok(voiceScore(evan, 'en', ['en-US']) > voiceScore(samantha, 'en', ['en-US']));
  // The old robotic voices are never chosen, whatever their name in the reader's language.
  assert.ok(voiceScore({ ...evan, name: 'Eddie', voiceURI: 'com.apple.eloquence.en-US.Eddy' }, 'en', ['en-US']) < 0);
});

test('a recording plays from a verse: its chapter begins there', () => {
  const chapters = [
    { file: 'a', verses: [{ id: 'X.1.1', at: 0, until: 5 }, { id: 'X.1.2', at: 5, until: 9 }] },
    { file: 'b', verses: [{ id: 'X.2.1', at: 0, until: 4 }, { id: 'X.2.2', at: 4, until: 8 }] },
  ];
  assert.equal(chaptersFrom(chapters, ''), chapters);
  assert.equal(chaptersFrom(chapters, 'Y.1.1'), chapters);
  assert.deepEqual(chaptersFrom(chapters, 'X.1.2').map((each) => [each.file, each.verses.map((verse) => verse.id)]), [['a', ['X.1.2']], ['b', ['X.2.1', 'X.2.2']]]);
  assert.deepEqual(chaptersFrom(chapters, 'X.2.2').map((each) => [each.file, each.verses.map((verse) => verse.id)]), [['b', ['X.2.2']]]);
});

test('Hebrew loses its cantillation and paragraph marks before it is read', () => {
  assert.equal(sayableHebrew('בְּרֵאשִׁ֖ית בָּרָ֣א ׃ פ'), 'בְּרֵאשִׁית בָּרָא');
});
