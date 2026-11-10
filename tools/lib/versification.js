// The Hebrew Bible's verse numbers to the KJV's, for the imports that read
// data numbered as the Hebrew is (import-quotations.js, import-senses.js,
// import-syntax.js).
//
// STEPBible's Hebrew (TAHOT) numbers each word as English Bibles do, with the
// Hebrew number after it where the two differ: Psa.45.1(45.2)#01 is the
// first word of the KJV's Psalm 45:1, which the Hebrew calls 45:2. A Hebrew
// verse can hold words of two English verses: the Hebrew Psalm 23:1 is the
// title, Psa.23.0(23.1)#01–02, which the KJV does not number, and then the
// KJV's 23:1 (#03 on, with no number after it, as the two agree).

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * @param {string} folder the directory with the TAHOT files
 * @returns {Promise<{ verse: (address: string) => string, word: (address: string, n: number) => string }>}
 *   `verse` gives the KJV verse that most of a Hebrew verse's words are in
 *   (not a title, verse 0); `word` gives the KJV verse of one word, by its
 *   number in the Hebrew verse. Each takes and gives addresses such as
 *   PSA.23.1, and gives the address back where the numbers agree.
 */
export async function hebrewToKjv(folder) {
  /** @type {Map<string, string>} a Hebrew verse and word number to the KJV verse */
  const words = new Map();
  /** @type {Map<string, Map<string, number>>} a Hebrew verse to its KJV verses, and how many words each has */
  const verses = new Map();
  for (const name of (await readdir(folder)).filter((each) => /^TAHOT.*\.txt$/.test(each))) {
    const text = await readFile(path.join(folder, name), 'utf8');
    for (const [, book, chapter, verse, hebrewChapter, hebrewVerse, n] of text.matchAll(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)/gm)) {
      const id = book.toUpperCase();
      const english = `${id}.${chapter}.${verse}`;
      const hebrew = hebrewChapter ? `${id}.${hebrewChapter}.${hebrewVerse}` : english;
      words.set(`${hebrew}!${Number(n)}`, english);
      let counts = verses.get(hebrew);
      if (!counts) verses.set(hebrew, (counts = new Map()));
      counts.set(english, (counts.get(english) ?? 0) + 1);
    }
  }
  return {
    verse(address) {
      const counts = verses.get(address);
      if (!counts) return address;
      const ranked = [...counts].filter(([english]) => !english.endsWith('.0')).sort((a, b) => b[1] - a[1]);
      return ranked[0]?.[0] ?? address;
    },
    word(address, n) {
      return words.get(`${address}!${n}`) ?? this.verse(address);
    },
  };
}
