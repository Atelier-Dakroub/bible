// Search by grammar: what a query asks for, and which grammar codes answer
// it. No data is loaded here; the caller gives the code list
// (data/original/grammar.json), the books and their groups.
//
// A query is words of the grammar, in any order, with these optional parts:
//   a Strong's number   G26 accusative: that word, in that form
//   a language          hebrew, aramaic or greek
//   a code              V-AAM-2S, or V-AAM for every person and number: a
//                       Greek code, or the start of one; HVqw3ms, a Hebrew or
//                       Aramaic one (its language letter, then one part)
//   a scope, at the end in John, in Romans 8, in the Gospels, in the OT
//
//   aorist imperative in John
//   qal consecutive imperfect third masculine singular in Genesis
//   G26 accusative
//   wayyiqtol in Ruth
//
// The words are the grammar's own (Verb, Aorist, Qal, Consecutive Imperfect,
// Plural ...). A word matches the values that hold it, so "aorist" finds the
// 2nd aorist too, "middle" finds the middle deponents, and "pronoun" every
// kind of pronoun. The consecutive forms are the exception: "imperfect" is
// the imperfect, not the wayyiqtol, as a Hebrew grammar keeps them apart.
// First, second and third are the same as 1st, 2nd and 3rd.

/** @typedef {import('./reference.js').Reference} Reference */
/** @typedef {{ id: string, name: string, abbreviation?: string, verses: number[] }} BookEntry */

/**
 * What a query asks for.
 *   terms     the grammar words, each as typed (canonical: lower case, 1st)
 *   strongs   a Strong's number, or ""
 *   code      a code, or the start of a Greek one, or ""
 *   language  'hebrew', 'aramaic', 'greek' or ""
 *   books     the books in scope, or null for all
 *   ref       a chapter or passage in scope, or null
 *   scope     the scope in words, such as "John", or ""
 *
 * @typedef {{ terms: string[], strongs: string, code: string, language: string, books: Set<string> | null, ref: Reference | null, scope: string }} GrammarQuery
 */

const NUMBERS = /** @type {Record<string, string>} */ ({ first: '1st', second: '2nd', third: '3rd' });

// Other names for a term, as grammars and students say them.
const SYNONYMS = /** @type {Record<string, string>} */ ({
  wayyiqtol: 'consecutive imperfect',
  weqatal: 'consecutive perfect',
  yiqtol: 'imperfect',
  qatal: 'perfect',
  article: 'definite article',
});

// Words that join the words of a value, and do not name anything alone.
const JOINING = new Set(['or', 'and', 'from', 'with', 'of', 'the', 'a']);

// Values whose words are better read one by one: "2nd singular" is the 2nd
// person and the singular.
const SPLIT = /^(1st|2nd|3rd) (singular|plural|person)$/;

const LANGUAGES = new Set(['hebrew', 'aramaic', 'greek']);

/** @param {string} word */
function canonicalWord(word) {
  return NUMBERS[word] ?? word;
}

/** @param {string} text */
function canonical(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean).map(canonicalWord).join(' ');
}

/**
 * The values of a code, canonical: one list for a Greek code; for a Hebrew
 * or Aramaic code, one list for each part (and/ the/ earth).
 *
 * @param {string} code
 * @param {Record<string, string>} grammar
 * @returns {string[][]}
 */
export function partsOf(code, grammar) {
  /** @param {string} text */
  const values = (text) => text.split(' · ').map(canonical).filter(Boolean);
  if (/^[HA]/.test(code)) {
    const language = code[0];
    return code
      .slice(1)
      .split('/')
      .filter(Boolean)
      .map((part) => values(grammar[`${language}${part}`] ?? ''))
      .filter((list) => list.length);
  }
  return grammar[code] ? [values(grammar[code])] : [];
}

/**
 * True when a value answers a term: it is the term, or holds the term's
 * words in a row ("2nd aorist" holds "aorist"), but a consecutive form does
 * not answer its plain tense.
 *
 * @param {string} term canonical
 * @param {string} value canonical
 */
