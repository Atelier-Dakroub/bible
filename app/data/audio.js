// The Bible read aloud from recordings: where each verse begins in each.
//
// Recordings are off unless BIBLE_AUDIO names their folder (.env). Without
// it, and where the app has no files (as on Cloudflare), every card reads in
// the device's own voice. docs/recordings.md tells how to make recordings.
//
// The folder holds a folder for each voice, and in it one for each version
// it reads (kjv, bsb), a file to a chapter:
//
//   <BIBLE_AUDIO>/<voice>/voice.json         { "reader": "…" }, the name shown (optional)
//   <BIBLE_AUDIO>/<voice>/<version>/JHN.3.m4a
//   <BIBLE_AUDIO>/<voice>/<version>/times.json
//
// times.json: { "chapters": { "JHN.3": [seconds, [start of each verse, in tenths]] } }.
// The times of tools/voice/generate.py are in app/data/audio/<voice>-<version>.json,
// which is read where the folder has no times.json. app/server.js serves the
// files: /audio/<voice>/<version>/JHN.3.m4a. Where a chapter's file is not
// there, the passage has no such recording, and the device's voice reads it.

import index from './kjv/books.json' with { type: 'json' };
import { versesIn } from '../lib/reference.js';

/** Node's file system, where the app runs under Node; null elsewhere. */
/** @type {any} */
const files = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs/promises') ?? null;
/** Node's streams of files, to send a recording a piece at a time. @type {any} */
const fileStreams = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs') ?? null;
/** @type {any} */
const streams = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:stream') ?? null;
/** @type {string | null} the folder of the recordings, or none */
const ROOT = /** @type {any} */ (globalThis).process?.env?.BIBLE_AUDIO || null;
/** The versions a recording can read: the texts the app has. */
const VERSIONS = ['kjv', 'bsb'];
/** A voice's folder name: no dots or slashes, so a request cannot leave the folder. */
const VOICE_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * @typedef {{
 *   id: string, version: string, kind: 'own', reader: string,
 *   dir: string, url: string, times: string[]
 * }} Recording a recording: its folder on disk, its address on the server,
 *   and the files that can hold its times, the first found used
 */

/** Seconds before the next verse at which a verse ends: about half the pause of 0.55 s between verses. */
const GAP = 0.3;

/**
 * A voice's name as the app shows it: its voice.json's reader, or its folder
 * name in words ("plain-male" is "Plain male").
 *
 * @param {string} root
 * @param {string} voice
 */
