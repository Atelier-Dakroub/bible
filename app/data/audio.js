// The KJV read aloud: where each verse is in LibriVox's recording, read by
// Michael Armenta (tools/import-audio.js). The times are in
// app/data/audio/kjv.json; the chapters' files are outside git, in
// audio/kjv (or BIBLE_AUDIO), served by app/server.js at /audio/GEN.1.m4a.
// Where the files are not there (or the app runs where it has no files, as
// on Cloudflare), a passage has no recording, and a card reads in the
// device's voice instead.

import index from './kjv/books.json' with { type: 'json' };
import { versesIn } from '../lib/reference.js';

/** Node's file system, where the app runs under Node; null elsewhere. */
/** @type {any} */
const files = /** @type {any} */ (globalThis).process?.getBuiltinModule?.('node:fs/promises') ?? null;
export const AUDIO_DIR = /** @type {any} */ (globalThis).process?.env?.BIBLE_AUDIO ?? 'audio/kjv';
export const CREDIT = 'Read by Michael Armenta for LibriVox (public domain).';

/** @type {Promise<Record<string, [number, number[]]>> | null} */
let times = null;

/** @returns {Promise<Record<string, [number, number[]]>>} */
function chapters() {
  times ??= import('./audio/kjv.json', { with: { type: 'json' } })
    .then((module) => module.default.chapters)
    .catch(() => ({}));
  return times;
}

/** @type {Map<string, Promise<boolean>>} */
const present = new Map();

/**
 * Whether a chapter's file is there. A file found is remembered; one not
 * found is looked for again next time, as the import may be making it.
 *
 * @param {string} chapter such as GEN.1
 */
function hasFile(chapter) {
  let known = present.get(chapter);
  if (!known) {
    known = (files ? files.access(`${AUDIO_DIR}/${chapter}.m4a`) : Promise.reject(new Error('No files here'))).then(
      () => true,
      () => {
        present.delete(chapter);
        return false;
      },
    );
    present.set(chapter, known);
  }
  return known;
}

/**
 * @typedef {{ file: string, verses: { id: string, at: number, until: number }[] }} RecordedChapter
 *   a chapter's file, and each verse of the passage in it: where it begins
 *   and where the next begins (the end of the chapter, for the last), in
 *   seconds
 */

/**
 * The recording of a passage, chapter by chapter, or [] where there is none.
 *
 * @param {import('../lib/reference.js').Reference} ref
 * @returns {Promise<RecordedChapter[]>}
 */
export async function recordingOf(ref) {
  const known = await chapters();
  /** @type {RecordedChapter[]} */
  const found = [];
  for (const [chapter, verse] of versesIn(ref, index)) {
    const key = `${ref.book}.${chapter}`;
    const entry = known[key];
    if (!entry || !(await hasFile(key))) return [];
    const [seconds, starts] = entry;
    let last = found[found.length - 1];
    if (!last || last.file !== `/audio/${key}.m4a`) {
      last = { file: `/audio/${key}.m4a`, verses: [] };
      found.push(last);
    }
    last.verses.push({ id: `${key}.${verse}`, at: starts[verse - 1] / 10, until: verse < starts.length ? starts[verse] / 10 : seconds });
  }
  return found;
}

/**
 * A chapter's file, or part of it (an HTTP byte range, so a player can begin
 * at a verse), for app/server.js.
 *
 * @param {string} name such as GEN.1.m4a
 * @param {string | undefined} range the request's Range header
 * @returns {Promise<Response>}
 */
export async function chapterFile(name, range) {
  if (!files || !/^[1-3A-Z]{3}\.\d{1,3}\.m4a$/.test(name)) return new Response('No such recording.', { status: 404 });
  const file = `${AUDIO_DIR}/${name}`;
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
