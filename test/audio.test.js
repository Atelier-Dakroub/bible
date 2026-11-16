import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { byteRange, findRecordings, verseTime } from '../app/data/audio.js';

test('recordings are off without a folder', async () => {
  assert.deepEqual(await findRecordings(null), []);
  assert.deepEqual(await findRecordings(join(tmpdir(), 'no-such-folder-of-recordings')), []);
});

test("the recordings in a folder: each voice's versions, with its name", async () => {
  const root = mkdtempSync(join(tmpdir(), 'recordings-'));
  try {
    mkdirSync(join(root, 'plain-male', 'kjv'), { recursive: true });
    mkdirSync(join(root, 'plain-male', 'bsb'), { recursive: true });
    writeFileSync(join(root, 'plain-male', 'voice.json'), '{ "reader": "The app\'s voice" }');
    mkdirSync(join(root, 'my_voice', 'kjv'), { recursive: true });
    // Not a version the app has, a file, and a name with a dot: left out.
    mkdirSync(join(root, 'my_voice', 'web'), { recursive: true });
    writeFileSync(join(root, 'notes.txt'), '');
    mkdirSync(join(root, '.hidden', 'kjv'), { recursive: true });
    const found = await findRecordings(root);
    assert.deepEqual(
      found.map(({ id, version, reader, url }) => ({ id, version, reader, url })),
      [
        { id: 'my_voice-kjv', version: 'kjv', reader: 'My voice', url: '/audio/my_voice/kjv' },
        { id: 'plain-male-kjv', version: 'kjv', reader: "The app's voice", url: '/audio/plain-male/kjv' },
        { id: 'plain-male-bsb', version: 'bsb', reader: "The app's voice", url: '/audio/plain-male/bsb' },
      ],
    );
    // The times: beside the chapters.
    assert.equal(found[1].times, join(root, 'plain-male', 'kjv', 'times.json').replaceAll('\\', '/'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a Range header asks for part of a recording', () => {
  assert.equal(byteRange(undefined, 1000), null);
  assert.equal(byteRange('pages=0-1', 1000), null);
  assert.deepEqual(byteRange('bytes=0-', 1000), { start: 0, end: 999 });
  assert.deepEqual(byteRange('bytes=100-199', 1000), { start: 100, end: 199 });
  // Past the end: to the end.
  assert.deepEqual(byteRange('bytes=900-5000', 1000), { start: 900, end: 999 });
  // The last 300 bytes, or all of a smaller file.
  assert.deepEqual(byteRange('bytes=-300', 1000), { start: 700, end: 999 });
  assert.deepEqual(byteRange('bytes=-3000', 1000), { start: 0, end: 999 });
  assert.deepEqual(byteRange('bytes=-', 1000), { start: 0, end: 999 });
  // Bytes the file does not have.
  assert.equal(byteRange('bytes=1000-', 1000), 'none');
  assert.equal(byteRange('bytes=500-100', 1000), 'none');
  assert.equal(byteRange('bytes=-0', 1000), 'none');
});

test('the last verse of a chapter plays to the end of its file', () => {
  // Genesis 1 is 252.4 s long, kept as 252: its last words are after that.
  const entry = /** @type {[number, number[]]} */ ([252, [0, 2198, 2326, 2446]]);
  assert.deepEqual(verseTime('GEN.1', 4, entry), { id: 'GEN.1.4', at: 244.6, until: 253 });
  assert.ok(verseTime('GEN.1', 3, entry).until < 244.6, 'a verse before the last ends in the pause before the next');
});
