#!/usr/bin/env node
// An MCP server for this app's data: an assistant such as Claude can
// search the text, read a passage in any of the app's versions, study a word,
// and look up people, places, events, cross-references, quotations, journeys
// and the passage guide, from the same data the table shows.
//
//   node tools/mcp-server.js
//
// It speaks the Model Context Protocol over stdin and stdout (JSON-RPC, one
// message to a line), with no library: initialize, tools/list, tools/call
// and ping. It reads the data in app/data directly, so the app need not be
// running. It only reads: nothing here changes the table or any file.
//
// Every answer names its sources, as the app does, and gives addresses
// (JHN.3.16) beside the references (John 3:16), so an answer can cite them
// and the table can open them.

import { books, entityView, lemmaCodes, original, parallel, passage, plainText, referenceResults, reverse, search, strongsResults } from '../app/data/bible.js';
import { entities, formatYear } from '../app/data/entities.js';
import { journeysFor } from '../app/data/journeys.js';
import { quotationResults } from '../app/data/quotations.js';
import { guideResults } from '../app/data/study.js';
import { formatReference, parseAddress, parseReference, toAddress } from '../app/lib/reference.js';

// Standard output is the protocol's alone: anything a module logs goes to
// standard error.
console.log = console.error;

const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_TEXT = 60000;

const KJV = 'KJV text: public domain (eBible.org).';
const STEP = 'Hebrew and Greek: STEPBible.org, from Tyndale House, Cambridge (CC BY 4.0).';
const THEOGRAPHIC = "People, places and events: Theographic (CC BY-SA 4.0); dates by Floyd Nolen Jones's chronology.";

/** A reference as typed (John 3:16-18) or an address (JHN.3.16-18). @param {string} text */
function refOf(text) {
  const ref = parseAddress(String(text).trim(), books) ?? parseReference(String(text).trim(), books);
  if (!ref) throw new Error(`No passage has the reference "${text}". Write it as John 3:16-18 or JHN.3.16-18.`);
  return ref;
}

/** @param {import('../app/lib/reference.js').Reference} ref */
const named = (ref) => `${formatReference(ref, books)} (${toAddress(ref)})`;

/** Results as lines: each title, address and text. @param {{ title: string, address: string, parts: { text: string }[] }[]} results */
const lines = (results) => results.map((each) => `- ${each.title} (${each.address}): ${each.parts.map((part) => part.text).join('').replace(/\s+/g, ' ').trim()}`).join('\n');

/**
 * The tools: each with its description and input schema for the client, and
 * the function that answers it with text.
 *
 * @type {Record<string, { description: string, inputSchema: object, run: (args: any) => Promise<string> }>}
 */