export function accepts(term, value) {
  if (value === term) return true;
  if (/^consecutive /.test(value) && !term.includes('consecutive')) return false;
  return ` ${value} `.includes(` ${term} `);
}

/**
 * The words a query can use: every value, and every word of a value.
 *
 * @param {Record<string, string>} grammar
 */
export function vocabularyOf(grammar) {
  /** @type {Set<string>} */
  const phrases = new Set();
  for (const text of Object.values(grammar)) {
    for (const value of text.split(' · ')) {
      const each = canonical(value);
      if (!each) continue;
      if (!SPLIT.test(each)) phrases.add(each);
      for (const word of each.split(' ')) if (!JOINING.has(word) && !word.includes('+')) phrases.add(word);
    }
  }
  for (const [name, term] of Object.entries(SYNONYMS)) {
    phrases.add(name);
    phrases.add(term);
  }
  const longest = Math.max(...[...phrases].map((phrase) => phrase.split(' ').length));
  return { phrases, longest };
}

/**
 * The books a scope names, and the scope in words. A scope is a group (the
 * Gospels, the OT), a book (John), or a chapter or passage (Romans 8).
 *
 * @param {string} text such as "the gospels"
 * @param {BookEntry[]} books
 * @param {{ name: string, books: string[] }[]} groups
 * @param {(text: string) => BookEntry | null} findBook
 * @param {(text: string) => Reference | null} parseReference
 * @returns {{ books: Set<string>, ref: Reference | null, scope: string } | null}
 */
function scopeOf(text, books, groups, findBook, parseReference) {
  const key = text.toLowerCase().replace(/^the\s+/, '').trim();
  const nt = books.findIndex((book) => book.id === 'MAT');
  /** @type {Record<string, { ids: string[], scope: string }>} */
  const named = {
    ot: { ids: books.slice(0, nt).map((book) => book.id), scope: 'the Old Testament' },
    'old testament': { ids: books.slice(0, nt).map((book) => book.id), scope: 'the Old Testament' },
    nt: { ids: books.slice(nt).map((book) => book.id), scope: 'the New Testament' },
    'new testament': { ids: books.slice(nt).map((book) => book.id), scope: 'the New Testament' },
  };
  for (const group of groups) named[group.name.toLowerCase()] = { ids: group.books, scope: group.name };
  const law = groups.find((group) => group.name === 'Law');
  if (law) named.torah = named.pentateuch = { ids: law.books, scope: 'the Law' };
  if (named['law']) named['law'] = { ids: named['law'].ids, scope: 'the Law' };
  const paul = groups.find((group) => group.name === 'Letters of Paul');
  if (paul) named.paul = named.epistles = { ids: paul.books, scope: 'the letters of Paul' };
  if (named.gospels) named.gospels = { ids: named.gospels.ids, scope: 'the Gospels' };
  const prophets = groups.filter((group) => /prophets/i.test(group.name)).flatMap((group) => group.books);
  if (prophets.length) named.prophets = { ids: prophets, scope: 'the Prophets' };

  if (named[key]) return { books: new Set(named[key].ids), ref: null, scope: named[key].scope };
  const ref = parseReference(text);
  if (ref) return { books: new Set([ref.book]), ref, scope: text.trim() };
  const book = findBook(text);
  if (book) return { books: new Set([book.id]), ref: null, scope: book.name };
  return null;
}

/**
 * What a query asks for, or null when it is not a search by grammar: a word
 * in it is not the grammar's, or it asks for nothing.
 *
 * @param {string} text
 * @param {{ phrases: Set<string>, longest: number }} vocabulary
 * @param {{
 *   books: BookEntry[], groups: { name: string, books: string[] }[],
 *   findBook: (text: string) => BookEntry | null, parseReference: (text: string) => Reference | null
 * }} canon
 * @returns {GrammarQuery | null}
 */
