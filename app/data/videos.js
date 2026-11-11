// Videos: films and teaching that show a passage, each linked to the passages
// it shows (tools/import-videos.js). Nothing is stored here but the record:
// each video plays from its owner, in the app's own player
// (elements/video-player.html).
//   jesus-film    JESUS (1979), scene by scene, from the Jesus Film Project
//                 (an HLS stream; free to show)
//   bibleproject  BibleProject's book overviews, from YouTube (embedding
//                 allowed on a not-for-profit page)
//   the-chosen    The Chosen, seasons 1 to 5, episode by episode: a link to
//                 The Chosen's own site, where they are free to watch (they
//                 cannot be shown in another site); no poster of theirs

import record from './videos.json' with { type: 'json' };
import index from './kjv/books.json' with { type: 'json' };
import { formatReference, parseAddress } from '../lib/reference.js';

/**
 * @typedef {{ kind: 'stream', url: string, captions?: string } | { kind: 'youtube', id: string } | { kind: 'link' }} Play
 * @typedef {{
 *   id: string, source: string, title: string, series: string, part: string,
 *   play: Play, poster: string, seconds: number | null, passages: string[],
 *   credit: string, link: string, site?: string
 * }} Video
 * @typedef {Video & { length: string, shows: { address: string, title: string }[], where: string }} VideoView
 */

/** @type {Video[]} */
export const videos = /** @type {any} */ (record);

const ORDER = index.map((book) => book.id);

/**
 * A passage as a span of verse numbers that can be compared across chapters:
 * book, then chapter × 1000 + verse at each end.
 *
 * @param {string} address
 * @returns {{ book: string, from: number, to: number } | null}
 */
function spanOf(address) {
  const ref = parseAddress(address, index);
  if (!ref) return null;
  const book = index.find((each) => each.id === ref.book);
  const lastChapter = ref.toChapter ?? ref.chapter;
  const from = ref.chapter * 1000 + (ref.from ?? 1);
  const to = lastChapter * 1000 + (ref.to ?? (ref.toChapter ? (book?.verses[lastChapter - 1] ?? 999) : (ref.from ?? book?.verses[ref.chapter - 1] ?? 999)));
  return { book: ref.book, from, to };
}

/** "462" seconds to "7:42". */
const lengthOf = (/** @type {number | null} */ seconds) => (seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '');

/** @param {Video} video @returns {VideoView} */
function view(video) {
  const shows = video.passages.flatMap((address) => {
    const ref = parseAddress(address, index);
    return ref ? [{ address, title: formatReference(ref, index) }] : [];
  });
  return { ...video, site: video.site ?? '', length: lengthOf(video.seconds), shows, where: shows.map((each) => each.title).join(', ') };
}

/**
 * One video, by its id, such as jesus-02.
 *
 * @param {string} id
 * @returns {VideoView | null}
 */
export function videoById(id) {
  const video = videos.find((each) => each.id === id);
  return video ? view(video) : null;
}

/**
 * The videos that show any part of a passage: the closest fit first (the
 * video whose passage is shortest), so a scene comes before a book's
 * overview, with at least one from each source that has one.
 *
 * @param {string} address such as LUK.2.1-20
 * @param {number} [limit]
 * @returns {VideoView[]}
 */
export function videosFor(address, limit = 4) {
  const asked = spanOf(address);
  if (!asked) return [];
  /** @type {{ video: Video, size: number }[]} */
  const found = [];
  for (const video of videos) {
    let size = Infinity;
    for (const passage of video.passages) {
      const span = spanOf(passage);
      if (!span || span.book !== asked.book || span.to < asked.from || span.from > asked.to) continue;
      size = Math.min(size, span.to - span.from);
    }
    if (size < Infinity) found.push({ video, size });
  }
  found.sort((a, b) => a.size - b.size || ORDER.indexOf(a.video.passages[0].split('.')[0]) - ORDER.indexOf(b.video.passages[0].split('.')[0]));
  // The closest of each source first, so that one source (The Chosen, with
  // many short passages) does not hide the others; then the rest in order.
  const firsts = found.filter(({ video }, index) => found.findIndex((each) => each.video.source === video.source) === index);
  const picked = [...firsts.slice(0, limit), ...found.filter((each) => !firsts.includes(each))].slice(0, limit);
  picked.sort((a, b) => found.indexOf(a) - found.indexOf(b));
  return picked.map(({ video }) => view(video));
}
