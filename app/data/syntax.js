// Syntax (tools/import-syntax.js): the sentences of the Hebrew and the Greek
// as clauses, and each clause as its parts (subject, verb, object and the
// rest), from MACULA Greek and MACULA Hebrew (© Biblica, CC BY 4.0). Two uses:
//
//   - the Syntax version of a card: each clause of a passage on a row of its
//     own, its parts as labeled boxes, the clauses inside it indented under
//     it (syntaxOf);
//   - a search by syntax: "subject God verb love" finds the clauses whose
//     subject has a word for God and whose verb is a word for love
//     (syntaxQuery, syntaxResults). A word is a Strong's number (G2316), a
//     word of the original as it is said (theos), or an English word, which
//     stands for the words of the original the KJV renders by it.
//
// The Greek is Nestle's text of 1904, which differs in places from the
// Textus Receptus that the KJV translated; the Hebrew is the Leningrad Codex.

import { answer, book, books, lemmaCodes, passage, strongsBook } from './bible.js';
import { findBook, formatReference, parseAddress, toAddress, versesIn } from '../lib/reference.js';
import { tokenize } from '../lib/words.js';

export const CREDIT =
  'Syntax: MACULA Greek and MACULA Hebrew (© Biblica, CC BY 4.0). The Greek is Nestle 1904, which differs in places from the Textus Receptus the KJV translated; the Hebrew is the Leningrad Codex.';

/** @typedef {[string, string, string]} Word text (with what follows it), gloss, Strong's number */
/** @typedef {{ p: [string, Word[], Clause[]?][] }} Clause */
/** @typedef {{ v: string[], c: Clause[] }} Sentence */

/** What each role is called on a card. */
const ROLE_LABEL = /** @type {Record<string, string>} */ ({
  s: 'subject',
  v: 'verb',
  vc: 'verb',
  o: 'object',
  o2: 'second object',
  io: 'indirect object',
  p: 'predicate',
  adv: 'adverbial',
  aux: 'auxiliary',
});

/** @type {Map<string, Promise<Sentence[]>>} */
const loaded = new Map();

/** @param {string} id @returns {Promise<Sentence[]>} */
function sentencesOf(id) {
  let promise = loaded.get(id);
  if (!promise) {
    promise = import(`./syntax/${id}.json`, { with: { type: 'json' } })
      .then((module) => module.default.sentences)
      .catch(() => []);
    loaded.set(id, promise);
  }
  return promise;
}

/** @param {Word[]} words */
const textOf = (words) => words.map((word) => word[0]).join('').trim();
/** @param {Word[]} words */
const glossOf = (words) =>
  words
    .map((word) => word[1])
    .filter(Boolean)
    .join(' ');

/**
 * @typedef {{ role: string, label: string, text: string, gloss: string }} RowPart
 * @typedef {{ depth: number, label: string, parts: RowPart[] }} Row
 */

/**
 * A sentence's clauses as rows: each clause on a row of its own, indented by
 * how deep it is, with the parts that have words. A clause that is only
 * words with no role (a conjunction) and one clause joins that clause's row.
 *
 * @param {Clause[]} clauses
 * @returns {Row[]}
 */
export function rowsOf(clauses) {
  /** @type {Row[]} */
  const rows = [];
  /**
   * @param {Clause} clause
   * @param {number} depth
   * @param {string} label
   * @param {RowPart[]} before words that lead into this clause
   */
  const visit = (clause, depth, label, before) => {
    // A frame of clauses joined by words with no role ("and … and …"): each
    // clause on its own row, with the words that join it in front: the words
    // in its own group, else those just before it. Where the words before the
    // first are as many as the clauses, and no clause has its own, each goes
    // with its own clause (the Hebrew puts all its "and"s first).
    if (!clause.p.some(([role, words]) => role && words.length)) {
      /** @type {{ sub: Clause, where: string, lead: Word[] }[]} */
      const items = [];
      /** @type {Word[]} */
      let free = [];
      for (const [role, words, inner = []] of clause.p) {
        if (!inner.length) {
          free.push(...words);
          continue;
        }
        inner.forEach((sub, k) => items.push({ sub, where: ROLE_LABEL[role] ?? '', lead: k === 0 ? [...free, ...words] : [] }));
        free = [];
      }
      if (items.length) {
        const first = items[0].lead;
        if (items.length > 1 && first.length === items.length && items.slice(1).every((item) => !item.lead.length)) {
          items.forEach((item, i) => (item.lead = [first[i]]));
        }
        items.forEach(({ sub, where, lead }, i) => {
          const leading = lead.length ? [{ role: '', label: '', text: textOf(lead), gloss: glossOf(lead) }] : [];
          visit(sub, depth, where || (i === 0 ? label : ''), i === 0 ? [...before, ...leading] : leading);
        });
        if (free.length) rows.push({ depth, label: '', parts: [{ role: '', label: '', text: textOf(free), gloss: glossOf(free) }] });
        return;
      }
    }
    /** @type {RowPart[]} */
    const parts = [...before];
    /** @type {[Clause, string][]} */
    const inner = [];
    for (const [role, words, subs = []] of clause.p) {
      if (words.length) parts.push({ role, label: ROLE_LABEL[role] ?? '', text: textOf(words), gloss: glossOf(words) });
      const where = words.length ? `in the ${ROLE_LABEL[role] ?? 'phrase'}` : (ROLE_LABEL[role] ?? '');
      for (const sub of subs) inner.push([sub, where]);
    }
    // Only words with no role, and one clause: they lead into it.
    if (inner.length === 1 && parts.every((part) => !part.role)) {
      visit(inner[0][0], depth, inner[0][1] || label, parts);
      return;
    }
    if (parts.length) rows.push({ depth, label, parts });
    for (const [sub, where] of inner) visit(sub, parts.length ? depth + 1 : depth, where, []);
  };
  for (const clause of clauses) visit(clause, 0, '', []);
  return rows;
}

