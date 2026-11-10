// Cloudflare Workers entry. `npm run deploy` builds the app, prepares the
// build for Cloudflare (tools/build-edge.js) and sends it.
//
// Not Transclude's `workerFrom`: that puts every byte the app serves into the
// Worker, and this app's are too many. Here the prerendered pages, the public
// files, the built scripts and the data are the Worker's static assets
// (dist/edge/assets), which Cloudflare serves before the Worker runs, and the
// Worker renders the rest: the cards, the search panel and the endpoints.
//
// The data (app/data/store.js) is read through the assets binding, and the
// two Durable Objects are the table relay and each reader's workspaces
// (app/server.js).

import { createApp } from '@transclude/core/app';
import { hash, pageEntry } from '@transclude/core/worker';
import * as entry from './dist/server/entry.js';
import * as pages from './dist/edge/pages.js';
import manifest from './dist/routes.json';
import config from './transclude.config.js';

export { TableRelay } from './edge/table-relay.js';
export { Workspaces } from './edge/workspaces.js';

/** Nothing is served from the Worker's own bytes. */
const none = { get: () => null };

/** @type {{ fetch: (request: Request, env: any, ctx: any) => Response | Promise<Response> } | null} */
let app = null;

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> }, COOKIE_SECRET?: string }} env
   * @param {any} ctx
   */
  fetch(request, env, ctx) {
    /** @type {any} */ (globalThis).bibleAssets = env.ASSETS;
    app ??= createApp({
      config: { ...config, cookieSecret: env.COOKIE_SECRET ?? config.cookieSecret },
      // There is no JSON module type in Workers, so the manifest arrives as
      // text (wrangler.jsonc, "rules").
      manifest: typeof manifest === 'string' ? JSON.parse(manifest) : manifest,
      pages: entry.pages,
      endpoints: entry.endpoints,
      middleware: entry.middleware,
      statics: none,
      assets: none,
      publicFiles: null,
      notFound: pageEntry(pages.notFound),
      errorPage: pageEntry(pages.errorPage),
      hash,
      // The edge compresses.
      compress: null,
      precache: pages.precache,
    });
    return app.fetch(request, env, ctx);
  },
};
