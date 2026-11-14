import assert from 'node:assert/strict';
import test from 'node:test';
import { LEAD, accentScore, chaptersFrom, joinText, paced, untilNext, ownVoiceFits, qualityScore, voiceLabel, sayableHebrew, speaks, voiceScore } from '../app/lib/speech.js';

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

test('the voice list names a voice by its name, its country and its quality', () => {
  const country = (region) => ({ US: 'United States', GB: 'United Kingdom', AU: 'Australia' })[region] ?? region;
  const voice = (name, lang, extra = {}) => ({ name, lang, localService: true, ...extra });
  assert.equal(voiceLabel(voice('Ava', 'en-US', { voiceURI: 'com.apple.voice.premium.en-US.Ava' }), country), 'Ava, United States, Premium');
  assert.equal(voiceLabel(voice('Evan (Enhanced)', 'en-US'), country), 'Evan, United States, Enhanced');
  assert.equal(voiceLabel(voice('Samantha', 'en-US', { voiceURI: 'com.apple.voice.compact.en-US.Samantha' }), country), 'Samantha, United States');
  assert.equal(voiceLabel(voice('Microsoft Libby Online (Natural) - English (United Kingdom)', 'en-GB', { localService: false }), country), 'Libby, United Kingdom, Natural, online');
  assert.equal(voiceLabel(voice('Google UK English Female', 'en-GB', { localService: false }), country), 'Google UK English Female, United Kingdom, online');
  assert.equal(voiceLabel(voice('Karen', 'en_AU'), country), 'Karen, Australia');
  assert.equal(voiceLabel(voice('Carmit', 'he'), country), 'Carmit');
});

test("Safari's compact voice gives way to the device's own, which may be Premium", () => {
  const voice = (name, uri, extra = {}) => ({ name, voiceURI: uri, default: true, ...extra });
  // Safari: compact voices only, every one called the device's own.
  const samantha = voice('Samantha', 'com.apple.voice.compact.en-US.Samantha');
  const safari = [samantha, voice('Daniel', 'com.apple.voice.compact.en-GB.Daniel'), voice('Bad News', 'com.apple.speech.synthesis.voice.BadNews')];
  assert.equal(ownVoiceFits(samantha, 'en', 'en-US', safari), true);
  // Chrome on a Mac lists Ava (Premium): she is named.
  const ava = voice('Ava (Premium)', 'Ava (Premium)', { default: false });
  assert.equal(ownVoiceFits(ava, 'en', 'en-US', [ava, { ...samantha, default: false }]), false);
  // Another language than the reader's: the device's own voice cannot read it.
  const carmit = voice('Carmit', 'com.apple.voice.compact.he-IL.Carmit');
  assert.equal(ownVoiceFits(carmit, 'he', 'en-US', [...safari, carmit]), false);
  // A device whose own voice is a voice for fun: the best plain one is named.
  const plain = { ...samantha, default: false };
  assert.equal(ownVoiceFits(plain, 'en', 'en-US', [plain, voice('Zarvox', 'com.apple.speech.synthesis.voice.Zarvox')]), false);
  assert.equal(ownVoiceFits(null, 'en', 'en-US', []), false);
});

test('a verse is read as it is built: its words stay where the voice says they are', () => {
  // A KJV verse's text nodes: the markup's line breaks, then its words.
  const pieces = ['\n\n\n\n\n\n\n  ', '\n  ', 'Now ', 'it ', 'came ', 'to ', 'pass, ', '\n', '¶ ', 'as'];
  let text = '';
  const places = [];
  for (const piece of pieces) {
    const start = text.length;
    text = joinText(text, piece);
    if (piece.trim() && piece !== '¶ ') places.push([piece.trim(), start]);
  }
  assert.equal(text, 'Now it came to pass, as');
  for (const [word, start] of places) assert.equal(text.slice(start).trimStart().startsWith(word), true, word);
  assert.equal(text.indexOf('came'), places[2][1]);
});

test('the next word is marked a little early, at the pace the voice has kept', () => {
  // "came " at 60 ms a letter: 300 ms, less the lead.
  assert.equal(untilNext('came ', 60), 300 - LEAD);
  // A comma's pause: five letters more.
  assert.equal(untilNext('pass, ', 60), (6 + 5) * 60 - LEAD);
  assert.equal(untilNext('it ', 40), 0, 'never before now');
  // The pace moves a third of the way to what was heard, and a pause is left out.
  assert.equal(paced(60, 'came ', 450), 60 + (90 - 60) / 3);
  assert.equal(paced(60, 'pass, ', 900), 60);
  assert.equal(paced(60, 'to ', 0), 60);
  assert.equal(paced(60, 'a ', 10000), 60 + (200 - 60) / 3, 'one slow word moves it only so far');
});