async function readerOf(root, voice) {
  const named = await files
    .readFile(`${root}/${voice}/voice.json`, 'utf8')
    .then((text) => JSON.parse(text).reader, () => null)
    .catch(() => null);
  if (typeof named === 'string' && named.trim()) return named.trim();
  const words = voice.replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The versions of a voice that have a folder.
 *
 * @param {string} root
 * @param {string} voice
 */
async function versionsOf(root, voice) {
  const found = await Promise.all(VERSIONS.map((version) => files.stat(`${root}/${voice}/${version}`).then((info) => info.isDirectory(), () => false)));
  return VERSIONS.filter((_, at) => found[at]);
}

/**
 * The recordings in a folder: each voice's folder, and in it each version's.
 * None if there is no such folder, or no files here.
 *
 * @param {string | null} root
 * @returns {Promise<Recording[]>}
 */
export async function findRecordings(root) {
  if (!root || !files) return [];
  const entries = await files.readdir(root, { withFileTypes: true }).catch(() => []);
  const voices = entries.filter((/** @type {any} */ entry) => entry.isDirectory() && VOICE_NAME.test(entry.name)).map((/** @type {any} */ entry) => String(entry.name)).sort();
  /** @type {Recording[]} */
  const found = [];
  for (const voice of voices) {
    const reader = await readerOf(root, voice);
    for (const version of await versionsOf(root, voice)) found.push(recordingAt(root, voice, version, reader));
  }
  return found;
}

/**
 * @param {string} root
 * @param {string} voice
 * @param {string} version
 * @param {string} reader
 * @returns {Recording}
 */
function recordingAt(root, voice, version, reader) {
  const dir = `${root}/${voice}/${version}`;
  return { id: `${voice}-${version}`, version, kind: 'own', reader, dir, url: `/audio/${voice}/${version}`, times: [`${dir}/times.json`, `app/data/audio/${voice}-${version}.json`] };
}

/** @type {Promise<Recording[]> | null} */
let known = null;

/**
 * The recordings of this copy of the app. Looked for again after a minute,
 * so that a voice added while the app runs shows.
 *
 * @returns {Promise<Recording[]>}
 */
export function recordings() {
  if (!known) {
    known = findRecordings(ROOT);
    setTimeout(() => {
      known = null;
    }, 60_000);
  }
  return known;
}

/** @type {Map<string, Promise<Record<string, [number, number[]]>>>} */
const loaded = new Map();

/**
 * The first of some files that reads as JSON, or null.
 *
 * @param {string[]} paths
 */
async function firstJson(paths) {
  for (const path of paths) {
    const text = await files.readFile(path, 'utf8').catch(() => null);
    if (text !== null) return JSON.parse(text);
  }
  return null;
}

/**
 * A recording's times, by chapter. Read from disk, as the recordings are made
 * after the app is built; none where the app has no files.
 *
 * @param {Recording} recording
 * @returns {Promise<Record<string, [number, number[]]>>}
 */
function timesOf(recording) {
  let times = loaded.get(recording.id);
  if (!times) {
    times = files ? firstJson(recording.times).then((data) => data?.chapters ?? {}, () => ({})) : Promise.resolve({});
    loaded.set(recording.id, times);
    // Read again in a minute: a recording being made grows.
    setTimeout(() => loaded.delete(recording.id), 60_000);
  }
  return /** @type {Promise<Record<string, [number, number[]]>>} */ (times);
}

/** @type {Map<string, Promise<boolean>>} */
const present = new Map();

/**
 * Whether a chapter's file is there. A file found is remembered; one not
 * found is looked for again next time, as a recording may be being made.
 *
 * @param {string} path
 */
function hasFile(path) {
  let known = present.get(path);
  if (!known) {
    known = (files ? files.access(path) : Promise.reject(new Error('No files here'))).then(
      () => true,
      () => {
        present.delete(path);
        return false;
      },
    );
    present.set(path, known);
  }
  return known;
}

/**
 * @typedef {{ file: string, verses: { id: string, at: number, until: number }[] }} RecordedChapter
 *   a chapter's file, and each verse of the passage in it: where it begins
 *   and where the next begins (the end of the chapter, for the last), in
 *   seconds
 * @typedef {{ id: string, kind: 'own', reader: string, chapters: RecordedChapter[] }} RecordingOf
 */

/**
 * The recordings of a passage in a version, the app's own voice first: each
 * one only if it has every chapter the passage touches.
 *
 * @param {import('../lib/reference.js').Reference} ref
 * @param {string} [version] kjv or bsb
 * @returns {Promise<RecordingOf[]>}
 */
export async function recordingsOf(ref, version = 'kjv') {
  /** @type {RecordingOf[]} */
  const found = [];
  for (const recording of (await recordings()).filter((each) => each.version === version)) {
    const chapters = await chaptersOf(recording, ref);
    if (chapters?.length) found.push({ id: recording.id, kind: recording.kind, reader: recording.reader, chapters });
  }
  return found;
}

/**
 * The chapters of a recording that a passage touches, each with the times
 * of its verses; null if the recording lacks one of them.
 *
 * @param {Recording} recording
 * @param {import('../lib/reference.js').Reference} ref
 * @returns {Promise<RecordedChapter[] | null>}
 */
async function chaptersOf(recording, ref) {
  const known = await timesOf(recording);
  /** @type {RecordedChapter[]} */
  const chapters = [];
  for (const [chapter, verse] of versesIn(ref, index)) {
    const key = `${ref.book}.${chapter}`;
    const entry = known[key];
    if (!entry || !(await hasFile(`${recording.dir}/${key}.m4a`))) return null;
    chapterIn(chapters, `${recording.url}/${key}.m4a`).verses.push(verseTime(key, verse, entry));
  }
  return chapters;
}

/**
 * The chapter of a file in the list: the last one, or a new one.
 *
 * @param {RecordedChapter[]} chapters
 * @param {string} file
 */
function chapterIn(chapters, file) {
  let last = chapters.at(-1);
  if (!last || last.file !== file) {
    last = { file, verses: [] };
    chapters.push(last);
  }
  return last;
}

/**
 * Where a verse begins in its chapter's file, and where it ends: in the
 * middle of the pause before the next (generate.py's PAUSE), so that a stop
 * a little late is still silent. The
 * last verse ends a second after the chapter's length, which is rounded to
 * the second: the file's own end stops it, and its last words are heard.
 *
 * @param {string} key the chapter, such as JHN.3
 * @param {number} verse
 * @param {[number, number[]]} entry the chapter's length, and its verses' starts in tenths of a second
 */
export function verseTime(key, verse, [seconds, starts]) {
  const until = verse < starts.length ? starts[verse] / 10 - GAP : seconds + 1;
  return { id: `${key}.${verse}`, at: starts[verse - 1] / 10, until };
}

/**
 * A chapter's file, or part of it (an HTTP byte range, so a player can begin
 * at a verse), for app/server.js.
 *
 * @param {string} folder the recording's folder, such as plain-male/kjv
 * @param {string} name such as GEN.1.m4a
 * @param {string | undefined} range the request's Range header
 * @returns {Promise<Response>}
 */
export async function chapterFile(folder, name, range) {
  const file = await recordingFile(folder, name);
  const info = file ? await files.stat(file).catch(() => null) : null;
  if (!file || !info) return new Response('No such recording.', { status: 404 });
  const size = Number(info.size);
  const part = byteRange(range, size);
  if (part === 'none') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return sendBytes(file, part, size);
}

/**
 * The path of a chapter's file of a recording; null if there is no such
 * recording, or no files here.
 *
 * @param {string} folder
 * @param {string} name
 */
async function recordingFile(folder, name) {
  const recording = (await recordings()).find((each) => each.url === `/audio/${folder}`);
  if (!files || !recording || !/^[1-3A-Z]{3}\.\d{1,3}\.m4a$/.test(name)) return null;
  return `${recording.dir}/${name}`;
}

/**
 * The bytes a Range header asks for, of a file of a size: the first and
 * the last (inclusive); null for the whole file (no range, or one not
 * understood); 'none' when it asks for bytes the file does not have.
 *
 * @param {string | undefined} range
 * @param {number} size
 * @returns {{ start: number, end: number } | null | 'none'}
 */
export function byteRange(range, size) {
  const asked = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
  if (!asked) return null;
  const [, first, last] = asked;
  // "-500" is the last 500 bytes.
  const start = first ? Number(first) : last ? Math.max(0, size - Number(last)) : 0;
  const end = first && last ? Math.min(size - 1, Number(last)) : size - 1;
  return start > end || start >= size ? 'none' : { start, end };
}

/**
 * A file, or part of it, as the response, read as it is sent.
 *
 * @param {string} file
 * @param {{ start: number, end: number } | null} part null for the whole file
 * @param {number} size
 */
function sendBytes(file, part, size) {
  const { start, end } = part ?? { start: 0, end: size - 1 };
  const length = end - start + 1;
  // A piece at a time, so many requests at once do not hold whole files in
  // memory.
  const body = streams.Readable.toWeb(fileStreams.createReadStream(file, { start, end }));
  return new Response(body, {
    status: part ? 206 : 200,
    headers: {
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': String(length),
      ...(part ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
