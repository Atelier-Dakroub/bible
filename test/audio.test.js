import assert from 'node:assert/strict';
import test from 'node:test';
import { byteRange } from '../app/data/audio.js';

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
