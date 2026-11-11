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
  const all = (await voices()).filter((voice) => speaks(voice, lang));
  if (!all.length) return null;
  return [...all].sort((a, b) => voiceScore(b, lang) - voiceScore(a, lang))[0];
}

/**
 * Whether a voice speaks a language (Hebrew is also "iw", its old code).
 *
 * @param {{ lang: string }} voice
 * @param {Lang} lang
 */
export function speaks(voice, lang) {
  return voice.lang.toLowerCase().replace('_', '-').startsWith(lang) || (lang === 'he' && voice.lang.startsWith('iw'));
}

/**
 * How good a voice is for reading: not one for fun, of the better quality
 * where it says so, on the device itself, and for English a British one,
 * as the KJV is.
 *
 * @param {{ name: string, lang: string, localService: boolean, default: boolean }} voice
 * @param {Lang} lang
 */
export function voiceScore(voice, lang) {
  return (
    (NOVELTY.test(voice.name) ? -10 : 0) +
    (/premium|enhanced|natural|neural/i.test(voice.name) ? 4 : 0) +
    (voice.localService ? 2 : 0) +
    (lang === 'en' && /en-GB/i.test(voice.lang) ? 1 : 0) +
    (voice.default ? 0.5 : 0)
  );
}

// The reading speed, kept in this browser: 0.8 (slower) to 1.5 (faster),
// for the recording and the device's voice alike.
const SPEED_KEY = 'bible.speed';
export const SPEEDS = [0.8, 1, 1.15, 1.3, 1.5];

/** @returns {number} */
export function speed() {
  try {
    const kept = Number(localStorage.getItem(SPEED_KEY));
    return SPEEDS.includes(kept) ? kept : 1;
  } catch {
    return 1;
  }
}

/**
 * Sets the reading speed; a reading under way takes it at once (the
 * recording's next frame; the device's voice from its next verse).
 *
 * @param {number} value
 */
export function setSpeed(value) {
  try {
    localStorage.setItem(SPEED_KEY, String(value));
  } catch {
    // No storage: the speed lasts until the page closes.
  }
  const current = /** @type {any} */ (Reader.current);
  if (current?.audio) current.audio.playbackRate = value;
}

// Who reads a recorded version, kept in this browser: the app's own voice,
// LibriVox's reader (the KJV), or the device's voice.
const READER_KEY = 'bible.reader';
export const READERS = /** @type {const} */ (['own', 'librivox', 'device']);

/** @returns {typeof READERS[number]} */
export function readerChoice() {
  try {
    const kept = localStorage.getItem(READER_KEY);
    return READERS.includes(/** @type {any} */ (kept)) ? /** @type {any} */ (kept) : 'own';
  } catch {
    return 'own';
  }
}

