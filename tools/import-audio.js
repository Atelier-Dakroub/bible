#!/usr/bin/env node
// The KJV read aloud: LibriVox's complete KJV, read by Michael Armenta, cut
// into one file for each chapter, with the time at which each verse begins.
//
//   node tools/import-audio.js <LibriVox directory> <work directory> [audio directory]
//
// Source: "Bible (KJV), Complete", LibriVox (https://librivox.org/bible-kjv-complete-by-king-james-version-kjv/),
// read by Michael Armenta: 127 recordings of a few chapters each, MP3 at
// 64 kb/s, in the public domain. The LibriVox directory holds them with
// sections.json, which lists each one's number, title ("Genesis Ch. 1 - 14")
// and file.
//
// Each recording is transcribed with whisper.cpp (whisper-cli, with the
// ggml-base.en model in the work directory, or WHISPER_MODEL), with each
// word's time by dynamic time warping (-dtw), and its pauses are found with
// ffmpeg (silencedetect); both are kept in the work directory, so a run that
// stops goes on where it stopped. The words heard are matched to the KJV's words, book by book
// (tools/lib/align.js: anchors of four words found once in each, then the
// words between by the least edits). A verse begins at its first word matched; a
// verse whose first words were not matched begins where its first matched
// word does, less the time of the words before it. Then the start moves to
// where the reader's voice comes back after the pause before the verse, if a
// pause ends near it: a reader pauses between verses.
//
// A chapter's file runs from just after the chapter before ends (so it keeps
// "Chapter two") to where the next begins, or to the end of the recording's
// last verse. A chapter split between two recordings (Deuteronomy 25, Acts
// 10) is joined from both. The files are AAC, mono, 32 kb/s, in the audio
// directory (default audio/kjv, outside app/public and git, served by
// routes/audio): one per chapter, GEN.1.m4a.
//
// The output, app/data/audio/kjv.json:
//   { source, license, reader, chapters: { "GEN.1": [seconds, [start of each verse, in tenths of a second]] } }
//
// BOOKS=GEN,EXO runs those books only, and writes their files and times
// (to try it); the output then holds those books alone.
//
// Needs ffmpeg and whisper-cli (Homebrew: ffmpeg, whisper-cpp).

import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { align } from './lib/align.js';

const run = promisify(execFile);
const [source, work, audioDir = 'audio/kjv'] = process.argv.slice(2);
if (work) await mkdir(work, { recursive: true });
if (!source || !work) {
  console.error('Usage: node tools/import-audio.js <LibriVox directory> <work directory> [audio directory]');
  process.exit(1);
}
const MODEL = process.env.WHISPER_MODEL ?? path.join(work, 'ggml-base.en.bin');
// A verse's file time begins this long before its first word, when no pause
// ends near it.
const LEAD = 0.4;
// How far before the first word (and after it) the end of a pause is looked
// for, in ms.
const PAUSE_BEFORE = 2000;
const PAUSE_AFTER = 150;
// Seconds a word takes, for a verse whose first words were not heard.
const WORD = 0.33;

/** @type {{ id: string, name: string, verses: number[] }[]} */
const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
/** @type {{ n: number, title: string, secs: number, file: string }[]} */
const sections = JSON.parse(await readFile(path.join(source, 'sections.json'), 'utf8'));

const NAMES = new Map(books.map((book) => [book.name.toLowerCase(), book.id]));
NAMES.set('phillipians', 'PHP');
NAMES.set('psalms', 'PSA');
NAMES.set('song of solomon', 'SNG');

/**
 * A section's book and chapters, from its title.
 *
 * @param {string} title such as "Genesis Ch. 1 - 14" or "Psalms 1 - 32"
 */
function rangeOf(title) {
  const match = /^(.+?)\s+(?:Ch\.\s*)?(\d+)(?:\s*-\s*(\d+))?$/.exec(title.trim());
  if (!match) throw new Error(`A title not understood: ${title}`);
  const id = NAMES.get(match[1].toLowerCase()) ?? books.find((book) => book.name.toLowerCase().startsWith(match[1].toLowerCase()))?.id;
  if (!id) throw new Error(`A book not known: ${match[1]}`);
  return { id, from: Number(match[2]), to: Number(match[3] ?? match[2]) };
}

/** A word as compared: small letters, no marks. @param {string} word */
const plain = (word) => word.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');

/**
 * A recording's words with their times (ms), transcribed once.
 *
 * @param {{ n: number, file: string }} section
 * @returns {Promise<{ word: string, at: number }[]>}
 */
