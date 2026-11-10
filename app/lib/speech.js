// Reading aloud with the device's own voices (the Web Speech API): the KJV
// and the BSB in English, the Hebrew and the Greek in their modern
// pronunciations, as the device's Hebrew and Greek voices read them.
//
// A device has the voices it has: a Mac or an iPhone has good English,
// Hebrew and Greek ones; another may have none for a language, and then
// voiceFor gives null and the app says so.
//
// The reader reads a list of items, one at a time, each a verse: its text,
// its language, and where its words are in the text, so the app can mark
// the word being read when the voice says where it is (a `boundary` event).
// Not every voice does; the verse is marked in any case.

/** @typedef {'en' | 'he' | 'el'} Lang */
/**
 * @typedef {{
 *   text: string, lang: Lang, element: Element,
 *   words?: { start: number, end: number, element: Element }[]
 * }} Item one verse to read: its text, and its words' places in the text
 */

/** @returns {SpeechSynthesis | null} */
const synth = () => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

/** The voices, once the device has listed them (Chrome lists them late). */
export function voices() {
  const speech = synth();
  if (!speech) return Promise.resolve(/** @type {SpeechSynthesisVoice[]} */ ([]));
  const now = speech.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speech.getVoices());
    speech.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

// The Mac's voices for fun, which no one wants reading the Bible.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Fred|Kathy|Grandma|Grandpa|Rocko|Shelley|Flo|Eddy|Reed|Sandy)\b/i;

/**
 * The best voice for a language: one on the device itself, of the better
 * quality where it says so, and for English a British one first, as the KJV
 * is.
 *
 * @param {Lang} lang
 * @returns {Promise<SpeechSynthesisVoice | null>}
 */
export async function voiceFor(lang) {
  const all = (await voices()).filter((voice) => voice.lang.toLowerCase().replace('_', '-').startsWith(lang === 'he' ? 'he' : lang === 'el' ? 'el' : 'en') || (lang === 'he' && voice.lang.startsWith('iw')));
  if (!all.length) return null;
  const score = (/** @type {SpeechSynthesisVoice} */ voice) =>
    (NOVELTY.test(voice.name) ? -10 : 0) +
    (/premium|enhanced|natural|neural/i.test(voice.name) ? 4 : 0) +
    (voice.localService ? 2 : 0) +
    (lang === 'en' && /en-GB/i.test(voice.lang) ? 1 : 0) +
    (voice.default ? 0.5 : 0);
  return [...all].sort((a, b) => score(b) - score(a))[0];
}

/** The name of a language, for "This device has no … voice". */
export const LANGUAGE_NAMES = { en: 'English', he: 'Hebrew', el: 'Greek' };

/**
 * Hebrew as a voice can read it: the points kept, the cantillation marks,
 * the end-of-verse mark and the paragraph marks taken out, and a maqaf
 * read as a space.
 *
 * @param {string} text
 */
export function sayableHebrew(text) {
  return text
    .replace(/[֑-ֽ֯׀׃׆]/g, '')
    .replace(/־/g, ' ')
    .replace(/(^|\s)[פס](?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Says one word, slower than reading.
 *
 * @param {string} text
 * @param {Lang} lang
 * @returns {Promise<boolean>} false when the device has no voice for it
 */
export async function sayWord(text, lang) {
  const speech = synth();
  const voice = await voiceFor(lang);
  if (!speech || !voice) return false;
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(lang === 'he' ? sayableHebrew(text) : text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.75;
  speech.speak(utterance);
  return true;
}

/**
 * Reads items one after another, marking each verse and, where the voice
 * tells, each word. One reading at a time on the page: a new one stops the
 * last.
 */
export class Reader {
  /** @type {Item[]} */
  items = [];
  at = -1;
  /** @type {(() => void) | null} */
  onEnd = null;
  stopped = true;

  /**
   * @param {Item[]} items
   * @param {() => void} [onEnd] when the last has been read, or the reading stopped
   * @returns {Promise<Lang | null>} the language with no voice on the device, or null
   */
  async read(items, onEnd) {
    Reader.current?.stop();
    Reader.current = this;
    const speech = synth();
    for (const lang of new Set(items.map((item) => item.lang))) {
      if (!speech || !(await voiceFor(lang))) return lang;
    }
    this.items = items;
    this.at = -1;
    this.onEnd = onEnd ?? null;
    this.stopped = false;
    speech?.cancel();
    await this.next();
    return null;
  }

  async next() {
    this.mark(null);
    this.at += 1;
    const item = this.items[this.at];
    const speech = synth();
    if (this.stopped || !item || !speech) {
      this.finish();
      return;
    }
    const voice = await voiceFor(item.lang);
    const utterance = new SpeechSynthesisUtterance(item.lang === 'he' ? sayableHebrew(item.text) : item.text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = item.lang === 'en' ? 0.95 : 0.85;
    item.element.classList.add('is-read');
    item.element.scrollIntoView?.({ block: 'nearest' });
    // Hebrew loses its marks before it is read, so its places no longer
    // fit: its words are not marked one by one.
    const words = item.lang === 'he' ? [] : (item.words ?? []);
    utterance.addEventListener('boundary', (event) => {
      if (event.name !== 'word') return;
      const word = words.find((each) => event.charIndex >= each.start && event.charIndex < each.end);
      this.mark(word?.element ?? null);
    });
    utterance.addEventListener('end', () => {
      item.element.classList.remove('is-read');
      if (!this.stopped && Reader.current === this) this.next();
    });
    utterance.addEventListener('error', () => {
      item.element.classList.remove('is-read');
    });
    speech.speak(utterance);
  }

  /** @param {Element | null} word */
  mark(word) {
    for (const each of document.querySelectorAll('.is-read-word')) each.classList.remove('is-read-word');
    word?.classList.add('is-read-word');
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    synth()?.cancel();
    for (const item of this.items) item.element.classList.remove('is-read');
    this.finish();
  }

  finish() {
    this.stopped = true;
    this.mark(null);
    if (Reader.current === this) Reader.current = null;
    const done = this.onEnd;
    this.onEnd = null;
    done?.();
  }

  /** @type {Reader | null} */
  static current = null;
}
