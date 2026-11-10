// A word of the Hebrew or the Greek as syllables, with the stressed one
// marked: how to say it, in the transliteration the app already shows.
//
// Hebrew: STEPBible's transliteration has its syllables and its stress
// already, "me.tu.She.lach": a dot between syllables, a capital letter in the
// stressed one. A name can begin with a capital too ("'E.lo.Him"), so the
// stress is the last syllable with one. A word of one syllable has nothing
// to mark.
//
// Greek: the transliteration has neither, "ēgapēsen". Its syllables are found
// by its vowels: each vowel or diphthong is a syllable's core, and the
// consonants between two cores go with the second, but the first of two or
// more goes with the first (e-gap-, not eg-ap-). The stress is where the
// Greek word has its accent (acute, grave or circumflex): ἠγάπησεν has it on
// its second vowel, so ē·GA·pē·sen. When the two do not count the same
// vowels, the syllables are shown with no stress.

/** @typedef {{ text: string, stress: boolean }} Syllable */

/**
 * @param {string} translit such as "me.tu.She.lach"
 * @returns {Syllable[]}
 */
export function hebrewSyllables(translit) {
  const parts = translit.split('.').filter(Boolean);
  if (parts.length === 1) return [{ text: parts[0].toLowerCase(), stress: false }];
  const last = parts.findLastIndex((part) => /[A-Z]/.test(part));
  return parts.map((part, i) => ({ text: part.toLowerCase(), stress: i === last }));
}

// The Greek vowels, without their marks, and the pairs that sound as one.
const GREEK_VOWELS = new Set('αεηιουω');
const GREEK_DIPHTHONGS = new Set(['αι', 'ει', 'οι', 'υι', 'αυ', 'ευ', 'ου', 'ηυ']);
// Acute, grave, circumflex (as Unicode combining marks).
const ACCENTS = /[̀́͂]/;
const DIAERESIS = '̈';

/**
 * Which vowel core of a Greek word carries its accent, counted from the
 * start, and how many cores it has.
 *
 * @param {string} greek such as "ἠγάπησεν"
 * @returns {{ cores: number, accent: number }} accent -1 when it has none
 */
export function greekAccent(greek) {
  // One letter with its marks to each item.
  const letters = [...greek.normalize('NFD').toLowerCase()].reduce((list, char) => {
    if (/\p{M}/u.test(char) && list.length) list[list.length - 1] += char;
    else list.push(char);
    return list;
  }, /** @type {string[]} */ ([]));
  let cores = 0;
  let accent = -1;
  for (let i = 0; i < letters.length; i += 1) {
    const base = letters[i][0];
    if (!GREEK_VOWELS.has(base)) continue;
    let marks = letters[i].slice(1);
    const next = letters[i + 1];
    // A diphthong, unless its second vowel has a diaeresis: the accent of a
    // diphthong sits on its second vowel.
    if (next && GREEK_DIPHTHONGS.has(base + next[0]) && !next.includes(DIAERESIS)) {
      marks += next.slice(1);
      i += 1;
    }
    if (ACCENTS.test(marks)) accent = cores;
    cores += 1;
  }
  return { cores, accent };
}

// The transliteration's vowels and diphthongs, longest first, and the
// consonants that are written with two letters.
const LATIN_CORES = ['ēu', 'ai', 'ei', 'oi', 'ui', 'au', 'eu', 'ou', 'a', 'e', 'ē', 'i', 'o', 'ō', 'u', 'y'];
const LATIN_DOUBLE = ['th', 'ph', 'ch', 'ps', 'rh'];

/**
 * @param {string} greek the word in Greek, for its accent
 * @param {string} translit such as "ēgapēsen"
 * @returns {Syllable[]}
 */
export function greekSyllables(greek, translit) {
  const word = translit.normalize('NFC');
  /** @type {{ core: boolean, text: string }[]} */
  const units = [];
  for (let i = 0; i < word.length; ) {
    const lower = word.slice(i).toLowerCase();
    const core = LATIN_CORES.find((each) => lower.startsWith(each));
    if (core) {
      units.push({ core: true, text: word.slice(i, i + core.length) });
      i += core.length;
      continue;
    }
    const double = LATIN_DOUBLE.find((each) => lower.startsWith(each));
    const length = double ? 2 : 1;
    units.push({ core: false, text: word.slice(i, i + length) });
    i += length;
  }
  const cores = units.filter((unit) => unit.core).length;
  if (cores < 2) return [{ text: word, stress: false }];

  /** @type {string[]} */
  const syllables = [];
  let current = '';
  /** @type {string[]} */
  let between = [];
  for (const unit of units) {
    if (!unit.core) {
      between.push(unit.text);
      continue;
    }
    if (syllables.length || current) {
      // The consonants between two cores: one goes on, more are split.
      const keep = between.length > 1 ? between.slice(0, 1) : [];
      const give = between.length > 1 ? between.slice(1) : between;
      syllables.push(current + keep.join(''));
      current = give.join('') + unit.text;
    } else {
      current = between.join('') + unit.text;
    }
    between = [];
  }
  syllables.push(current + between.join(''));

  const { cores: counted, accent } = greekAccent(greek);
  const stressed = counted === syllables.length ? accent : -1;
  return syllables.map((text, i) => ({ text, stress: i === stressed }));
}

/**
 * A word's syllables, by its language.
 *
 * @param {'hebrew' | 'greek'} language
 * @param {string} text the word in Hebrew or Greek
 * @param {string} translit
 * @returns {Syllable[]}
 */
export function syllablesOf(language, text, translit) {
  return language === 'hebrew' ? hebrewSyllables(translit) : greekSyllables(text, translit);
}