const TOOLS = {
  search: {
    description:
      "Search the Bible as the app's search field does. Takes words or a phrase in quotes (searches the KJV); a reference (John 3:16); a Strong's number (G26, H2617); a word of the original by its name (agape, chesed, shalom); or the grammar of the Hebrew and Greek, with an optional scope (\"aorist imperative in John\", \"wayyiqtol in Ruth\", \"G26 accusative\"). Returns the verses found, with addresses.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for.' },
        limit: { type: 'integer', minimum: 1, maximum: 200, description: 'How many verses at most (default 30).' },
      },
      required: ['query'],
    },
    async run({ query, limit = 30 }) {
      const found = await search(String(query), Math.min(200, Number(limit) || 30));
      const parts = [found.summary];
      if (found.entry) parts.push(`Word: ${found.entry.code} ${found.entry.lemma} (${found.entry.xlit}): ${found.entry.def}`);
      if (found.stats) {
        parts.push(found.stats.summary);
        if (found.stats.renderings.length) parts.push(`Most often: ${found.stats.renderings.map((each) => `${each.text} (${each.count})`).join(', ')}${found.stats.more ? `, ${found.stats.more}` : ''}.`);
        if (found.stats.most) parts.push(found.stats.most);
      }
      if (found.also.length) parts.push(`Words of the original written so: ${found.also.map((each) => each.label).join(', ')}.`);
      parts.push(
        found.results
          .map((each) => {
            const words = each.original?.length ? ` [${each.original.map((word) => `${word.text} ${word.translit} "${word.gloss}"`).join('; ')}]` : '';
            return `- ${each.title} (${each.address}):${words} ${each.parts.map((part) => part.text).join('').replace(/\s+/g, ' ').trim()}`;
          })
          .join('\n'),
      );
      parts.push(`${KJV}${found.stats || found.entry ? " Strong's numbers: eBible.org; dictionary: Open Scriptures (CC BY-SA)." : ''}${found.results.some((each) => each.original?.length) ? ` ${STEP}` : ''}`);
      return parts.filter(Boolean).join('\n\n');
    },
  },

  passage: {
    description:
      "Read a passage in one of the app's versions: kjv (the King James Version, the default), bsb (the Berean Standard Bible), original (the Hebrew or the Greek the KJV translated), interlinear (the original word by word, with transliteration, English, grammar and Strong's number), or reverse (the KJV in its own order, with the word of the original under each word).",
    inputSchema: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'Such as John 3:16-18, Genesis 1, or JHN.3.16-18.' },
        version: { type: 'string', enum: ['kjv', 'bsb', 'original', 'interlinear', 'reverse'] },
      },
      required: ['reference'],
    },
    async run({ reference, version = 'kjv' }) {
      const ref = refOf(reference);
      if (version === 'bsb') {
        const { rows } = await parallel(ref);
        const text = rows.map((row) => `${row.verse.label ?? row.verse.n} ${row.bsb.map((block) => block.parts.map((part) => part.text).join('')).join(' ') || '(not in the BSB)'}`);
        return `${named(ref)}, BSB\n\n${text.join('\n')}\n\nBerean Standard Bible: public domain.`;
      }
      if (version === 'original' || version === 'interlinear') {
        const source = await original(ref);
        const text = source.verses.map((verse) =>
          version === 'original'
            ? `${verse.label} ${verse.words.map((word) => word.text).join(' ')}`
            : `${verse.label}\n${verse.words.map((word) => `  ${word.text} | ${word.translit} | ${word.gloss} | ${word.grammar} | ${word.s}${word.tr ? ' | not in Nestle-Aland' : ''}`).join('\n')}`,
        );
        return `${named(ref)}, ${source.language === 'hebrew' ? 'Hebrew (Leningrad text, with the Qere)' : 'Greek (the Textus Receptus the KJV translated)'}\n\n${text.join('\n')}\n\n${STEP}`;
      }
      if (version === 'reverse') {
        const [{ rows }, source] = await Promise.all([parallel(ref), original(ref)]);
        const text = reverse(rows.map((row) => row.verse), source).map((verse) => `${verse.label} ${verse.groups.map((group) => (group.orig ? `${group.en} [${group.orig.text} ${group.orig.translit}, ${group.orig.s}]` : group.en)).join(' ')}`);
        return `${named(ref)}, KJV with the original under each word\n\n${text.join('\n')}\n\n${KJV} ${STEP}`;
      }
      const { verses } = await passage(ref);
      return `${named(ref)}, KJV\n\n${verses.map((verse) => `${verse.label ?? verse.n} ${plainText(verse)}`).join('\n')}\n\n${KJV}`;
    },
  },

  word_study: {
    description:
      "Study a word of the Hebrew or the Greek: its Strong's dictionary entry, how the KJV renders it and how often, where it occurs by book, and the first verses that use it. Takes a Strong's number (H2617, G26) or the word's name as it is said (chesed, agape).",
    inputSchema: {
      type: 'object',
      properties: { word: { type: 'string', description: "A Strong's number or the word's name." } },
      required: ['word'],
    },
    async run({ word }) {
      const text = String(word).trim();
      const strongs = /^([HG])0*(\d+)$/i.exec(text);
      const codes = strongs ? [`${strongs[1].toUpperCase()}${strongs[2]}`] : await lemmaCodes(text);
      if (!codes.length) throw new Error(`No word of the original is written "${text}". Try a Strong's number, such as G26.`);
      const study = await strongsResults(codes[0], 25);
      if (!study.entry) throw new Error(`${codes[0]} is not in the dictionary.`);
      const { entry, stats } = study;
      return [
        `${entry.code} ${entry.lemma} (${entry.xlit}${entry.pron ? `, said ${entry.pron}` : ''}): ${entry.def}`,
        `KJV renders it: ${entry.kjv}`,
        stats ? `${stats.summary} Most often: ${stats.renderings.map((each) => `${each.text} (${each.count})`).join(', ')}${stats.more ? `, ${stats.more}` : ''}. ${stats.most}` : '',
        codes.length > 1 ? `Other words written so: ${codes.slice(1).join(', ')}.` : '',
        `The first verses:\n${lines(study.results)}`,
        `${KJV} Strong's numbers: eBible.org. Dictionary: Open Scriptures (CC BY-SA).`,
      ]
        .filter(Boolean)
        .join('\n\n');
    },
  },

  entity: {
    description:
      'Look up a person, place, group or event of the Bible: its facts (dates by Jones, and for a king the modern chronologies), its relations (family, places, people of an event), a summary from Easton\'s dictionary, and the verses that name it. Takes an id (person:david_994) or a name; a name that fits several returns them to choose from.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'A name, such as Paul or Bethel, or an id, such as place:bethel_202.' } },
      required: ['name'],
    },
    async run({ name }) {
      const text = String(name).trim();
      const known = await entities();
      let id = text in known ? text : '';
      if (!id) {
        const key = text.toLowerCase();
        const matches = Object.entries(known).filter(([, each]) => each.title?.toLowerCase() === key || each.name?.toLowerCase() === key);
        if (!matches.length) throw new Error(`Nothing is named "${text}". Try the search tool.`);
        if (matches.length > 1) {
          return `Several have that name; ask again with an id:\n${matches
            .sort((a, b) => b[1].verses.length - a[1].verses.length)
            .slice(0, 20)
            .map(([each, found]) => `- ${each}: ${found.title}, ${found.kind}, named in ${found.verses.length} verses${found.verses[0] ? `, first ${found.verses[0]}` : ''}`)
            .join('\n')}`;
        }
        id = matches[0][0];
      }
      const view = await entityView(id);
      if (!view) throw new Error(`Nothing has the id ${id}.`);
      const found = known[id];
      const relations = view.relations.map((relation) => `${relation.label}: ${relation.items.map((item) => `${item.name} (${item.id})`).join(', ')}`);
      const verses = found?.verses ?? [];
      const journeys = found?.kind === 'person' ? await journeysFor({ person: id }) : [];
      return [
        `${view.title} (${id}): ${view.facts.join(' · ')}`,
        view.summary,
        relations.join('\n'),
        verses.length ? `Named in ${verses.length} verses: ${verses.slice(0, 40).join(', ')}${verses.length > 40 ? ', …' : ''}` : '',
        journeys.length ? `Journeys: ${journeys.map((each) => `${each.title}${each.route ? ` (${each.route})` : ''}`).join('; ')}` : '',
        view.credit,
      ]
        .filter(Boolean)
        .join('\n\n');
    },
  },

  cross_references: {
    description: "The cross-references of one verse, best first, from OpenBible.info's votes on the Treasury of Scripture Knowledge, each with its text.",
    inputSchema: {
      type: 'object',
      properties: { verse: { type: 'string', description: 'One verse, such as John 3:16 or JHN.3.16.' } },
      required: ['verse'],
    },
    async run({ verse }) {
      const ref = refOf(verse);
      const found = await referenceResults(toAddress(ref), 30);
      return `Cross-references of ${named(ref)}: ${found.summary}\n\n${lines(found.results)}\n\nCross-references: OpenBible.info (CC BY). ${KJV}`;
    },
  },

  quotations: {
    description:
      "The Old Testament in the New: for a New Testament verse, the Old Testament passages it quotes; for an Old Testament verse, the New Testament passages that quote it. These are the quotations Nestle's Greek New Testament (1904) prints in bold; the data does not yet cover 1-2 Corinthians, Philemon, Hebrews, the general letters or Revelation.",
    inputSchema: {
      type: 'object',
      properties: { verse: { type: 'string', description: 'A verse, such as Romans 1:17 or HAB.2.4.' } },
      required: ['verse'],
    },
    async run({ verse }) {
      const ref = refOf(verse);
      const found = await quotationResults(toAddress(ref));
      return `${found.summary}\n\n${lines(found.results)}\n\n${KJV}`;
    },
  },

  journeys: {
    description:
      "The journeys of a person on the map, with every route scholars propose where they differ (the Exodus has four): each route's basis, its stops in order, and the verse that names each stop. People with journeys: Paul (person:paul_2479), Abraham (person:abraham_58), Jacob (person:israel_682), Moses (person:moses_2108), Jesus (person:jesus_905).",
    inputSchema: {
      type: 'object',
      properties: { person: { type: 'string', description: 'A person id, such as person:paul_2479, or a passage address that a journey covers, such as ACT.16.11.' } },
      required: ['person'],
    },
    async run({ person }) {
      const text = String(person).trim();
      const found = text.startsWith('person:') ? await journeysFor({ person: text }) : await journeysFor({ address: toAddress(refOf(text)) });
      if (!found.length) return `No journey for ${text}.`;
      return `${found
        .map(
          (journey) =>
            `${journey.title}${journey.route ? ` — ${journey.route}` : ''} (${journey.passageTitle}${journey.years ? `; ${journey.years}` : ''}; about ${journey.km} km in straight legs)${journey.basis ? `\n${journey.basis}` : ''}\n${journey.stops.map((stop) => `  ${stop.name}${stop.proposed ? ' (a proposed site, placed roughly)' : ''}: ${stop.refTitle}${stop.by ? `, by ${stop.by}` : ''}${stop.reading ? ', the usual reading' : ''}`).join('\n')}`,
        )
        .join('\n\n')}\n\nRoutes written by hand from the text; places: Theographic (CC BY-SA).`;
    },
  },

  passage_guide: {
    description:
      "Everything the app has on one passage: its parallel passages (such as Kings and Chronicles, the Synoptic Gospels), the Old Testament it quotes or the New Testament that quotes it, its cross-references joined over its verses, and the people, places, groups and dated events it names.",
    inputSchema: {
      type: 'object',
      properties: { reference: { type: 'string', description: 'A passage, such as Mark 2:1-12 or MRK.2.1-12.' } },
      required: ['reference'],
    },
    async run({ reference }) {
      const ref = refOf(reference);
      const { guide, summary } = await guideResults(toAddress(ref));
      if (!guide) return summary;
      const list = (/** @type {{ id: string, name: string }[]} */ items) => items.map((item) => `${item.name} (${item.id})`).join(', ');
      return [
        summary,
        guide.parallels.length ? `Parallel passages:\n${lines(guide.parallels)}` : 'Parallel passages: none found.',
        guide.quotations.length ? `${guide.quotationHeading}:\n${lines(guide.quotations)}` : '',
        `Cross-references (${guide.referenceSummary}):\n${lines(guide.references)}`,
        guide.people.length ? `People: ${list(guide.people)}` : '',
        guide.places.length ? `Places: ${list(guide.places)}` : '',
        guide.groups.length ? `Groups: ${list(guide.groups)}` : '',
        guide.events.length ? `Events: ${guide.events.map((event) => `${event.title}, ${event.label} (${event.id})`).join('; ')}` : '',
        guide.credit,
      ]
        .filter(Boolean)
        .join('\n\n');
    },
  },
};

