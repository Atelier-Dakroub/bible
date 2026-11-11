#!/usr/bin/env node
// Finds the videos the picks name and writes their record.
//
//   node tools/import-videos.js [picks file]
//
// The picks (tools/videos.json) are chosen by hand: each video and the
// passages it shows. Nothing is downloaded: the app plays each video from its
// owner, in its own player (app/elements/video-player.html).
//   jesusFilm    JESUS (1979), scene by scene, from the Jesus Film Project's
//                arclight player: each scene's stream (an HLS address at Mux),
//                its length (from the stream's playlist) and its picture. "No permission is needed to show" their
//                films (jesusfilm.org FAQ).
//   bibleProject BibleProject's book overviews on YouTube, which allows them
//                embedded on a not-for-profit page (help.bibleproject.com);
//                each one's YouTube id, found by a search of YouTube.
//   theChosen    The Chosen, seasons 1 to 5: each episode's link on The
//                Chosen's own site, and the passages it shows (not looked up).
//
// The output, app/data/videos.json: { id, source, title, series, play,
// poster, seconds, passages, credit, link }. A video found before keeps its
// id and is not looked for again. One request at a time, with a pause; if a
// server answers with a check for robots, it stops.

import { readFile, writeFile } from 'node:fs/promises';

const [picksFile = 'tools/videos.json'] = process.argv.slice(2);
const RECORD = 'app/data/videos.json';
const PAUSE_MS = 1200;
const AGENT = 'Mozilla/5.0 (bible-research-app; a personal study app)';

const picks = JSON.parse(await readFile(picksFile, 'utf8'));
const books = JSON.parse(await readFile('app/data/kjv/books.json', 'utf8'));
/** @type {any[]} */
const before = JSON.parse(await readFile(RECORD, 'utf8').catch(() => '[]'));
const known = new Map(before.map((video) => [video.id, video]));
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

/** @param {string} url */
async function page(url) {
  await pause();
  const response = await fetch(url, { headers: { 'User-Agent': AGENT, 'Accept-Language': 'en' } });
  const text = await response.text();
  if (!response.ok || /captcha|unusual traffic/i.test(text.slice(0, 20000))) {
    throw new Error(`${url} answered ${response.status} or with a check for robots; stopping.`);
  }
  return text;
}

/** A whole book, or chapters of it, as one address. */
function span(book, first, last) {
  const entry = books.find((each) => each.id === book);
  if (!entry) throw new Error(`No book ${book}`);
  const from = first ?? 1;
  const to = last ?? entry.verses.length;
  return `${book}.${from}.1-${to}.${entry.verses[to - 1]}`;
}

/** @type {any[]} */
const videos = [];

// ---- JESUS, scene by scene ------------------------------------------------

