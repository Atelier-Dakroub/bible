import assert from 'node:assert/strict';
import test from 'node:test';
import { greekAccent, syllablesOf } from '../app/lib/syllables.js';

/** @param {'hebrew' | 'greek'} language @param {string} text @param {string} translit */
const said = (language, text, translit) => syllablesOf(language, text, translit).map((s) => (s.stress ? s.text.toUpperCase() : s.text)).join('·');

test('Hebrew: STEPBible marks the syllables and the stress', () => {
  assert.equal(said('hebrew', '', 'be.re.Shit'), 'be·re·SHIT');
  assert.equal(said('hebrew', '', 'me.tu.She.lach'), 'me·tu·SHE·lach');
  // A name's capital is not its stress.
  assert.equal(said('hebrew', '', "'E.lo.Him"), "'e·lo·HIM");
  assert.equal(said('hebrew', '', 'Ya.red'), 'YA·red');
  // One syllable: nothing to mark.
  assert.equal(said('hebrew', '', "'et"), "'et");
});

test('Greek: syllables by the vowels, the stress where the accent is', () => {
  assert.deepEqual(greekAccent('ἠγάπησεν'), { cores: 4, accent: 1 });
  assert.equal(said('greek', 'ἠγάπησεν', 'ēgapēsen'), 'ē·GA·pē·sen');
  assert.equal(said('greek', 'οὕτως', 'houtōs'), 'HOU·tōs');
  assert.equal(said('greek', 'ἐκκλησία', 'ekklēsia'), 'ek·klē·SI·a');
  assert.equal(said('greek', 'πνεῦμα', 'pneuma'), 'PNEU·ma');
  assert.equal(said('greek', 'Χριστός', 'Christos'), 'chris·TOS'.replace('chris', 'Chris'));
  assert.equal(said('greek', 'μονογενῆ', 'monogenē'), 'mo·no·ge·NĒ');
  // A diaeresis parts two vowels: three cores, not two.
  assert.equal(greekAccent('προϊστάμενος').cores, 5);
});
