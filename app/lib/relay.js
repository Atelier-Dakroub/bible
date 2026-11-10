// The table relay: an assistant's tools (tools/mcp-server.js) send commands
// to the tables that are open, such as "put Romans 4 on the table", and the
// first table to answer replies.
//
// Each open table listens on a stream of server-sent events. A command goes
// out to every table with an id, and its answer is the reply that comes back
// with that id, or a failure after REPLY_MS.
//
// This is the relay alone, with plain Requests and Responses, so it runs in
// the same way in two places: in the Node process (app/server.js), and on
// Cloudflare in a Durable Object (edge/table-relay.js), because a Worker
// keeps nothing between requests. Who may send a command is decided before
// the relay is reached.

const REPLY_MS = 10000;
const QUIET_MS = 20000;
const encoder = new TextEncoder();

/** An id that no one can guess. */
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** @param {unknown} body @param {number} [status] */
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function createRelay() {
  /** @type {Set<ReadableStreamDefaultController<Uint8Array>>} the tables listening */
  const tables = new Set();
  /** @type {Map<string, (reply: object) => void>} commands waiting for a reply, by id */
  const waiting = new Map();

  /** @param {ReadableStreamDefaultController<Uint8Array>} table @param {string} text */
  function send(table, text) {
    try {
      table.enqueue(encoder.encode(text));
    } catch {
      tables.delete(table);
    }
  }

  return {
    /** How many tables listen. */
    get size() {
      return tables.size;
    },

    /**
     * A stream for one open table: a `ready` event, then a `command` event for
     * each command.
     *
     * @param {AbortSignal} [signal] the request's, which ends the stream
     */
    events(signal) {
      /** @type {ReadableStreamDefaultController<Uint8Array>} */
      let table;
      /** @type {ReturnType<typeof setInterval>} */
      let quiet;
      const stop = () => {
        clearInterval(quiet);
        tables.delete(table);
      };
      const body = new ReadableStream({
        start(controller) {
          table = controller;
          tables.add(table);
          send(table, 'event: ready\ndata: \n\n');
          // A comment now and then, so the connection is not closed as idle.
          quiet = setInterval(() => send(table, ': still here\n\n'), QUIET_MS);
          signal?.addEventListener('abort', () => {
            stop();
            try {
              controller.close();
            } catch {
              // Closed already.
            }
          });
        },
        cancel: stop,
      });
      return new Response(body, {
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
      });
    },

    /**
     * Sends a command to every table, and answers with the first reply.
     *
     * @param {Request} request a command, as JSON
     */
    async command(request) {
      /** @type {any} */
      let command;
      try {
        command = await request.json();
      } catch {
        return json({ ok: false, error: 'A command is JSON.' }, 400);
      }
      if (!tables.size) return json({ ok: false, error: 'No table is open. Open /table in a browser first.' }, 409);
      const id = newId();
      /** @type {Promise<object>} */
      const reply = new Promise((resolve) => {
        waiting.set(id, resolve);
        setTimeout(() => {
          if (waiting.delete(id)) resolve({ ok: false, error: 'The table did not answer in time.' });
        }, REPLY_MS);
      });
      const text = `event: command\ndata: ${JSON.stringify({ ...command, id })}\n\n`;
      for (const table of [...tables]) send(table, text);
      return json(await reply);
    },

    /**
     * A table's reply to a command, by its id.
     *
     * @param {Request} request
     */
    async reply(request) {
      /** @type {any} */
      let reply;
      try {
        reply = await request.json();
      } catch {
        return json({ ok: false }, 400);
      }
      const id = String(reply?.id ?? '');
      const resolve = waiting.get(id);
      if (!resolve) return json({ ok: false }, 404);
      waiting.delete(id);
      resolve(reply);
      return json({ ok: true });
    },
  };
}