export function parseGrammar(text, vocabulary, canon) {
  let rest = text.trim();
  /** @type {GrammarQuery} */
  const query = { terms: [], strongs: '', code: '', language: '', books: null, ref: null, scope: '' };

  // The scope: the last "in ...".
  const scoped = /^(.*?)\s+in\s+(.+)$/i.exec(rest);
  if (scoped) {
    const scope = scopeOf(scoped[2], canon.books, canon.groups, canon.findBook, canon.parseReference);
    if (!scope) return null;
    query.books = scope.books;
    query.ref = scope.ref;
    query.scope = scope.scope;
    rest = scoped[1];
  }

  const words = rest.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; ) {
    const word = words[i];
    const strongs = /^([HG])0*(\d+)$/i.exec(word);
    if (strongs && !query.strongs) {
      query.strongs = `${strongs[1].toUpperCase()}${strongs[2]}`;
      i += 1;
      continue;
    }
    // A Greek code, or its start (V-AAM), or a Hebrew one (HVqw3ms).
    if (!query.code && (/^[A-Z]+(-[A-Z0-9]+){1,3}$/.test(word) || /^[HA][A-Z][a-z0-9]+$/.test(word))) {
      query.code = word;
      i += 1;
      continue;
    }
    const lower = word.toLowerCase();
    if (LANGUAGES.has(lower) && !query.language) {
      query.language = lower;
      i += 1;
      continue;
    }
    // The longest run of words that is a value, or a word of one.
    let found = 0;
    for (let length = Math.min(vocabulary.longest, words.length - i); length > 0 && !found; length -= 1) {
      const phrase = canonical(words.slice(i, i + length).join(' '));
      if (vocabulary.phrases.has(phrase)) {
        query.terms.push(SYNONYMS[phrase] ?? phrase);
        found = length;
      }
    }
    if (!found) return null;
    i += found;
    // "1st person" is the 1st.
    if (/^(1st|2nd|3rd)$/.test(query.terms.at(-1) ?? '') && words[i]?.toLowerCase() === 'person') i += 1;
  }
  if (!query.terms.length && !query.code) return null;
  return query;
}

/**
 * A test for a word's code: true when the code answers the query's grammar
 * (its terms, all in one part of the word, and its code). Each code is
 * worked out once.
 *
 * @param {GrammarQuery} query
 * @param {Record<string, string>} grammar
 * @returns {(code: string) => boolean}
 */
export function codeTest(query, grammar) {
  /** @type {Map<string, boolean>} */
  const known = new Map();
  const wanted = query.code;
  return (code) => {
    let answer = known.get(code);
    if (answer !== undefined) return answer;
    answer = true;
    if (wanted) {
      if (/^[HA][A-Z]/.test(wanted) && /^[HA]/.test(code)) answer = code[0] === wanted[0] && code.slice(1).split('/').includes(wanted.slice(1));
      else answer = code === wanted || code.startsWith(`${wanted}-`);
    }
    if (answer && query.terms.length) {
      answer = partsOf(code, grammar).some((values) => query.terms.every((term) => values.some((value) => accepts(term, value))));
    }
    known.set(code, answer);
    return answer;
  };
}

/**
 * The query in words, for a summary: "Aorist imperative in John".
 *
 * @param {GrammarQuery} query
 * @param {Record<string, string>} grammar
 * @param {string} [lemma] the Strong's word, such as "agapē"
 */
export function describe(query, grammar, lemma = '') {
  const parts = [];
  if (query.language) parts.push(query.language[0].toUpperCase() + query.language.slice(1));
  if (query.code) parts.push(grammar[query.code] ? grammar[query.code].replaceAll(' · ', ' ').toLowerCase() : query.code);
  parts.push(...query.terms);
  if (query.strongs) parts.push(lemma ? `${lemma} (${query.strongs})` : query.strongs);
  let text = parts.join(' ');
  text = text[0].toUpperCase() + text.slice(1);
  return query.scope ? `${text} in ${query.scope}` : text;
}
