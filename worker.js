// Cloudflare Workers entry. `npm run deploy` sends it.
//
// This file belongs to the app, because every import in it names something the
// app owns, and a bundler needs a literal path to follow. The wiring behind
// `workerFrom` does not, which is why it lives in the framework.
//
// The worker carries the pages only (dist/server/pages.js). The edge serves
// dist/edge before the worker runs: the public files, the hashed assets, and
// the data files under data/ (wrangler.jsonc). The data is read through the
// ASSETS binding, so each request hands the env to app/data/load.js first.
//
// Deploying somewhere else? Delete this and `wrangler.jsonc`. `npm start`
// serves the same build on Node, Bun and Deno.

import { workerFrom } from '@transclude/core/worker';
import * as bundle from './dist/server/pages.js';
import * as entry from './dist/server/entry.js';
import manifest from './dist/routes.json';
import config from './transclude.config.js';
import { hold } from './app/data/load.js';
import { overLimit } from './app/lib/rate-limit.js';

const worker = workerFrom({ config, manifest, entry, bundle });

/** Test pages for a touch panel and a screen, for a copy run locally only. */
const TEST_PAGES = new Set(['/touch', '/viewport']);

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> }, LIMITER?: import('./app/lib/rate-limit.js').Limiter }} env
   * @param {unknown} ctx
   */
  async fetch(request, env, ctx) {
    hold(env);
    // Each address has a share of the site (lib/rate-limit.js). The files
    // the edge serves (wrangler.jsonc "assets") never reach this.
    const refused = await overLimit(request, env.LIMITER);
    if (refused) return refused;
    const url = new URL(request.url);
    // The app's own 404 page: a path that no route has.
    if (TEST_PAGES.has(url.pathname)) return worker.fetch(new Request(new URL('/-/not-here', url), request), env, /** @type {any} */ (ctx));
    return worker.fetch(request, env, /** @type {any} */ (ctx));
  },
};
