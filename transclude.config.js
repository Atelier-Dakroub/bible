// Every path the framework needs is here, relative to `appDir` unless it says
// otherwise. `npx transclude-check` reads this too.
//
// The keys left out have defaults, and the defaults are the quiet ones: no
// proxy, no feed, no sitemap, no service worker list, no script on any page.
// See the configuration page in the docs for the whole list.

import { guidePage } from './app/lib/markdown.js';

export default {
  appDir: 'app',
  routesDir: 'routes',
  elementsDir: 'elements',
  stylesheet: 'app/styles/global.css',

  // Dev and production both listen here, so this app has one port. `PORT` in the
  // environment wins.
  port: 1960,

  // `never` redirects /about/ to /about with a 301, so a page has one URL.
  trailingSlash: 'never',

  // The language every page is written in, on `<html>`. A screen reader picks a
  // voice from it and a browser picks a dictionary, so a wrong one is worse than
  // a missing one. Change it here, or per page with `<html lang="cy">`.
  lang: 'en',

  // A Content-Security-Policy built from the hashes of what each page inlines.
  // Nothing here needs a CDN, so scripts are `self` and a script somebody
  // injects has nowhere to come from. The videos (data/videos.js) open it a
  // little, for media only: YouTube's privacy-enhanced frame (BibleProject),
  // the JESUS film's streams at Mux (read by hls.js where the browser does
  // not play them itself), and both posters. No other site's script
  // runs on a page: the player drives YouTube's frame by message.
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'hashes'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https://i.ytimg.com', 'https://imagedelivery.net'],
      // blob: is hls.js's, which hands the video its stream as a MediaSource.
      'media-src': ["'self'", 'blob:', 'https://stream.mux.com', 'https://*.mux.com'],
      'connect-src': ["'self'", 'https://stream.mux.com', 'https://*.mux.com'],
      'frame-src': ['https://www.youtube-nocookie.com'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'self'"],
    },
  },

  // The features these pages refuse: cameras, sensors, location, and the rest of
  // what a document never asks for. Take one out when a page wants it.
  permissionsPolicy: true,

  // Signs cookies, which is what makes one usable as a session. Read it from the
  // environment: this file is yours, so where the secret lives is your decision.
  cookieSecret: globalThis.process?.env?.COOKIE_SECRET ?? null,

  // Cards arrive on the table as fragments, and a card is a custom element.
  // This defines and styles an element that a fetched fragment brings in.
  watchElements: true,

  // The guide's pages are Markdown (app/routes/guide/*.md): this turns each
  // into a page, with its title and the way back (lib/markdown.js).
  markdown: guidePage,

  // /precache.json: every prerendered page, hashed asset and public file,
  // each with what says it changed. The service worker (public/sw.js) reads it
  // to keep the table, its code, fonts, icons and map for use offline.
  precache: true,

  outDir: 'dist',
  typesFile: 'app/transclude-env.d.ts',
};