/** @param {typeof READERS[number]} value */
export function setReaderChoice(value) {
  try {
    localStorage.setItem(READER_KEY, value);
  } catch {
    // No storage: the choice lasts until the page closes.
  }
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
  // A reading under way stops first, so its card shows it has stopped.
  /** @type {any} */ (Reader.current)?.stop();
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(lang === 'he' ? sayableHebrew(text) : text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.75 * speed();
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
  /** @type {((stoppedAt: Element | null) => void) | null} */
  onEnd = null;
  stopped = true;

  /**
   * @param {Item[]} items
   * @param {(stoppedAt: Element | null) => void} [onEnd] when the last has
   *   been read (null), or the reading stopped (the verse it stopped in)
   * @param {number} [start] the item to begin with
   * @returns {Promise<Lang | null>} the language with no voice on the device, or null
   */
  async read(items, onEnd, start = 0) {
    Reader.current?.stop();
    Reader.current = this;
    const missing = await missingVoice(items);
    if (missing) return missing;
    // Another reading began while the voices loaded: it wins.
    if (Reader.current !== this) return null;
    this.items = items;
    this.at = Math.min(Math.max(0, start), items.length - 1) - 1;
    this.onEnd = onEnd ?? null;
    this.stopped = false;
    synth()?.cancel();
    await this.next();
    return null;
  }

  /** Whether this reading goes on: it is not stopped, and no other began. */
  live() {
    return !this.stopped && Reader.current === this;
  }

  async next() {
    this.mark(null);
    this.at += 1;
    const item = this.items[this.at];
    const speech = synth();
    if (this.stopped || !item || !speech) return this.finish();
    const voice = await voiceFor(item.lang);
    if (this.live()) speech.speak(this.utter(item, voice));
  }

  /**
   * An item as an utterance, in its voice, at the reading speed. Hebrew is
   * read without its marks, so its places no longer fit: its words are not
   * marked one by one.
   *
   * @param {Item} item
   * @param {SpeechSynthesisVoice | null} voice
   */
  utter(item, voice) {
    const utterance = new SpeechSynthesisUtterance(sayable(item));
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = (item.lang === 'en' ? 0.95 : 0.85) * speed();
    item.element.classList.add('is-read');
    this.follow(utterance, item, item.lang === 'he' ? [] : (item.words ?? []));
    return utterance;
  }

  /**
   * Marks each word as the voice says it, and goes on to the next item at
   * the end. An utterance cut off (another word said, the voice failed)
   * ends the reading, so its card shows Listen again, not Pause.
   *
   * @param {SpeechSynthesisUtterance} utterance
   * @param {Item} item
   * @param {NonNullable<Item['words']>} words
   */
  follow(utterance, item, words) {
    utterance.addEventListener('boundary', (event) => {
      if (event.name !== 'word') return;
      const word = words.find((each) => event.charIndex >= each.start && event.charIndex < each.end);
      this.mark(word?.element ?? null);
    });
    utterance.addEventListener('end', () => {
      item.element.classList.remove('is-read');
      if (this.live()) this.next();
    });
    utterance.addEventListener('error', () => {
      item.element.classList.remove('is-read');
      if (this.live()) this.finish(item.element);
    });
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
    const at = this.items[this.at]?.element ?? null;
    for (const item of this.items) item.element.classList.remove('is-read');
    this.finish(at);
  }

  /** @param {Element | null} [stoppedAt] the verse it stopped in; none when it read to the end */
  finish(stoppedAt = null) {
    this.stopped = true;
    this.mark(null);
    if (Reader.current === this) Reader.current = null;
    const done = this.onEnd;
    this.onEnd = null;
    done?.(stoppedAt);
  }

  /** @type {Reader | null} */
  static current = null;
}

/**
 * The languages of the items that the device has no voice for: the first of
 * them, or null.
 *
 * @param {Item[]} items
 * @returns {Promise<Lang | null>}
 */
async function missingVoice(items) {
  const speech = synth();
  for (const lang of new Set(items.map((item) => item.lang))) {
    if (!speech || !(await voiceFor(lang))) return lang;
  }
  return null;
}

/** @param {Item} item its text as a voice can read it */
const sayable = (item) => (item.lang === 'he' ? sayableHebrew(item.text) : item.text);

/** The phone's lock screen and the media keys (Media Session), where the browser has them. */
const mediaSession = () => (typeof navigator !== 'undefined' ? navigator.mediaSession : undefined);

/** @param {MediaSession} media the lock screen cleared */
function release(media) {
  media.metadata = null;
  for (const action of /** @type {MediaSessionAction[]} */ (['pause', 'stop', 'play'])) media.setActionHandler(action, null);
}

/**
 * The chapters to play from a verse: the chapters before it go, and its
 * chapter begins there. From no verse, or one not in them: all of them.
 *
 * @param {RecordedChapter[]} chapters
 * @param {string} from
 */
export function chaptersFrom(chapters, from) {
  const at = chapters.findIndex((chapter) => chapter.verses.some((verse) => verse.id === from));
  if (at < 0) return chapters;
  const [first, ...rest] = chapters.slice(at);
  return [{ ...first, verses: first.verses.slice(first.verses.findIndex((verse) => verse.id === from)) }, ...rest];
}

/**
 * The verse being read at a time in its chapter's file, on the card.
 *
 * @param {RecordedChapter} chapter
 * @param {number} t
 * @param {(id: string) => Element | null} elementOf
 */
function verseAt(chapter, t, elementOf) {
  const verse = chapter.verses.findLast((each) => each.at <= t + 0.05);
  return verse ? elementOf(verse.id) : null;
}

/**
 * @typedef {{ file: string, verses: { id: string, at: number, until: number }[] }} RecordedChapter
 *   as routes/listen gives it (data/audio.js)
 */

/**
 * Plays a passage from the KJV's recording (data/audio.js), chapter by
 * chapter, marking the verse being read. It takes the place of a Reader:
 * one reading at a time on the page.
 *
 * The audio element must have begun playing in the reader's tap (muted, on
 * the first chapter's file), as a phone plays sound only from a tap: play
 * then seeks it to the first verse and lets it be heard.
 */
export class Recording {
  /** @type {{ element: Element }[]} */
  items = [];
  stopped = true;
  /** @type {((stoppedAt: Element | null) => void) | null} */
  onEnd = null;
  /** @type {AbortController | null} */
  listening = null;
  /** whether a file would not play */
  failed = false;

  /**
   * @param {HTMLAudioElement} audio
   * @param {{ title?: string, resume?: () => void, failed?: () => void }} [options] the passage's
   *   name, for the lock screen, how to go on after a pause there, and what
   *   to do when the recording cannot be played (a missing file, no network)
   */
  constructor(audio, options = {}) {
    this.audio = audio;
    this.options = options;
  }

  /**
   * The phone's lock screen and the keyboard's media keys (Media Session):
   * the passage and its reader, and Play and Pause, which pause the card's
   * reading as a tap on its verse does, and go on from there.
   *
   * @param {'playing' | 'paused' | 'none'} state
   */
  session(state) {
    const media = mediaSession();
    if (!media) return;
    if (state === 'playing') this.claim(media);
    if (state === 'none') release(media);
    media.playbackState = state;
  }

  /**
   * The lock screen shows the passage and its reader, and its keys pause
   * and go on.
   *
   * @param {MediaSession} media
   */
  claim(media) {
    media.metadata = new MediaMetadata({ title: this.options.title ?? 'The KJV', artist: 'Michael Armenta', album: 'King James Version, read for LibriVox' });
    media.setActionHandler('pause', () => this.stop());
    media.setActionHandler('stop', () => this.stop());
    media.setActionHandler('play', () => this.options.resume?.());
  }

  /**
   * @param {RecordedChapter[]} chapters
   * @param {(id: string) => Element | null} elementOf the verse on the card
   * @param {(stoppedAt: Element | null) => void} [onEnd] when the last has
   *   been read (null), or the playing stopped (the verse it stopped in)
   * @param {string} [from] the verse to begin with, if not the first
   */
  async play(chapters, elementOf, onEnd, from = '') {
    /** @type {any} */ (Reader.current)?.stop();
    Reader.current = /** @type {any} */ (this);
    synth()?.cancel();
    this.onEnd = onEnd ?? null;
    this.stopped = false;
    this.items = chapters.flatMap((chapter) => chapter.verses.map((verse) => ({ element: elementOf(verse.id) }))).filter((item) => item.element);
    this.session('playing');
    for (const chapter of chaptersFrom(chapters, from)) {
      if (this.stopped) return;
      await this.chapter(chapter, elementOf);
      if (this.failedOut()) return;
    }
    this.session('none');
    this.finish();
  }

  /** The file would not play: say so, and stop where it was. False if it played. */
  failedOut() {
    if (!this.failed || this.stopped) return false;
    this.session('none');
    this.options.failed?.();
    this.finish(this.marked);
    return true;
  }

  /**
   * Plays one chapter's verses, and resolves when the last has been read.
   *
   * @param {RecordedChapter} chapter
   * @param {(id: string) => Element | null} elementOf
   */
  chapter(chapter, elementOf) {
    const audio = this.audio;
    const first = chapter.verses[0];
    const last = chapter.verses[chapter.verses.length - 1];
    this.listening?.abort();
    const listening = new AbortController();
    this.listening = listening;
    return new Promise((resolve) => {
      const done = () => {
        listening.abort();
        resolve(undefined);
      };
      /** @param {unknown} [error] */
      const fail = (error) => {
        // A pause or a stop also rejects play(): that is not a failure.
        if (!(error instanceof DOMException && error.name === 'AbortError') && !this.stopped) this.failed = true;
        done();
      };
      const begin = () => {
        audio.currentTime = first.at;
        audio.muted = false;
        // Faster or slower, at the same pitch.
        audio.playbackRate = speed();
        audio.preservesPitch = true;
        audio.play().catch(fail);
      };
      if (!audio.src.endsWith(chapter.file)) audio.src = chapter.file;
      if (audio.readyState >= 1) begin();
      else audio.addEventListener('loadedmetadata', begin, { once: true, signal: listening.signal });
      // The end, on time: timeupdate comes only about four times a second,
      // so near the end a timer stops it.
      /** @type {ReturnType<typeof setTimeout> | undefined} */
      let timer;
      listening.signal.addEventListener('abort', () => clearTimeout(timer));
      const end = () => {
        audio.pause();
        this.mark(null);
        done();
      };
      /** @param {number} left seconds to the end, at the speed: under 0.6, a timer stops it */
      const endSoon = (left) => {
        if (left >= 0.6) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!audio.paused && !this.stopped && audio.currentTime >= last.until - 0.1) end();
        }, Math.max(0, left * 1000 - 20));
      };
      audio.addEventListener('timeupdate', () => {
        if (this.stopped) return done();
        const t = audio.currentTime;
        if (t >= last.until - 0.05) return end();
        endSoon((last.until - t) / (audio.playbackRate || 1));
        this.mark(verseAt(chapter, t, elementOf));
      }, { signal: listening.signal });
      audio.addEventListener('ended', done, { signal: listening.signal });
      audio.addEventListener('error', () => fail(), { signal: listening.signal });
    });
  }

  /** @type {Element | null} */
  marked = null;

  /**
   * Marks the verse being read. It does not scroll it into view: the table
   * moves by its own pan, and a scroll would shift the whole table.
   *
   * @param {Element | null} element
   */
  mark(element) {
    if (element === this.marked) return;
    this.marked?.classList.remove('is-read');
    element?.classList.add('is-read');
    this.marked = element;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.audio.pause();
    this.listening?.abort();
    this.session('paused');
    this.finish(this.marked);
  }

  /** @param {Element | null} [stoppedAt] the verse it stopped in; none when it played to the end */
  finish(stoppedAt = null) {
    this.stopped = true;
    this.mark(null);
    if (Reader.current === /** @type {any} */ (this)) Reader.current = null;
    const done = this.onEnd;
    this.onEnd = null;
    done?.(stoppedAt);
  }
}
