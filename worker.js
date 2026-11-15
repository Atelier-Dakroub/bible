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

const worker = workerFrom({ config, manifest, entry, bundle });

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   * @param {unknown} ctx
   */
  fetch(request, env, ctx) {
    hold(env);
    return worker.fetch(request, env, /** @type {any} */ (ctx));
  },
};
