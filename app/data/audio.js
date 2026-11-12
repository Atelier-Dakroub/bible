// The Bible read aloud from recordings: where each verse begins in each.
//
// Two kinds of recording, a file to a chapter, outside git:
//   - the app's own voice (tools/voice/generate.py): audio/<voice>/<version>,
//     times in app/data/audio/<voice>-<version>.json; for the KJV and the BSB.
//   - LibriVox's KJV, read by Michael Armenta (tools/import-audio.js):
//     audio/kjv, times in app/data/audio/kjv.json.
// app/server.js serves the files: /audio/<voice>/<version>/GEN.1.m4a and
// /audio/GEN.1.m4a (LibriVox). Where a chapter's file is not there (or the app
// runs where it has no files, as on Cloudflare), the passage has no such
// recording, and a card reads in the device's voice instead.
//
// BIBLE_AUDIO moves the folder that holds the recordings (default audio).

import index from './kjv/books.json' with { type: 'json' };
import { versesIn } from '../lib/reference.js';

/** Node's file system, where the app runs under Node; null elsewhere. */
/** @type {any} */
const files = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs/promises') ?? null;
/** Node's streams of files, to send a recording a piece at a time. @type {any} */
const fileStreams = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs') ?? null;
/** @type {any} */
const streams = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:stream') ?? null;
const ROOT = /** @type {any} */ (globalThis).process?.env?.BIBLE_AUDIO ?? 'audio';

/**
 * @typedef {{
 *   id: string, version: string, kind: 'own' | 'librivox', reader: string,
 *   dir: string, url: string, times: string
 * }} Recording a recording: its folder on disk, its address on the server,
 *   and the file of its times
 */

/** @type {Recording[]} the recordings, the app's own voice first */
/** Seconds before the next verse at which one of the app's own verses ends: about half its pause of 0.55 s. */
const GAP = 0.3;

export const RECORDINGS = [
  { id: 'plain-male-kjv', version: 'kjv', kind: 'own', reader: "The app's voice", dir: `${ROOT}/plain-male/kjv`, url: '/audio/plain-male/kjv', times: 'app/data/audio/plain-male-kjv.json' },
  { id: 'plain-male-bsb', version: 'bsb', kind: 'own', reader: "The app's voice", dir: `${ROOT}/plain-male/bsb`, url: '/audio/plain-male/bsb', times: 'app/data/audio/plain-male-bsb.json' },
  { id: 'librivox-kjv', version: 'kjv', kind: 'librivox', reader: 'Michael Armenta, for LibriVox (public domain)', dir: `${ROOT}/kjv`, url: '/audio', times: 'app/data/audio/kjv.json' },
];

/** @type {Map<string, Promise<Record<string, [number, number[]]>>>} */
const loaded = new Map();

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
    times = files
      ? files.readFile(recording.times, 'utf8').then((text) => JSON.parse(text).chapters, () => ({}))
      : Promise.resolve({});
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
 * @typedef {{ id: string, kind: 'own' | 'librivox', reader: string, chapters: RecordedChapter[] }} RecordingOf
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
  for (const recording of RECORDINGS.filter((each) => each.version === version)) {
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
    chapterIn(chapters, `${recording.url}/${key}.m4a`).verses.push(verseTime(recording, key, verse, entry));
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
 * Where a verse begins in its chapter's file, and where it ends: where the
 * next begins; in the app's own voice, in the middle of the pause before it
 * (generate.py's PAUSE), so that a stop a little late is still silent. The
 * last verse ends a second after the chapter's length, which is rounded to
 * the second: the file's own end stops it, and its last words are heard.
 *
 * @param {Recording} recording
 * @param {string} key the chapter, such as JHN.3
 * @param {number} verse
 * @param {[number, number[]]} entry the chapter's length, and its verses' starts in tenths of a second
 */
export function verseTime(recording, key, verse, [seconds, starts]) {
  const until = verse < starts.length ? starts[verse] / 10 - (recording.kind === 'own' ? GAP : 0) : seconds + 1;
  return { id: `${key}.${verse}`, at: starts[verse - 1] / 10, until };
}

/**
 * A chapter's file, or part of it (an HTTP byte range, so a player can begin
 * at a verse), for app/server.js.
 *
 * @param {string} folder the recording's folder, such as plain-male/kjv, or '' for LibriVox's
 * @param {string} name such as GEN.1.m4a
 * @param {string | undefined} range the request's Range header
 * @returns {Promise<Response>}
 */
export async function chapterFile(folder, name, range) {
  const file = recordingFile(folder, name);
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
function recordingFile(folder, name) {
  const url = folder ? `/audio/${folder}` : '/audio';
  const recording = RECORDINGS.find((each) => each.url === url);
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
