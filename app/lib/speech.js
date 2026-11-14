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

let woken = false;

/**
 * Lets the page speak. Safari on an iPhone speaks only if its first speak()
 * comes in the tap itself; the app waits for the voices before it speaks,
 * so the first reading after Safari opens marked its verse in silence. A
 * silent utterance in the tap opens the way, once a page. Call it before
 * the first await.
 */
export function wake() {
  const speech = synth();
  if (!speech || woken) return;
  woken = true;
  const silence = new SpeechSynthesisUtterance(' ');
  silence.volume = 0;
  speech.speak(silence);
}

/** @param {number} ms */
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Stops whatever the voice says (the silence that wake() said, a word, the
 * last reading), and waits until it has stopped. Safari stops a moment
 * after cancel(), and then tells the utterance spoken next that it has
 * ended: the first verse was taken as read while the voice read it, and the
 * mark ran a verse ahead of the voice. So the next words wait for the quiet,
 * a third of a second at most.
 */
export async function quiet() {
  const speech = synth();
  if (!speech || !busy(speech)) return;
  speech.cancel();
  for (let tries = 0; tries < 10 && busy(speech); tries++) await pause(30);
  await pause(50);
}

/** @param {SpeechSynthesis} speech whether it says something, or has more to say */
const busy = (speech) => speech.speaking || speech.pending;

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
 * A language's voices on the device, the best first (voiceScore): the
 * reader's own accent, then quality. The voices for fun are left out.
 *
 * @param {Lang} lang
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export async function voicesFor(lang) {
  const preferred = readerLanguages();
  return (await voices()).filter((voice) => speaks(voice, lang) && !novelty(voice)).sort((a, b) => voiceScore(b, lang, preferred) - voiceScore(a, lang, preferred));
}

/**
 * Whether a language is better read in the device's own voice, by naming no
 * voice, than in the best one the browser lists. Safari lists only the
 * small compact voices, never the Premium or Enhanced ones that the device
 * has downloaded, yet it reads in the device's own voice (the one chosen in
 * Spoken Content, Ava (Premium) say) when a page names none: naming the
 * best it lists would put compact Samantha in Ava's place. So the device's
 * own voice reads the reader's own language, unless the browser lists a
 * Premium, Enhanced or Natural one, or the device's own is a voice for fun
 * (where the browser says which is its own: Safari calls every voice its
 * own, which says nothing).
 *
 * @param {{ name: string, voiceURI?: string } | null | undefined} best the best voice listed (voicesFor)
 * @param {Lang} lang
 * @param {string} reader the reader's language (navigator.language)
 * @param {{ name: string, voiceURI?: string, default: boolean }[]} all every voice listed
 */
export function ownVoiceFits(best, lang, reader, all) {
  if (!best || tagOf(reader).split('-')[0] !== lang || qualityScore(best) >= 4) return false;
  const marked = all.filter((voice) => voice.default);
  return !(marked.length === 1 && novelty(marked[0]));
}

/** @returns {string} the reader's language, as the browser says it */
const readerLanguage = () => (typeof navigator === 'undefined' ? '' : navigator.language ?? '');

/**
 * The voice that Automatic names for a language: the best listed, or null
 * for the device's own (ownVoiceFits).
 *
 * @param {Lang} lang
 * @returns {Promise<SpeechSynthesisVoice | null>}
 */
export async function automaticVoice(lang) {
  const list = await voicesFor(lang);
  return ownVoiceFits(list[0], lang, readerLanguage(), await voices()) ? null : (list[0] ?? null);
}

/**
 * The voice to name on what is read: the one the reader chose in Tools, if
 * the device still has it; else Automatic's (null: the device's own).
 *
 * @param {Lang} lang
 * @returns {Promise<SpeechSynthesisVoice | null>}
 */
export async function namedVoice(lang) {
  const chosen = voiceChoice(lang);
  const found = chosen ? (await voicesFor(lang)).find((voice) => voice.voiceURI === chosen) : undefined;
  return found ?? automaticVoice(lang);
}

/**
 * A voice that can read a language, the chosen one or the best: null when
 * the device has none, and the app says so.
 *
 * @param {Lang} lang
 * @returns {Promise<SpeechSynthesisVoice | null>}
 */
