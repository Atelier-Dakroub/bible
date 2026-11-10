// Matching the words of a text to the words heard in a recording of it, for
// the times of its verses (tools/import-audio.js).
//
// The transcription is good but not perfect: it misspells names ("sheikam"
// for Shechem), writes numbers as digits (which drop out), and now and then
// misses a phrase. A match word by word that looks only a little way ahead
// can jump to a false "and he said" and lose its place for good. So:
//   1. Anchors: each run of four words that occurs once in the text and once
//      in the words heard.
//   2. Of those, the longest chain in the same order in both (the longest
//      increasing subsequence), so a stray anchor cannot pull the match
//      ahead.
//   3. Between two anchors, the few words there are matched by the least
//      edits (a small dynamic program), each word matched where the two
//      agree.

const N = 4;

/**
 * @param {string[]} words
 * @returns {Map<string, number>} each run of N words that occurs once, and where
 */
function uniqueRuns(words) {
  /** @type {Map<string, number>} */
  const seen = new Map();
  /** @type {Set<string>} */
  const twice = new Set();
  for (let i = 0; i + N <= words.length; i += 1) {
    const key = words.slice(i, i + N).join(' ');
    if (seen.has(key)) twice.add(key);
    else seen.set(key, i);
  }
  for (const key of twice) seen.delete(key);
  return seen;
}

/**
 * The longest chain of pairs increasing in both, from pairs sorted by the
 * first.
 *
 * @param {[number, number][]} pairs
 * @returns {[number, number][]}
 */
function longestChain(pairs) {
  /** @type {number[]} index in pairs of the smallest end of a chain of each length */
  const ends = [];
  /** @type {number[]} */
  const before = new Array(pairs.length).fill(-1);
  for (let k = 0; k < pairs.length; k += 1) {
    const j = pairs[k][1];
    let lo = 0;
    let hi = ends.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pairs[ends[mid]][1] < j) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) before[k] = ends[lo - 1];
    ends[lo] = k;
  }
  /** @type {[number, number][]} */
  const chain = [];
  for (let k = ends.length ? ends[ends.length - 1] : -1; k >= 0; k = before[k]) chain.push(pairs[k]);
  return chain.reverse();
}

/**
 * Matches the words between two anchors by the least edits.
 *
 * @param {string[]} text
 * @param {string[]} heard
 * @param {number} i0 @param {number} i1 the text's words, i0 to before i1
 * @param {number} j0 @param {number} j1 the words heard, j0 to before j1
 * @param {(number | null)[]} at where each word of the text was heard
 */
function fill(text, heard, i0, i1, j0, j1, at) {
  const n = i1 - i0;
  const m = j1 - j0;
  if (!n || !m) return;
  // Too long a gap to fill word by word (a missed passage): leave it.
  if (n * m > 4_000_000) return;
  const cost = new Uint32Array((n + 1) * (m + 1));
  const W = m + 1;
  for (let i = 0; i <= n; i += 1) cost[i * W] = i;
  for (let j = 0; j <= m; j += 1) cost[j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const same = text[i0 + i - 1] === heard[j0 + j - 1] ? 0 : 1;
      cost[i * W + j] = Math.min(cost[(i - 1) * W + j - 1] + same, cost[(i - 1) * W + j] + 1, cost[i * W + j - 1] + 1);
    }
  }
  for (let i = n, j = m; i > 0 && j > 0; ) {
    const here = cost[i * W + j];
    const same = text[i0 + i - 1] === heard[j0 + j - 1];
    if (here === cost[(i - 1) * W + j - 1] + (same ? 0 : 1)) {
      if (same) at[i0 + i - 1] = j0 + j - 1;
      i -= 1;
      j -= 1;
    } else if (here === cost[(i - 1) * W + j] + 1) i -= 1;
    else j -= 1;
  }
}

/**
 * Where each word of the text was heard: an index into `heard`, or null.
 *
 * @param {string[]} text the text's words, plain
 * @param {string[]} heard the words heard, plain, in order
 * @returns {(number | null)[]}
 */
export function align(text, heard) {
  const inText = uniqueRuns(text);
  const inHeard = uniqueRuns(heard);
  /** @type {[number, number][]} */
  const pairs = [];
  for (const [key, i] of inText) {
    const j = inHeard.get(key);
    if (j !== undefined) pairs.push([i, j]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const chain = longestChain(pairs);

  /** @type {(number | null)[]} */
  const at = new Array(text.length).fill(null);
  let i0 = 0;
  let j0 = 0;
  for (const [i, j] of chain) {
    if (i < i0 || j < j0) continue;
    fill(text, heard, i0, i, j0, j, at);
    for (let k = 0; k < N; k += 1) at[i + k] = j + k;
    i0 = i + N;
    j0 = j + N;
  }
  fill(text, heard, i0, text.length, j0, heard.length, at);
  return at;
}