/**
 * The Syntax version of a passage: the sentences that have a verse in it,
 * each whole, as rows.
 *
 * @param {import('../lib/reference.js').Reference} ref
 */
export async function syntaxOf(ref) {
  const inside = new Set(versesIn(ref, books).map(([chapter, verse]) => `${ref.book}.${chapter}.${verse}`));
  const nt = books.findIndex((entry) => entry.id === ref.book) >= books.findIndex((entry) => entry.id === 'MAT');
  const sentences = (await sentencesOf(ref.book))
    .filter((sentence) => sentence.v.some((verse) => inside.has(verse)))
    .map((sentence) => ({ label: labelOf(sentence.v), rows: rowsOf(sentence.c) }));
  return { language: nt ? 'greek' : 'hebrew', lang: nt ? 'grc' : 'hbo', dir: nt ? 'ltr' : 'rtl', sentences };
}

/** The verses of a sentence, as a short label: 3:16, or 3:16–18. @param {string[]} verses */
function labelOf(verses) {
  const [, chapter, first] = verses[0].split('.');
  const [, lastChapter, last] = verses[verses.length - 1].split('.');
  if (verses.length === 1) return `${chapter}:${first}`;
  return lastChapter === chapter ? `${chapter}:${first}–${last}` : `${chapter}:${first}–${lastChapter}:${last}`;
}

// ---- The search by syntax ----

const ROLE_WORDS = /** @type {Record<string, string>} */ ({ subject: 's', verb: 'v', object: 'o', predicate: 'p' });
const QUERY = /^\s*((?:(?:subject|verb|object|predicate)\s+\S+\s*)+)(?:\s+in\s+(.+?))?\s*$/i;

/** @typedef {{ terms: { role: string, word: string, codes: Set<string> }[], books: Set<string> | null, scope: string }} SyntaxQuery */

/** @type {Promise<Map<string, Map<string, number>>> | null} */
let renderings = null;

/**
 * For each English word of the KJV, the Strong's numbers it renders, and how
 * often.
 *
 * @returns {Promise<Map<string, Map<string, number>>>}
 */
function renderingIndex() {
  renderings ??= (async () => {
    /** @type {Map<string, Map<string, number>>} */
    const map = new Map();
    for (const entry of books) {
      const [found, codes] = await Promise.all([book(entry.id), strongsBook(entry.id)]);
      for (const chapter of found.chapters) {
        for (const verse of chapter.verses) {
          const numbers = (codes[verse.id] ?? '').split(' ');
          let next = 1;
          for (const block of verse.blocks) {
            for (const run of block.runs) {
              const split = tokenize(run.text, next);
              next = split.next;
              for (const token of split.tokens) {
                const code = token.w ? numbers[token.w - 1] : '';
                if (!code || code === '-') continue;
                const word = token.text.toLowerCase().replace(/[^a-z]/g, '');
                if (!word) continue;
                let counts = map.get(word);
                if (!counts) map.set(word, (counts = new Map()));
                counts.set(code, (counts.get(code) ?? 0) + 1);
              }
            }
          }
        }
      }
    }
    return map;
  })();
  return renderings;
}

/**
 * The Strong's numbers a word of a syntax search stands for.
 *
 * @param {string} word
 * @returns {Promise<Set<string>>}
 */
async function codesFor(word) {
  const strongs = /^([HG])0*(\d+)$/i.exec(word);
  if (strongs) return new Set([`${strongs[1].toUpperCase()}${strongs[2]}`]);
  const found = new Set(await lemmaCodes(word));
  // An English word: the numbers it renders often, in all its forms (love,
  // loved, loveth).
  const index = await renderingIndex();
  const base = word.toLowerCase().replace(/[^a-z]/g, '');
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const form of [base, `${base}s`, `${base}d`, `${base}ed`, `${base}eth`, `${base}est`, `${base}th`, `${base}ing`, base.replace(/e$/, 'ing')]) {
    for (const [code, count] of index.get(form) ?? []) counts.set(code, (counts.get(code) ?? 0) + count);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  for (const [code, count] of counts) if (count >= 3 && count >= total * 0.05) found.add(code);
  return found;
}