export async function voiceFor(lang) {
  const all = await voicesFor(lang);
  const chosen = voiceChoice(lang);
  return all.find((voice) => chosen && voice.voiceURI === chosen) ?? all[0] ?? null;
}

/**
 * Names a voice on an utterance; with none, the device's own reads, and the
 * utterance says its language only where that is not the reader's.
 *
 * @param {SpeechSynthesisUtterance} utterance
 * @param {SpeechSynthesisVoice | null} voice
 * @param {Lang} lang
 */
function voiceOn(utterance, voice, lang) {
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else if (tagOf(readerLanguage()).split('-')[0] !== lang) {
    utterance.lang = lang;
  }
}

// The voice the reader chose for each language, by its identifier
// (voiceURI), kept in this browser; none for the best one.
const VOICE_KEY = 'bible.voice.';

/**
 * @param {Lang} lang
 * @returns {string} the chosen voice's identifier, or '' for the best one
 */
export function voiceChoice(lang) {
  try {
    return localStorage.getItem(VOICE_KEY + lang) ?? '';
  } catch {
    return '';
  }
}

/**
 * @param {Lang} lang
 * @param {string} uri a voice's identifier, or '' for the best one
 */
export function setVoiceChoice(lang, uri) {
  try {
    if (uri) localStorage.setItem(VOICE_KEY + lang, uri);
    else localStorage.removeItem(VOICE_KEY + lang);
  } catch {
    // No storage: the choice lasts until the page closes.
  }
}

/**
 * A voice as the voice list in Tools names it: its name without the words
 * that the browser adds, its country, and its quality; "online" for a voice
 * that sends the text to a server to be read.
 *
 *   "Ava, United States, Premium"   "Libby, United Kingdom, Natural, online"
 *
 * @param {{ name: string, voiceURI?: string, lang: string, localService: boolean }} voice
 * @param {(region: string) => string} [country] a region code's name
 */
export function voiceLabel(voice, country = countryName) {
  const name = voice.name
    .replace(/\s*\((premium|enhanced)\)/i, '')
    .replace(/^Microsoft\s+/, '')
    .replace(/\s+Online\s+\(Natural\)/i, '')
    .replace(/\s+-\s+.*$/, '')
    .trim();
  const region = tagOf(voice.lang).split('-')[1] ?? '';
  return [name, region && country(region.toUpperCase()), qualityName(voice), voice.localService ? '' : 'online'].filter(Boolean).join(', ');
}

/** @param {{ name: string, voiceURI?: string }} voice its quality's name, or '' */
function qualityName(voice) {
  const score = qualityScore(voice);
  if (score === 5) return 'Premium';
  if (score < 4) return '';
  return /natural/i.test(voice.name) ? 'Natural' : 'Enhanced';
}

/** @param {string} region "GB" as "United Kingdom"; the code itself where the browser cannot say */
function countryName(region) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) ?? region;
  } catch {
    return region;
  }
}

/** What a voice says when the reader tries it in Tools: John 1:1 (Genesis 1:1 in Hebrew). */
export const SAMPLES = {
  en: 'In the beginning was the Word, and the Word was with God, and the Word was God.',
  he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ',
  el: 'Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν',
};

/**
 * Whether a voice speaks a language (Hebrew is also "iw", its old code).
 *
 * @param {{ lang: string }} voice
 * @param {Lang} lang
 */
export function speaks(voice, lang) {
  return tagOf(voice.lang).startsWith(lang) || (lang === 'he' && voice.lang.startsWith('iw'));
}

/** The reader's languages, as their browser lists them, the first first. */
function readerLanguages() {
  return typeof navigator === 'undefined' ? [] : [...(navigator.languages ?? [navigator.language])].filter(Boolean);
}

/** @param {string} tag "en_gb" as "en-GB"'s lower case: "en-gb" */
const tagOf = (tag) => tag.toLowerCase().replace('_', '-');

/**
 * How near a voice is to the reader's own accent: 6 for the first of their
 * languages with a region (en-GB, en-AU) that the voice speaks, one less for
 * each later one, 0 for another region. A reader whose languages name no
 * region of this language hears a British voice first, as the KJV is. The
 * first region outweighs any quality (qualityScore).
 *
 * @param {string} voiceLang
 * @param {Lang} lang
 * @param {readonly string[]} preferred
 */
