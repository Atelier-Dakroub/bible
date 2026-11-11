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
const ROOT = /** @type {any} */ (globalThis).process?.env?.BIBLE_AUDIO ?? 'audio';

/**
 * @typedef {{
 *   id: string, version: string, kind: 'own' | 'librivox', reader: string,
 *   dir: string, url: string, times: string
 * }} Recording a recording: its folder on disk, its address on the server,
 *   and the file of its times
 */

/** @type {Recording[]} the recordings, the app's own voice first */
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
    const known = await timesOf(recording);
    /** @type {RecordedChapter[]} */
    const chapters = [];
    let whole = true;
    for (const [chapter, verse] of versesIn(ref, index)) {
      const key = `${ref.book}.${chapter}`;
      const entry = known[key];
      if (!entry || !(await hasFile(`${recording.dir}/${key}.m4a`))) {
        whole = false;
        break;
      }
      const [seconds, starts] = entry;
      let last = chapters[chapters.length - 1];
      if (!last || last.file !== `${recording.url}/${key}.m4a`) {
        last = { file: `${recording.url}/${key}.m4a`, verses: [] };
        chapters.push(last);
      }
      last.verses.push({ id: `${key}.${verse}`, at: starts[verse - 1] / 10, until: verse < starts.length ? starts[verse] / 10 : seconds });
    }
    if (whole && chapters.length) found.push({ id: recording.id, kind: recording.kind, reader: recording.reader, chapters });
  }
  return found;
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
  const recording = RECORDINGS.find((each) => each.url === (folder ? `/audio/${folder}` : '/audio'));
  if (!files || !recording || !/^[1-3A-Z]{3}\.\d{1,3}\.m4a$/.test(name)) return new Response('No such recording.', { status: 404 });
  const file = `${recording.dir}/${name}`;
  const info = await files.stat(file).catch(() => null);
  if (!info) return new Response('No such recording.', { status: 404 });
  const size = Number(info.size);
  const asked = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
  let start = 0;
  let end = size - 1;
  if (asked) {
    if (asked[1]) start = Number(asked[1]);
    if (asked[2]) end = asked[1] ? Math.min(size - 1, Number(asked[2])) : end;
    if (!asked[1] && asked[2]) start = Math.max(0, size - Number(asked[2]));
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const length = end - start + 1;
  const handle = await files.open(file);
  const bytes = new Uint8Array(length);
  await handle.read(bytes, 0, length, start);
  await handle.close();
  return new Response(bytes, {
    status: asked ? 206 : 200,
    headers: {
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
      'Content-Length': String(length),
      ...(asked ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