/**
 * A search by syntax, or null when the text is not one: roles, each with a
 * word, and a book after "in".
 *
 * @param {string} text such as "subject God verb love in John"
 * @returns {Promise<SyntaxQuery | null>}
 */
export async function syntaxQuery(text) {
  const match = QUERY.exec(text);
  if (!match) return null;
  const terms = [];
  for (const [, role, word] of match[1].matchAll(/(subject|verb|object|predicate)\s+(\S+)/gi)) {
    terms.push({ role: ROLE_WORDS[role.toLowerCase()], word, codes: await codesFor(word) });
  }
  if (!terms.length) return null;
  /** @type {Set<string> | null} */
  let scope = null;
  if (match[2]) {
    const found = findBook(match[2], books);
    if (!found) return null;
    scope = new Set([found.id]);
  }
  return { terms, books: scope, scope: match[2] ? (findBook(match[2], books)?.name ?? '') : '' };
}

/**
 * True when a clause has, for each term, a part in that role with one of its
 * words; a part's own words, not those of a clause inside it.
 *
 * @param {Clause} clause
 * @param {SyntaxQuery} query
 */
function matches(clause, query) {
  return query.terms.every(({ role, codes }) =>
    clause.p.some(([own, words]) => (own === role || (role === 'v' && own === 'vc')) && words.some((word) => codes.has(word[2]))),
  );
}

/** Every clause of a sentence, the ones inside others too. @param {Clause[]} clauses @returns {Clause[]} */
const allClauses = (clauses) => clauses.flatMap((clause) => [clause, ...clause.p.flatMap(([, , subs = []]) => allClauses(subs))]);

/**
 * The sentences with a clause that answers a search, in canon order.
 *
 * @param {SyntaxQuery} query
 * @returns {Promise<Sentence[]>}
 */
export async function syntaxFind(query) {
  const codes = query.terms.flatMap((term) => [...term.codes]);
  const greek = codes.some((code) => code.startsWith('G'));
  const hebrew = codes.some((code) => code.startsWith('H'));
  const nt = books.findIndex((entry) => entry.id === 'MAT');
  /** @type {Sentence[]} */
  const found = [];
  for (const [i, entry] of books.entries()) {
    if (query.books && !query.books.has(entry.id)) continue;
    if ((i >= nt && !greek) || (i < nt && !hebrew)) continue;
    for (const sentence of await sentencesOf(entry.id)) {
      if (allClauses(sentence.c).some((clause) => matches(clause, query))) found.push(sentence);
    }
  }
  return found;
}

/**
 * The search panel's answer to a search by syntax.
 *
 * @param {string} text
 * @param {SyntaxQuery} query
 * @param {number} [limit]
 */
export async function syntaxResults(text, query, limit = 50) {
  const empty = query.terms.filter((term) => !term.codes.size);
  if (empty.length) return answer({ query: text, summary: `No word of the original is “${empty[0].word}”. ${CREDIT}` });
  const found = await syntaxFind(query);
  const asked = query.terms.map((term) => `${term.word} as ${ROLE_LABEL[term.role]}`).join(', ');
  const codes = new Set(query.terms.flatMap((term) => [...term.codes]));
  const results = [];
  for (const sentence of found.slice(0, limit)) {
    const first = sentence.v[0];
    const last = sentence.v[sentence.v.length - 1];
    const [bookId, chapter, verse] = first.split('.');
    const [, lastChapter, lastVerse] = last.split('.');
    const address = sentence.v.length === 1 ? first : lastChapter === chapter ? `${bookId}.${chapter}.${verse}-${lastVerse}` : `${bookId}.${chapter}.${verse}-${lastChapter}.${lastVerse}`;
    const ref = parseAddress(address, books);
    if (!ref) continue;
    const { title, verses } = await passage(ref);
    const parts = verses.slice(0, 3).flatMap((each) => markCodes(each, codes));
    results.push({ address: toAddress(ref), title: formatReference(ref, books) || title, parts });
  }
  const where = query.scope ? ` in ${query.scope}` : '';
  const summary = found.length
    ? `${asked}${where}: ${found.length === 1 ? '1 sentence' : `${found.length.toLocaleString('en')} sentences`}${results.length < found.length ? `; the first ${results.length}, in canon order` : ''}. ${CREDIT}`
    : `${asked}${where}: no sentence. ${CREDIT}`;
  return answer({ query: text, summary, results, landscape: '' });
}

/**
 * A verse's words, the ones that render any of the numbers marked.
 *
 * @param {import('./bible.js').WordVerse} verse
 * @param {Set<string>} codes
 */
function markCodes(verse, codes) {
  /** @type {{ text: string, hit: boolean }[]} */
  const parts = [];
  for (const block of verse.blocks) {
    for (const run of block.runs) {
      for (const token of run.tokens) {
        const hit = codes.has(token.s ?? '');
        const last = parts.at(-1);
        if (last && last.hit === hit) last.text += token.text;
        else parts.push({ text: token.text, hit });
      }
    }
    const last = parts.at(-1);
    if (last && !last.text.endsWith(' ')) last.text += ' ';
  }
  return parts;
}

