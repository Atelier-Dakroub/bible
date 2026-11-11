#!/usr/bin/env node
// Softens the treble of the app's recordings made before generate.py did it
// (its SOFTEN filter): the voice model adds a fizz above 7 kHz, heard as hiss.
//
//   node tools/voice/soften.js [voice]        (plain-male unless named)
//
// Each chapter of audio/<voice>/<version> that its times file lists and
// softened.txt does not is decoded, softened, made even in loudness again,
// and encoded as before (AAC, mono, 48 kb/s). Its audio must not move, as the
// times of its verses are kept. The encoder pads the end of the file by up to
// a tenth of a second (the decoded audio is the same length, and not shifted:
// checked by cross-correlation), so a chapter whose length changes by more
// than 150 ms is left as it was. Each one done is added to
// softened.txt, so a run again does nothing twice. Needs ffmpeg and ffprobe.

import { execFile } from 'node:child_process';
import { readFile, appendFile, rename, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SOFTEN = 'highshelf=f=7000:g=-6:t=s:w=0.7';
const voice = process.argv[2] ?? 'plain-male';

/** @param {string} file */
const seconds = async (file) => Number((await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).stdout);

for (const version of ['kjv', 'bsb']) {
  const folder = `audio/${voice}/${version}`;
  const times = JSON.parse(await readFile(`app/data/audio/${voice}-${version}.json`, 'utf8').catch(() => '{"chapters":{}}')).chapters;
  const done = new Set((await readFile(`${folder}/softened.txt`, 'utf8').catch(() => '')).split('\n').filter(Boolean));
  let count = 0;
  for (const key of Object.keys(times)) {
    if (done.has(key)) continue;
    const file = `${folder}/${key}.m4a`;
    const temp = `${folder}/${key}.softening.m4a`;
    try {
      await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-af', `${SOFTEN},loudnorm=I=-18:TP=-1.5`, '-ar', '24000', '-ac', '1', '-c:a', 'aac', '-b:a', '48k', '-movflags', '+faststart', temp]);
      const [before, after] = await Promise.all([seconds(file), seconds(temp)]);
      if (Math.abs(before - after) > 0.15) {
        console.log(`${version} ${key}: left as it was (${before.toFixed(2)} s became ${after.toFixed(2)} s)`);
        await rm(temp);
        continue;
      }
      await rename(temp, file);
      await appendFile(`${folder}/softened.txt`, `${key}\n`);
      count += 1;
    } catch (error) {
      console.log(`${version} ${key}: ${/** @type {Error} */ (error).message.split('\n')[0]}`);
      await rm(temp, { force: true });
    }
  }
  console.log(`${version}: ${count} chapters softened`);
}
