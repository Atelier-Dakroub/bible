import assert from 'node:assert/strict';
import test from 'node:test';
import { chaptersFrom, sayableHebrew, speaks, voiceScore } from '../app/lib/speech.js';

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
  assert.equal(voiceScore(voice, 'en'), 3);
  assert.equal(voiceScore({ ...voice, name: 'Daniel (Enhanced)' }, 'en'), 7);
  assert.equal(voiceScore({ ...voice, name: 'Zarvox' }, 'en'), -7);
  assert.equal(voiceScore({ ...voice, lang: 'en-US', localService: false, default: true }, 'en'), 0.5);
  assert.equal(voiceScore(voice, 'he'), 2);
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
