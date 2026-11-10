// The app's own middleware (Transclude hands it the Hono app).
//
// The table relay (lib/relay.js): an assistant's tools (tools/mcp-server.js)
// send commands to the tables that are open.
//
//   GET  /api/table/events   a stream each open table listens on (bible-table)
//   POST /api/table/command  a command, as JSON; the answer is the table's reply
//   POST /api/table/reply    a table's reply to a command, by its id
//
// And on Cloudflare, the named workspaces kept for each reader (lib/sync.js):
//
//   POST /api/sync           this device's named workspaces; the answer is the
//                            set the server keeps
//
// A command must carry the secret in TABLE_TOKEN: a command changes the
// table. With no secret set, no command is taken. A reply carries the id of
// a command that is waiting, which no one else can guess.
//
// Under Node (npm run dev, npm start) the relay lives in this process, and
// the secret is in the project's .env. The server listens on the network, so
// the panel can reach it. There is no copy of the workspaces.
//
// On Cloudflare (worker.js) a Worker keeps nothing between requests, so the
// relay is a Durable Object (edge/table-relay.js), and so is each reader's
// set of workspaces (edge/workspaces.js). Cloudflare Access signs in every
// request first, and lib/access.js checks its token: a reader must be signed
// in for everything here, and a command must also carry TABLE_TOKEN (a
// Worker secret). The MCP server signs in with an Access service token.

import { identityOf } from './lib/access.js';
import { createRelay, json } from './lib/relay.js';

/** @typedef {import('hono').Context} Context */
/**
 * The Worker's bindings (wrangler.jsonc).
 *
 * @typedef {{
 *   TABLE_RELAY?: { idFromName: (name: string) => any, get: (id: any) => { fetch: (request: Request) => Promise<Response> } },
 *   WORKSPACES?: { idFromName: (name: string) => any, get: (id: any) => { exchange: (entries: object) => Promise<object> } },
 *   TABLE_TOKEN?: string, ACCESS_TEAM?: string, ACCESS_AUD?: string,
 * }} Env
 */

/** @type {ReturnType<typeof createRelay> | null} the relay, under Node */
let local = null;

/** @param {Context} c @returns {Env} */
const envOf = (c) => /** @type {Env} */ (c.env ?? {});

/** @param {Context} c */
const onCloudflare = (c) => Boolean(envOf(c).TABLE_RELAY);

/** @param {Context} c */
function tokenOf(c) {
  return onCloudflare(c) ? (envOf(c).TABLE_TOKEN ?? '') : (globalThis.process?.env?.TABLE_TOKEN ?? '');
}

/**
 * On Cloudflare, the reader that Access signed in; under Node, everyone on
 * the network, as before.
 *
 * @param {Context} c
 */
async function signedIn(c) {
  if (!onCloudflare(c)) return { email: '', service: '' };
  return identityOf(c.req.raw, envOf(c));
}

/**
 * The relay's answer to a request: the Durable Object's on Cloudflare, this
 * process's under Node.
 *
 * @param {Context} c
 * @param {'events' | 'command' | 'reply'} what
 */
function relay(c, what) {
  const env = envOf(c);
  if (env.TABLE_RELAY) {
    const stub = env.TABLE_RELAY.get(env.TABLE_RELAY.idFromName('table'));
    return stub.fetch(c.req.raw);
  }
  local ??= createRelay();
  if (what === 'events') return local.events(c.req.raw.signal);
  return what === 'command' ? local.command(c.req.raw) : local.reply(c.req.raw);
}

const NOT_SIGNED_IN = 'Sign in through Cloudflare Access first.';

/** @param {import('hono').Hono} app */
export default (app) => {
  app.get('/api/table/events', async (c) => {
    if (!(await signedIn(c))) return json({ ok: false, error: NOT_SIGNED_IN }, 401);
    return relay(c, 'events');
  });

  app.post('/api/table/command', async (c) => {
    const token = tokenOf(c);
    if (!token) return json({ ok: false, error: 'The table takes no commands: TABLE_TOKEN is not set.' }, 503);
    if (!(await signedIn(c))) return json({ ok: false, error: NOT_SIGNED_IN }, 401);
    if (c.req.header('authorization') !== `Bearer ${token}`) return json({ ok: false, error: 'A command needs the secret in TABLE_TOKEN.' }, 403);
    return relay(c, 'command');
  });

  app.post('/api/table/reply', async (c) => {
    if (!(await signedIn(c))) return json({ ok: false, error: NOT_SIGNED_IN }, 401);
    return relay(c, 'reply');
  });

  app.post('/api/sync', async (c) => {
    const env = envOf(c);
    if (!env.WORKSPACES) return json({ ok: false, error: 'This server keeps no copy of the workspaces.' }, 404);
    const reader = await signedIn(c);
    if (!reader?.email) return json({ ok: false, error: NOT_SIGNED_IN }, 401);
    /** @type {any} */
    let body;
    try {
      body = await c.req.json();
    } catch {
      return json({ ok: false, error: 'The workspaces are JSON.' }, 400);
    }
    const sent = body?.workspaces && typeof body.workspaces === 'object' ? body.workspaces : {};
    const kept = await env.WORKSPACES.get(env.WORKSPACES.idFromName(reader.email)).exchange(sent);
    return json({ ok: true, workspaces: kept });
  });
};