async function heard(section) {
  const base = path.join(work, String(section.n).padStart(3, '0'));
  try {
    await access(`${base}.words.json`);
  } catch {
    const wav = `${base}.wav`;
    await run('ffmpeg', ['-v', 'error', '-y', '-i', path.join(source, section.file), '-ar', '16000', '-ac', '1', wav]);
    await run('whisper-cli', ['-m', MODEL, '-f', wav, '-dtw', 'base.en', '-nfa', '-ojf', '-of', `${base}.words`, '-np'], { maxBuffer: 1 << 26 });
    await rm(wav);
    console.log(`transcribed ${section.n}`);
  }
  const json = JSON.parse(await readFile(`${base}.words.json`, 'utf8'));
  // Tokens to words: a token that begins with a space begins a word. A
  // word's time is its first token's (t_dtw, in hundredths of a second).
  /** @type {{ word: string, at: number }[]} */
  const words = [];
  for (const segment of json.transcription) {
    for (const token of segment.tokens) {
      if (/^\[_/.test(token.text)) continue;
      const time = token.t_dtw >= 0 ? token.t_dtw * 10 : token.offsets.from;
      const last = words[words.length - 1];
      if (token.text.startsWith(' ') || !last) words.push({ word: token.text, at: time });
      else last.word += token.text;
    }
  }
  return words.map((each) => ({ word: plain(each.word), at: each.at })).filter((each) => each.word);
}

/**
 * A recording's pauses, found once: where each ends and how long it is,
 * in ms.
 *
 * @param {{ n: number, file: string }} section
 * @returns {Promise<[number, number][]>}
 */
async function pauses(section) {
  const file = path.join(work, `${String(section.n).padStart(3, '0')}.pauses.json`);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    const { stderr } = await run('ffmpeg', ['-v', 'info', '-i', path.join(source, section.file), '-af', 'silencedetect=n=-35dB:d=0.25', '-f', 'null', '-'], { maxBuffer: 1 << 26 });
    const ends = [...stderr.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((match) => [Math.round(Number(match[1]) * 1000), Math.round(Number(match[2]) * 1000)]);
    await writeFile(file, JSON.stringify(ends));
    return ends;
  }
}

/** @type {Record<string, [number, number[]]>} */
const chapters = {};
let matchedAll = 0;
let wordsAll = 0;
/** @type {{ chapter: string, parts: { section: number, from: number, to: number }[] }[]} */
const cuts = [];

const only = process.env.BOOKS ? process.env.BOOKS.split(',') : null;
for (const book of books) {
  if (only && !only.includes(book.id)) continue;
  const own = sections.filter((section) => rangeOf(section.title).id === book.id);
  if (!own.length) continue;
  const data = JSON.parse(await readFile(`app/data/kjv/${book.id}.json`, 'utf8'));
  // The book's words, each with its verse.
  /** @type {{ word: string, verse: string, chapter: number }[]} */
  const text = [];
  for (const chapter of data.chapters) {
    for (const verse of chapter.verses) {
      const words = verse.blocks.flatMap((/** @type {any} */ block) => block.runs.map((/** @type {any} */ run) => run.text)).join(' ').split(/\s+/);
      for (const word of words) if (plain(word)) text.push({ word: plain(word), verse: verse.id, chapter: chapter.n });
    }
  }
  // The words heard, in order through the book's recordings.
  /** @type {{ word: string, at: number, section: number }[]} */
  const audio = [];
  for (const section of own) for (const each of await heard(section)) audio.push({ ...each, section: section.n });
  /** @type {Map<number, [number, number][]>} */
  const breaks = new Map();
  for (const section of own) breaks.set(section.n, await pauses(section));
  /**
   * Where the voice comes back before a word, or a little before the word.
   * Of the pauses that end near it, the longest: a reader pauses longer
   * between verses than inside one ("And ... God spake").
   *
   * @param {number} section @param {number} ms
   */
  const settle = (section, ms) => {
    const near = (breaks.get(section) ?? []).filter(([end]) => end >= ms - PAUSE_BEFORE && end <= ms + PAUSE_AFTER);
    const longest = near.reduce((best, each) => (!best || each[1] > best[1] ? each : best), /** @type {[number, number] | null} */ (null));
    // A little early is better than a little late: a late start loses the
    // first word, often a short "and".
    return longest ? longest[0] - 300 : ms - LEAD * 1000;
  };

  // Match the words (tools/lib/align.js).
  const at = align(text.map((each) => each.word), audio.map((each) => each.word));
  const matched = at.filter((each) => each !== null).length;
  matchedAll += matched;
  wordsAll += text.length;

  // Each verse's start: its first word matched, less the words before it.
  /** @type {Map<string, { section: number, ms: number } | null>} */
  const starts = new Map();
  /** @type {Map<string, { section: number, ms: number }>} the last word heard in each verse */
  const ends = new Map();
  for (let i = 0; i < text.length; i += 1) {
    const verse = text[i].verse;
    if (!starts.has(verse)) {
      // The verse's first three words heard, each less the words before it
      // in the verse: the middle of the three guesses, as one word's time
      // can be off (most often the first of a stretch whisper heard).
      /** @type {{ section: number, ms: number }[]} */
      const guesses = [];
      for (let k = i; k < text.length && text[k].verse === verse && guesses.length < 3; k += 1) {
        const index = at[k];
        if (index === null) continue;
        guesses.push({ section: audio[index].section, ms: audio[index].at - (k - i) * WORD * 1000 });
      }
      guesses.sort((a, b) => a.ms - b.ms);
      const guess = guesses[Math.floor((guesses.length - 1) / 2)];
      starts.set(verse, guess ? { section: guess.section, ms: Math.max(0, settle(guess.section, guess.ms)) } : null);
    }
    const index = at[i];
    if (index !== null) ends.set(verse, { section: audio[index].section, ms: audio[index].at });
  }

  // The chapters: each from just after the one before to the next.
  for (const chapter of data.chapters) {
    const ids = chapter.verses.map((/** @type {{ id: string }} */ verse) => verse.id);
    const first = starts.get(ids[0]);
    const known = ids.map((id) => starts.get(id)).filter(Boolean);
    if (!first || known.length < ids.length / 2) {
      console.log(`${book.id} ${chapter.n}: too few verses heard (${known.length} of ${ids.length}), left out`);
      continue;
    }
    const previous = data.chapters.find((/** @type {{ n: number }} */ each) => each.n === chapter.n - 1);
    const before = previous ? ends.get(previous.verses[previous.verses.length - 1].id) : null;
    const from = before && before.section === first.section ? Math.max(before.ms + 1000, first.ms - 4000) : Math.max(0, first.ms - 1500);
    const last = ends.get(ids[ids.length - 1]) ?? ends.get(ids.findLast((id) => ends.has(id)) ?? '');
    if (!last) continue;
    // A chapter in two recordings: from its start to the end of the first,
    // then the second from its first word.
    /** @type {{ section: number, from: number, to: number }[]} */
    const parts = [];
    if (last.section === first.section) parts.push({ section: first.section, from, to: last.ms + 2500 });
    else {
      const tail = [...ends.entries()].filter(([id, end]) => ids.includes(id) && end.section === first.section).map(([, end]) => end.ms);
      const head = ids.map((id) => starts.get(id)).find((start) => start && start.section === last.section);
      parts.push({ section: first.section, from, to: Math.max(...tail) + 1500 });
      parts.push({ section: last.section, from: head ? head.ms : 0, to: last.ms + 2500 });
    }
    // Each verse's time in the chapter's file; a verse not heard takes the
    // time of the one before.
    /** @type {number[]} */
    const times = [];
    for (const id of ids) {
      const start = starts.get(id);
      let t = times.length ? times[times.length - 1] : 0;
      if (start) {
        const part = parts.findIndex((each) => each.section === start.section);
        const offset = parts.slice(0, Math.max(0, part)).reduce((sum, each) => sum + (each.to - each.from), 0);
        if (part >= 0) t = Math.max(t, Math.round((offset + start.ms - parts[part].from) / 100));
      }
      times.push(Math.max(0, t));
    }
    const seconds = Math.round(parts.reduce((sum, each) => sum + (each.to - each.from), 0) / 1000);
    chapters[`${book.id}.${chapter.n}`] = [seconds, times];
    cuts.push({ chapter: `${book.id}.${chapter.n}`, parts });
  }
  console.log(`${book.id}: ${matched} of ${text.length} words matched (${Math.round((100 * matched) / text.length)}%)`);
}

await mkdir('app/data/audio', { recursive: true });
await writeFile(
  'app/data/audio/kjv.json',
  `${JSON.stringify({
    source: 'LibriVox, "Bible (KJV), Complete" (https://librivox.org/bible-kjv-complete-by-king-james-version-kjv/)',
    license: 'Public domain',
    reader: 'Michael Armenta',
    chapters,
  })}\n`,
);
console.log(`${Object.keys(chapters).length} chapters; ${Math.round((100 * matchedAll) / wordsAll)}% of the words matched.`);

// The chapters' files, four at a time; one already made is not made again.
await mkdir(audioDir, { recursive: true });
const fileOf = (/** @type {number} */ n) => path.join(source, /** @type {{ file: string }} */ (sections.find((section) => section.n === n)).file);
let made = 0;
const queue = [...cuts];
await Promise.all(
  [1, 2, 3, 4].map(async () => {
    for (let cut = queue.shift(); cut; cut = queue.shift()) {
      const out = path.join(audioDir, `${cut.chapter}.m4a`);
      try {
        await access(out);
        continue;
      } catch {
        // Not made yet.
      }
      const inputs = cut.parts.flatMap((part) => ['-ss', String(part.from / 1000), '-to', String(part.to / 1000), '-i', fileOf(part.section)]);
      const join = cut.parts.length > 1 ? ['-filter_complex', `${cut.parts.map((_, i) => `[${i}:a]`).join('')}concat=n=${cut.parts.length}:v=0:a=1[a]`, '-map', '[a]'] : [];
      await run('ffmpeg', ['-v', 'error', '-y', ...inputs, ...join, '-ac', '1', '-c:a', 'aac', '-b:a', '32k', '-movflags', '+faststart', out]);
      made += 1;
      if (made % 100 === 0) console.log(`${made} files made`);
    }
  }),
);
console.log(`${made} chapter files made in ${audioDir}.`);
