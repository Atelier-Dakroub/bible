// The app's own middleware (Transclude hands it the Hono app).
//
// The table relay: an assistant's tools (tools/mcp-server.js) send commands
// to the tables that are open, such as "put Romans 4 on the table" or "show
// Abraham's journey", and the first table to answer replies.
//
//   GET  /api/table/events   a stream each open table listens on (bible-table)
//   POST /api/table/command  a command, as JSON; the answer is the table's reply
//   POST /api/table/reply    a table's reply to a command, by its id
//
// And the recordings (data/audio.js): GET /audio/GEN.1.m4a (LibriVox's KJV)
// and /audio/<voice>/<version>/GEN.1.m4a (the app's own voice).
//
// A command must carry the secret in TABLE_TOKEN (the project's .env, which
// npm run dev reads, and so does the MCP server): the server listens on the
// network, so the panel can reach it, and a command changes the table. With
// no secret set, no command is taken and no table can listen. Each table's
// stream has its own random key, sent only with the commands on that stream;
// a reply counts only with the key of a stream its command went to, so no one
// who is not listening can answer a command.
// The relay lives in this process, so it works where the app runs under
// Node (npm run dev, npm start). Under Workers it is not mounted: a table
// finds no stream there and stops listening.

import { streamSSE } from 'hono/streaming';
import { chapterFile } from './data/audio.js';

/** @typedef {import('hono/streaming').SSEStreamingApi} Stream */

/** @type {Map<Stream, string>} the tables listening, each with its stream's key */
const tables = new Map();
/** @type {Map<string, { resolve: (reply: object) => void, keys: Set<string> }>} commands waiting for a reply, by id, with the keys of the streams they went to */
const waiting = new Map();
const REPLY_MS = 10000;
/** The most tables that may listen at once: a panel, a laptop, a phone or two. */
const MOST_TABLES = 12;
/** Whether this is Node, where the relay can keep its streams. */
const NODE = Boolean(globalThis.process?.versions?.node);

const TOKEN = globalThis.process?.env?.TABLE_TOKEN ?? '';

/**
 * True when the request carries the secret.
 *
 * @param {import('hono').Context} c
 */
function allowed(c) {
  const given = new TextEncoder().encode(c.req.header('authorization') ?? '');
  const wanted = new TextEncoder().encode(`Bearer ${TOKEN}`);
  if (!TOKEN || given.length !== wanted.length) return false;
  // The same time for any wrong secret of the right length.
  let differ = 0;
  for (let at = 0; at < given.length; at += 1) differ |= given[at] ^ wanted[at];
  return differ === 0;
}

/** @param {import('hono').Hono} app */
export default (app) => {
  // The KJV's recording, a chapter to a file (data/audio.js), with byte
  // ranges so a player can begin at a verse.
  app.get('/audio/:file', (c) => chapterFile('', c.req.param('file'), c.req.header('range')));
  app.get('/audio/:voice/:version/:file', (c) => chapterFile(`${c.req.param('voice')}/${c.req.param('version')}`, c.req.param('file'), c.req.header('range')));

  if (!NODE) return;

  app.get('/api/table/events', (c) => {
    if (!TOKEN) return c.json({ ok: false, error: 'The table takes no commands: TABLE_TOKEN is not set in .env.' }, 503);
    if (tables.size >= MOST_TABLES) return c.json({ ok: false, error: 'Too many tables are listening.' }, 429);
    return streamSSE(c, async (stream) => {
      tables.set(stream, crypto.randomUUID());
      stream.onAbort(() => tables.delete(stream));
      await stream.writeSSE({ event: 'ready', data: '' });
      // A comment now and then, so the connection is not closed as idle.
      while (!stream.aborted) {
        await stream.sleep(20000);
        if (!stream.aborted) await stream.write(': still here\n\n');
      }
      tables.delete(stream);
    });
  });

  app.post('/api/table/command', async (c) => {
    if (!TOKEN) return c.json({ ok: false, error: 'The table takes no commands: TABLE_TOKEN is not set in .env.' }, 503);
    if (!allowed(c)) return c.json({ ok: false, error: 'A command needs the secret in TABLE_TOKEN.' }, 403);
    /** @type {any} */
    let command;
    try {
      command = await c.req.json();
    } catch {
      return c.json({ ok: false, error: 'A command is JSON.' }, 400);
    }
    if (!tables.size) return c.json({ ok: false, error: 'No table is open. Open /table in a browser first.' }, 409);
    const id = crypto.randomUUID();
    const keys = new Set(tables.values());
    const reply = new Promise((resolve) => {
      waiting.set(id, { resolve, keys });
      setTimeout(() => {
        if (waiting.delete(id)) resolve({ ok: false, error: 'The table did not answer in time.' });
      }, REPLY_MS);
    });
    await Promise.all(
      [...tables].map(([stream, key]) =>
        stream.writeSSE({ event: 'command', data: JSON.stringify({ ...command, id, key }) }).catch(() => tables.delete(stream)),
      ),
    );
    return c.json(await reply);
  });

  app.post('/api/table/reply', async (c) => {
    /** @type {any} */
    let reply;
    try {
      reply = await c.req.json();
    } catch {
      return c.json({ ok: false }, 400);
    }
    const pending = waiting.get(String(reply?.id ?? ''));
    // Only a table the command went to knows the key of its stream.
    if (!pending || !pending.keys.has(String(reply?.key ?? ''))) return c.json({ ok: false }, 404);
    waiting.delete(reply.id);
    const { key, ...answer } = reply;
    pending.resolve(answer);
    return c.json({ ok: true });
  });
};