for (const [number, title, passages] of picks.jesusFilm.scenes) {
  const id = `jesus-${String(number).padStart(2, '0')}`;
  const arclight = `1_jf61${String(number).padStart(2, '0')}-0-0`;
  let video = known.get(id);
  if (!video?.play?.url) {
    const html = await page(`https://api.arclight.org/videoPlayerUrl?refId=1_529-jf61${String(number).padStart(2, '0')}-0-0`);
    const stream = /https:\/\/stream\.mux\.com\/[A-Za-z0-9]+\.m3u8/.exec(html)?.[0];
    if (!stream) throw new Error(`No stream for scene ${number}`);
    video = { play: { kind: 'stream', url: stream } };
    console.log(`${id}: ${title}`);
  }
  // Its length: the sum of the segments of one of its renditions.
  if (!video.seconds) {
    const master = await page(video.play.url);
    const rendition = master.split('\n').find((line) => line.startsWith('https://'));
    if (rendition) {
      const list = await page(rendition);
      video.seconds = Math.round([...list.matchAll(/#EXTINF:([\d.]+)/g)].reduce((sum, m) => sum + Number(m[1]), 0)) || null;
    }
  }
  videos.push({
    id,
    source: 'jesus-film',
    title,
    series: 'JESUS (1979)',
    part: `Scene ${number} of 61`,
    play: { ...video.play, captions: `/video/captions/${arclight}` },
    poster: `https://imagedelivery.net/tMY86qEHFACTO8_0kAeRFA/${arclight}.mobileCinematicHigh.jpg/f=jpg,w=640,h=300,q=85`,
    seconds: video.seconds ?? null,
    passages,
    credit: 'JESUS (1979), © Jesus Film Project. Free to show.',
    link: 'https://www.jesusfilm.org/watch/jesus.html/english.html',
  });
}

// ---- BibleProject's book overviews ----------------------------------------

/** Every video a YouTube results page lists: id, title, channel, length. */
function results(html) {
  const json = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html)?.[1];
  if (!json) return [];
  /** @type {{ id: string, title: string, channel: string, length: string }[]} */
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      found.push({
        id: v.videoId,
        title: v.title?.runs?.map((run) => run.text).join('') ?? '',
        channel: v.ownerText?.runs?.[0]?.text ?? v.longBylineText?.runs?.[0]?.text ?? '',
        length: v.lengthText?.simpleText ?? '',
      });
      return;
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(JSON.parse(json));
  return found;
}

/** "7:42" to 462. */
const seconds = (length) => length.split(':').reduce((total, part) => total * 60 + Number(part), 0) || null;

const COMBINED = { '1KI': ['1KI', '2KI'], '1CH': ['1CH', '2CH'], EZR: ['EZR', 'NEH'], '1JN': ['1JN', '2JN', '3JN'] };

for (const [book, parts, label] of picks.bibleProject.overviews) {
  const name = label ?? books.find((each) => each.id === book).name;
  const pieces = parts ?? [null];
  for (let index = 0; index < pieces.length; index += 1) {
    const part = pieces[index];
    const id = `bibleproject-${book.toLowerCase()}${parts ? `-${index + 1}` : ''}`;
    let video = known.get(id);
    if (!video?.play?.id) {
      const words = `BibleProject ${name} overview${parts ? ` part ${index + 1}` : ''}`;
      const found = results(await page(`https://www.youtube.com/results?search_query=${encodeURIComponent(words)}`));
      const plain = name.replace(/-/g, ' ').replace(/\s+/g, ' ').toLowerCase();
      const pick = found.find((each) => {
        const title = each.title.replace(/[-–]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
        return (
          each.channel === 'BibleProject' &&
          title.includes(plain) &&
          /overview|summary/.test(title) &&
          !/shorts|deuterocanon/.test(title) &&
          (!parts || title.includes(`part ${index + 1}`) || title.includes(`${part[0]}-${part[1]}`) || title.includes(`${part[0]} ${part[1]}`))
        );
      });
      if (!pick) {
        console.log(`${id}: not found (${found.slice(0, 3).map((each) => `${each.channel}: ${each.title}`).join(' | ')})`);
        continue;
      }
      video = { title: pick.title, play: { kind: 'youtube', id: pick.id }, seconds: seconds(pick.length) };
      console.log(`${id}: ${pick.title} (${pick.id})`);
    }
    const passages = part ? [span(book, part[0], part[1])] : (COMBINED[book] ?? [book]).map((each) => span(each));
    videos.push({
      id,
      source: 'bibleproject',
      title: video.title,
      series: 'BibleProject: Book overviews',
      part: parts ? `Part ${index + 1} of ${parts.length}` : '',
      play: video.play,
      poster: `https://i.ytimg.com/vi/${video.play.id}/hqdefault.jpg`,
      seconds: video.seconds,
      passages,
      credit: 'BibleProject, on YouTube. Free to share; not for sale.',
      link: `https://www.youtube.com/watch?v=${video.play.id}`,
    });
  }
}

// ---- The Chosen, seasons 1 to 5 -------------------------------------------
// Links only: The Chosen cannot be shown in another site, and is free to
// watch on its own. No poster: their pictures are theirs. Season 6 is on
// Prime Video, and nothing here sends a reader to a paid service.

for (const [season, episode, title, passages, minutes, link] of picks.theChosen?.episodes ?? []) {
  if (season > 5) throw new Error(`The Chosen season ${season}: only seasons 1 to 5 are free to watch.`);
  if (!passages.length) continue; // an episode that shows no passage (Shabbat)
  videos.push({
    id: `chosen-s${season}e${episode}`,
    source: 'the-chosen',
    title,
    series: 'The Chosen',
    part: `Season ${season}, Episode ${episode}`,
    play: { kind: 'link' },
    poster: '',
    seconds: minutes ? minutes * 60 : null,
    passages,
    credit: 'The Chosen, © 5&2 Studios. Free to watch on The Chosen’s own site and app.',
    link,
    site: 'The Chosen',
  });
}

await writeFile(RECORD, `${JSON.stringify(videos, null, 1)}\n`);
console.log(`${videos.length} videos in ${RECORD}`);
