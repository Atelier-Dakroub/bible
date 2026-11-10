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
// A command must carry the secret in TABLE_TOKEN (the project's .env, which
// npm run dev reads, and so does the MCP server): the server listens on the
// network, so the panel can reach it, and a command changes the table. With
// no secret set, no command is taken. The replies carry the id of a command
// that is waiting, which no one else can guess.
// The relay lives in this process, so it works where the app runs under
// Node (npm run dev, npm start); on Cloudflare a table finds no stream and
// stops listening.

import { streamSSE } from 'hono/streaming';

/** @typedef {import('hono/streaming').SSEStreamingApi} Stream */

/** @type {Set<Stream>} the tables listening */
const tables = new Set();
/** @type {Map<string, (reply: object) => void>} commands waiting for a reply, by id */
const waiting = new Map();
const REPLY_MS = 10000;

const TOKEN = globalThis.process?.env?.TABLE_TOKEN ?? '';

/**
 * True when the request carries the secret.
 *
 * @param {import('hono').Context} c
 */
function allowed(c) {
  return Boolean(TOKEN) && c.req.header('authorization') === `Bearer ${TOKEN}`;
}

/** @param {import('hono').Hono} app */
export default (app) => {
  app.get('/api/table/events', (c) =>
    streamSSE(c, async (stream) => {
      tables.add(stream);
      stream.onAbort(() => tables.delete(stream));
      await stream.writeSSE({ event: 'ready', data: '' });
      // A comment now and then, so the connection is not closed as idle.
      while (!stream.aborted) {
        await stream.sleep(20000);
        if (!stream.aborted) await stream.write(': still here\n\n');
      }
      tables.delete(stream);
    }),
  );

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
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    const reply = new Promise((resolve) => {
      waiting.set(id, resolve);
      setTimeout(() => {
        if (waiting.delete(id)) resolve({ ok: false, error: 'The table did not answer in time.' });
      }, REPLY_MS);
    });
    const data = JSON.stringify({ ...command, id });
    await Promise.all([...tables].map((stream) => stream.writeSSE({ event: 'command', data }).catch(() => tables.delete(stream))));
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
    const resolve = waiting.get(String(reply?.id ?? ''));
    if (!resolve) return c.json({ ok: false }, 404);
    waiting.delete(reply.id);
    resolve(reply);
    return c.json({ ok: true });
  });
};