/**
 * Answers one request.
 *
 * @param {{ method: string, params?: any }} message
 */
async function answer(message) {
  const { method, params } = message;
  if (method === 'initialize') {
    const asked = params?.protocolVersion;
    return {
      protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'bible-table', title: 'The Bible table', version: '0.1.0' },
      instructions:
        "This server answers from the Bible table app's own data: the KJV and BSB, the Hebrew and Greek with grammar (STEPBible), Strong's dictionary, cross-references (OpenBible.info), people, places and events (Theographic, dated by Jones), journeys, and the Old Testament quoted in the New (Nestle 1904). Cite the addresses it gives (JHN.3.16). Dates are Jones's chronology unless a tool names another.",
    };
  }
  if (method === 'ping') return {};
  if (method === 'tools/list') {
    return { tools: Object.entries(TOOLS).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema })) };
  }
  if (method === 'tools/call') {
    const tool = TOOLS[params?.name];
    if (!tool) throw Object.assign(new Error(`No tool is named ${params?.name}.`), { code: -32602 });
    try {
      let text = await tool.run(params.arguments ?? {});
      if (text.length > MAX_TEXT) text = `${text.slice(0, MAX_TEXT)}\n\n(Cut at ${MAX_TEXT} characters: ask for less.)`;
      return { content: [{ type: 'text', text }], isError: false };
    } catch (error) {
      return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true };
    }
  }
  throw Object.assign(new Error(`No method ${method}.`), { code: -32601 });
}

/** @param {object} message */
const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end).trim();
    buffer = buffer.slice(end + 1);
    if (!line) continue;
    /** @type {any} */
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    // A notification (no id) needs no answer.
    if (message.id === undefined || message.id === null) continue;
    answer(message).then(
      (result) => send({ jsonrpc: '2.0', id: message.id, result }),
      (error) => send({ jsonrpc: '2.0', id: message.id, error: { code: error.code ?? -32603, message: error.message } }),
    );
  }
});
process.stdin.on('end', () => process.exit(0));