export function accentScore(voiceLang, lang, preferred) {
  const regions = preferred.map(tagOf).filter((tag) => tag.startsWith(`${lang}-`));
  const tag = tagOf(voiceLang);
  if (!regions.length) return lang === 'en' && tag === 'en-gb' ? 1 : 0;
  const index = regions.indexOf(tag);
  return index < 0 ? 0 : Math.max(1, 6 - index);
}

/**
 * How good a voice sounds, from its name and its identifier (voiceURI).
 * Safari on an iPhone names an Apple voice "Ava" at every quality: only its
 * identifier says which (com.apple.voice.premium.en-US.Ava,
 * com.apple.voice.enhanced…, com.apple.voice.compact…,
 * com.apple.voice.super-compact…). Chrome and Edge say it in the name
 * ("Ava (Premium)", "Microsoft Libby Online (Natural)").
 *
 * @param {{ name: string, voiceURI?: string }} voice
 */
export function qualityScore({ name, voiceURI = '' }) {
  const said = `${name} ${voiceURI}`;
  if (/premium/i.test(said)) return 5;
  if (/enhanced|natural|neural/i.test(said)) return 4;
  return /super-compact/i.test(said) ? -1 : 0;
}

/**
 * Whether a voice is one for fun, or one of the Mac's and iPhone's old
 * robotic voices (Eloquence), by its name or its identifier.
 *
 * @param {{ name: string, voiceURI?: string }} voice
 */
const novelty = ({ name, voiceURI = '' }) => NOVELTY.test(name) || /com\.apple\.eloquence/i.test(voiceURI);

/**
 * How good a voice is for reading: not one for fun, of the better quality
 * where it says so, in the reader's accent (a reader in Britain wants a
 * British voice: the accent comes before quality), on the device itself.
 *
 * @param {{ name: string, voiceURI?: string, lang: string, localService: boolean, default: boolean }} voice
 * @param {Lang} lang
 * @param {readonly string[]} [preferred] the reader's languages (navigator.languages)
 */
