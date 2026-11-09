// Which words two translations of a verse share, and which they do not.
//
// The two verses are lists of words. The longest run of words common to both,
// in order (the longest common subsequence), is what they share; every other
// word is a difference. Words are compared in a plain form: lower case,
// letters only, the KJV's older forms read as the modern ones ("thee" as
// "you", "hath" as "has"), and the endings of a longer word left off, so
// "believeth" and "believes" are one word. So a difference is a difference
// of words, not of spelling or of form.

// The older forms the KJV uses, and the modern word each one is read as.
const OLDER = new Map([
  ['thee', 'you'],
  ['thou', 'you'],
  ['ye', 'you'],
  ['thy', 'your'],
  ['thine', 'your'],
  ['hath', 'has'],
  ['doth', 'does'],
  ['art', 'are'],
  ['shalt', 'shall'],
  ['wilt', 'will'],
  ['saith', 'says'],
  ['spake', 'spoke'],
  ['unto', 'to'],
  ['hast', 'have'],
  ['didst', 'did'],
  ['canst', 'can'],
  ['wast', 'were'],
]);

/**
 * A word in the plain form that comparison uses.
 *
 * @param {string} word
 */
export function plain(word) {
  const letters = word.toLowerCase().replace(/[’']s$/, '').replace(/[^\p{L}]/gu, '');
  const modern = OLDER.get(letters) ?? letters;
  // "loveth", "loves" and "loved" are one word; "go" and "is" stay as they are.
  return modern.length >= 4 ? modern.replace(/(?:eth|est|es|ed|s|e)$/, '') : modern;
}

/**
 * For each word of `a` and of `b`, true when the other list does not share
 * it.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{ a: boolean[], b: boolean[] }}
 */
export function differences(a, b) {
  const x = a.map(plain);
  const y = b.map(plain);
  // lengths[i][j]: the longest common run of x from i and y from j.
  const lengths = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i -= 1) {
    for (let j = y.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = x[i] === y[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const inA = a.map(() => true);
  const inB = b.map(() => true);
  let i = 0;
  let j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) {
      inA[i] = false;
      inB[j] = false;
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i += 1;
    else j += 1;
  }
  return { a: inA, b: inB };
}
