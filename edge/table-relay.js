// The table relay on Cloudflare (app/lib/relay.js): one Durable Object, named
// "table", that holds the stream of each open table, so that a command sent
// to one Worker reaches a table connected through another. app/server.js
// checks who sends a request before it comes here.

import { DurableObject } from 'cloudflare:workers';
import { createRelay } from '../app/lib/relay.js';

export class TableRelay extends DurableObject {
  relay = createRelay();

  /** @param {Request} request */
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/table/events') return this.relay.events(request.signal);
    if (pathname === '/api/table/command' && request.method === 'POST') return this.relay.command(request);
    if (pathname === '/api/table/reply' && request.method === 'POST') return this.relay.reply(request);
    return new Response('Not found', { status: 404 });
  }
}
