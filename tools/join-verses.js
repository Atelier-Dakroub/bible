#!/usr/bin/env node
// Recordings made a verse to a file, joined into the app's chapter files with
// the time each verse begins (docs/recordings.md). For a voice of your own,
// or any voice that reads one verse at a time.
//
//   node tools/join-verses.js --voice my-voice --version kjv --from path/to/verses [--books JHN --books ROM]
//
// The verses: <from>/<BOOK>.<chapter>/<verse>.<ext>, such as
// verses/JHN.3/16.wav, in any format ffmpeg reads (wav, m4a, mp3, flac). The
// books are named as in the app's addresses (GEN, EXO, … JHN, … REV). A
// chapter needs every verse from 1 on: one left out stops that chapter.
//
// Out, in the folder of the recordings (BIBLE_AUDIO, or ./audio):
// <voice>/<version>/<BOOK>.<chapter>.m4a, and the times in times.json beside
// them. Each verse is trimmed of silence at its ends; the verses are joined
// with a pause of 0.55 s, made even in loudness and encoded as AAC (mono,
// 64 kb/s). A chapter whose file is there is skipped: delete the file to make
// it again. Needs ffmpeg and ffprobe.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/** Seconds between verses: as tools/voice/generate.py, whose verses end half way into it (data/audio.js GAP). */
export const PAUSE = 0.55;
const CHAPTER = /^([1-3A-Z]{3})\.(\d{1,3})$/;
const VERSE = /^(\d{1,3})\.[a-z0-9]+$/i;
const TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';

/**
 * A chapter's entry in times.json: its length in seconds, and where each
 * verse begins, in tenths of a second, the verses joined with a pause.
 *
 * @param {number[]} durations each verse's length in seconds, in order
 * @param {number} [pause]
 * @returns {[number, number[]]}
 */
export function chapterTimes(durations, pause = PAUSE) {
  const starts = [];
  let position = 0;
  for (const duration of durations) {
    starts.push(Math.round(position * 10));
    position += duration + pause;
  }
  const length = durations.length ? position - pause : 0;
  return [Math.round(length), starts];
}

/**
 * The verse files of a chapter's folder, by verse; or the first verse left
 * out, as a number.
 *
 * @param {string[]} names the files in the folder
 * @returns {string[] | number}
 */
export function versesIn(names) {
  /** @type {Map<number, string>} */
  const byVerse = new Map();
  for (const name of names) {
    const found = VERSE.exec(name);
    if (found) byVerse.set(Number(found[1]), name);
  }
  const files = [];
  for (let verse = 1; verse <= byVerse.size; verse++) {
    const name = byVerse.get(verse);
    if (!name) return verse;
    files.push(name);
  }
  return files.length ? files : 1;
}

/**
 * The chapter folders to join: those of the books asked for, or all.
 *
 * @param {string} from
 * @param {string[] | undefined} books
 */
function chaptersIn(from, books) {
  return readdirSync(from)
    .filter((name) => CHAPTER.test(name))
    .filter((name) => !books?.length || books.includes(name.split('.')[0]));
}

/** @param {string} file */
function lengthOf(file) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).trim());
}

/**
 * Each verse trimmed and made mono at 24 kHz, in a folder for the work.
 *
 * @param {string} dir the chapter's folder
 * @param {string[]} names its verse files, in order
 * @param {string} work
 */
function prepared(dir, names, work) {
  return names.map((name, at) => {
    const out = join(work, `${at + 1}.wav`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(dir, name), '-af', TRIM, '-ar', '24000', '-ac', '1', out]);
    return out;
  });
}

/**
 * The verses joined with a pause between them, as one AAC file.
 *
 * @param {string[]} parts
 * @param {string} out
 */
function joinParts(parts, out) {
  const padded = parts.map((_, at) => (at < parts.length - 1 ? `[${at}:a]apad=pad_dur=${PAUSE}[a${at}]` : `[${at}:a]anull[a${at}]`));
  const filter = `${padded.join(';')};${parts.map((_, at) => `[a${at}]`).join('')}concat=n=${parts.length}:v=0:a=1,loudnorm=I=-18:TP=-1.5[out]`;
  const inputs = parts.flatMap((part) => ['-i', part]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[out]', '-ar', '24000', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out]);
}

/**
 * Joins one chapter, and returns its entry in times.json; null if a verse is
 * left out.
 *
 * @param {string} dir
 * @param {string} out
 */
function joinChapter(dir, out) {
  const names = versesIn(readdirSync(dir));
  if (typeof names === 'number') return null;
  const work = mkdtempSync(join(tmpdir(), 'join-verses-'));
  try {
    const parts = prepared(dir, names, work);
    joinParts(parts, out);
    return chapterTimes(parts.map(lengthOf));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** @param {string} file */
function readTimes(file) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { chapters: {} };
}

/** The settings from the command line, or none if they are not complete. */
function settings() {
  const { values } = parseArgs({
    options: { voice: { type: 'string' }, version: { type: 'string', default: 'kjv' }, from: { type: 'string' }, books: { type: 'string', multiple: true } },
  });
  const { voice, version = 'kjv', from, books } = values;
  return voice && from && ['kjv', 'bsb'].includes(version) ? { voice, version, from, books } : null;
}

/**
 * Joins one chapter into the output folder and its times, unless it is made.
 *
 * @param {string} chapter such as JHN.3
 * @param {string} from the folder of the verses
 * @param {string} outDir
 * @param {{ chapters: Record<string, [number, number[]]> }} times
 */
function makeChapter(chapter, from, outDir, times) {
  const out = join(outDir, `${chapter}.m4a`);
  if (existsSync(out) && times.chapters[chapter]) return;
  const entry = joinChapter(join(from, chapter), out);
  if (!entry) {
    console.error(`${chapter}: verse ${versesIn(readdirSync(join(from, chapter)))} is missing; skipped.`);
    return;
  }
  times.chapters[chapter] = entry;
  writeFileSync(join(outDir, 'times.json'), JSON.stringify(times));
  console.log(`${chapter}: ${entry[1].length} verses, ${entry[0]} s`);
}

function main() {
  const asked = settings();
  if (!asked) {
    console.error('Usage: node tools/join-verses.js --voice <name> --version kjv|bsb --from <folder of verses> [--books JHN]');
    process.exit(1);
  }
  const outDir = join(process.env.BIBLE_AUDIO || 'audio', asked.voice, asked.version);
  mkdirSync(outDir, { recursive: true });
  const times = readTimes(join(outDir, 'times.json'));
  for (const chapter of chaptersIn(asked.from, asked.books)) makeChapter(chapter, asked.from, outDir, times);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