export function voiceScore(voice, lang, preferred = readerLanguages()) {
  return (
    (novelty(voice) ? -10 : 0) +
    qualityScore(voice) +
    (voice.localService ? 2 : 0) +
    accentScore(voice.lang, lang, preferred) +
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
// or the device's voice.
const READER_KEY = 'bible.reader';
export const READERS = /** @type {const} */ (['own', 'device']);

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
 * A verse's text as it is read, with the next piece of the page's text on
 * the end: each run of spaces and line breaks one space, none at the start,
 * and the paragraph mark left out. Built a piece at a time, so that where a
 * word begins in it is where the voice says it begins (a `boundary` event's
 * charIndex); squeezing the spaces afterwards would move every word.
 *
 * @param {string} text the text so far
 * @param {string} piece
 */
export function joinText(text, piece) {
  const squeezed = piece.replace(/¶/g, '').replace(/\s+/g, ' ');
  return text + (!text || text.endsWith(' ') ? squeezed.replace(/^ /, '') : squeezed);
}

/** @typedef {{ perChar: number, last: { at: number, time: number } | null, timer: number }} Pace a voice's pace in a verse, from its words so far */

/** A voice's pace before it has said two words: milliseconds a letter at 1×. */
const START_PACE = 60;

/** How long before the voice says a word has begun that the word is marked: Safari tells each word about this late. */
export const LEAD = 200;

/** The pause after a mark, as so many letters' time. */
const PAUSES = { ',': 5, ';': 6, ':': 6, '.': 8, '?': 8, '!': 8 };

/**
 * The pause at the end of a stretch of text, as so many letters' time: 0
 * with no mark at its end.
 *
 * @param {string} stretch
 */
const pauseIn = (stretch) => PAUSES[/** @type {keyof typeof PAUSES} */ (stretch.trimEnd().slice(-1))] ?? 0;

/**
 * The pace, in milliseconds a letter, with one more stretch heard: a third
 * the new, two thirds the old, so one slow word does not throw it. A
 * stretch with a pause in it is left out, as its pause is not its pace.
 *
 * @param {number} perChar
 * @param {string} stretch the text from one word to the next
 * @param {number} ms how long it took
 */
export function paced(perChar, stretch, ms) {
  if (!stretch.length || pauseIn(stretch) || ms <= 0) return perChar;
  const heard = Math.min(200, Math.max(20, ms / stretch.length));
  return perChar + (heard - perChar) / 3;
}

/**
 * How long from a word's start until its next word is marked: the stretch
 * between them at the pace, with any pause, less LEAD.
 *
 * @param {string} stretch the text from the word to the next
 * @param {number} perChar
 * @param {number} [lead]
 */
export function untilNext(stretch, perChar, lead = LEAD) {
  return Math.max(0, (stretch.length + pauseIn(stretch)) * perChar - lead);
}

/**
 * The pace with a word heard at a time: from the last word heard to it.
 *
 * @param {Pace} pace changed in place
 * @param {string} text
 * @param {number} at where the word begins in the text
 * @param {number} time when it was heard
 */
function learn(pace, text, at, time) {
  const { last } = pace;
  if (last && at > last.at) pace.perChar = paced(pace.perChar, text.slice(last.at, at), time - last.time);
  pace.last = { at, time };
}

/**
 * Says one word, slower than reading.
 *
 * @param {string} text
 * @param {Lang} lang
 * @param {number} [rate] slower than reading, as a word is said alone
 * @returns {Promise<boolean>} false when the device has no voice for it
 */
export async function sayWord(text, lang, rate = 0.75 * speed()) {
  wake();
  const speech = synth();
  if (!speech || !(await voiceFor(lang))) return false;
  const voice = await namedVoice(lang);
  // A reading under way stops first, so its card shows it has stopped.
  /** @type {any} */ (Reader.current)?.stop();
  speech.cancel();
  const utterance = new SpeechSynthesisUtterance(lang === 'he' ? sayableHebrew(text) : text);
  voiceOn(utterance, voice, lang);
  utterance.rate = rate;
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
    wake();
    Reader.current?.stop();
    Reader.current = this;
    const missing = await missingVoice(items);
    if (missing) return missing;
    // Another reading began while the voices loaded: it wins.
    if (Reader.current !== this) return null;
    await quiet();
    // Another reading began while the last went quiet: it wins.
    if (Reader.current !== this) return null;
    this.items = items;
    this.at = Math.min(Math.max(0, start), items.length - 1) - 1;
    this.onEnd = onEnd ?? null;
    this.stopped = false;
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
    const voice = await namedVoice(item.lang);
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
    voiceOn(utterance, voice, item.lang);
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
    /** @type {Pace} */
    const pace = { perChar: START_PACE / utterance.rate, last: null, timer: 0 };
    utterance.addEventListener('boundary', (event) => {
      if (event.name === 'word') this.hear(item.text, words, event.charIndex, pace);
    });
    utterance.addEventListener('end', () => {
      clearTimeout(pace.timer);
      item.element.classList.remove('is-read');
      if (this.live()) this.next();
    });
    utterance.addEventListener('error', () => {
      clearTimeout(pace.timer);
      item.element.classList.remove('is-read');
      if (this.live()) this.finish(item.element);
    });
  }

  /**
   * A word the voice says it has begun: marked, and the next word marked a
   * little before the voice says that one has begun (untilNext), at the
   * pace the voice has kept so far. Safari tells each word late, so marking
   * only on its word made the mark trail the voice.
   *
   * @param {string} text the verse as it is read
   * @param {NonNullable<Item['words']>} words
   * @param {number} at where the word begins in the text
   * @param {Pace} pace changed in place
   */
  hear(text, words, at, pace) {
    learn(pace, text, at, performance.now());
    clearTimeout(pace.timer);
    const index = words.findIndex((each) => at >= each.start && at < each.end);
    this.mark(words[index]?.element ?? null);
    const next = words[index + 1];
    if (index < 0 || !next) return;
    pace.timer = setTimeout(() => {
      if (this.live()) this.mark(next.element);
    }, untilNext(text.slice(words[index].start, next.start), pace.perChar));
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
   * @param {{ title?: string, artist?: string, album?: string, resume?: () => void, failed?: () => void }} [options]
   *   the passage's name, its reader and its version, for the lock screen;
   *   how to go on after a pause there; and what to do when the recording
   *   cannot be played (a missing file, no network)
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
    const { title = 'The Bible', artist = "The app's voice", album = '' } = this.options;
    media.metadata = new MediaMetadata({ title, artist, album });
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
      audio.addEventListener('ended', end, { signal: listening.signal });
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
