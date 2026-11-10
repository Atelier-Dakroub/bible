// Who sends a request, on Cloudflare: Cloudflare Access signs in the reader
// before a request reaches the Worker, and sends the Worker a signed token
// (a JWT) in the Cf-Access-Jwt-Assertion header. Its signature, its audience
// and its time are checked here, so that a request that did not come through
// Access is refused even if it reaches the Worker another way.
//
// The Worker needs two settings from the Access application (wrangler.jsonc,
// "vars"):
//   ACCESS_TEAM  the team domain, such as https://dakroub.cloudflareaccess.com
//   ACCESS_AUD   the application's audience tag
// Without them, nothing that needs to know the reader is allowed.
//
// A person signs in with an email address; a program, such as the MCP server,
// signs in with a service token, and its token has the token's client id in
// place of an email.

/** @typedef {{ email: string, service: string }} Identity `email` for a person, `service` (the client id) for a service token */
/** @typedef {{ kid: string, kty: string, n: string, e: string, alg?: string }} Key */

/** @param {string} text base64url */
function bytes(text) {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/** @param {string} text base64url */
const decode = (text) => JSON.parse(new TextDecoder().decode(bytes(text)));

/**
 * The identity in a token, or null when the token is not valid.
 *
 * @param {string} token
 * @param {{ team: string, aud: string, keys: Key[], now?: number }} options
 *   `team` the team domain; `aud` the audience tag; `keys` the team's
 *   signing keys; `now` the time, in seconds
 * @returns {Promise<Identity | null>}
 */
export async function verify(token, { team, aud, keys, now = Date.now() / 1000 }) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = decode(parts[0]);
    const claims = decode(parts[1]);
    if (header.alg !== 'RS256') return null;
    const key = keys.find((each) => each.kid === header.kid);
    if (!key) return null;
    const publicKey = await crypto.subtle.importKey('jwk', { kty: key.kty, n: key.n, e: key.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes(parts[2]), signed))) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(aud)) return null;
    if (claims.iss !== team.replace(/\/+$/, '')) return null;
    if (typeof claims.exp !== 'number' || claims.exp < now) return null;
    if (typeof claims.nbf === 'number' && claims.nbf > now + 60) return null;
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    const service = !email && typeof claims.common_name === 'string' ? claims.common_name : '';
    return email || service ? { email, service } : null;
  } catch {
    return null;
  }
}

/** @type {{ team: string, at: number, keys: Key[] } | null} */
let known = null;
const KEYS_MS = 60 * 60 * 1000;

/**
 * The team's signing keys, kept for an hour. Access changes them now and
 * then, so a token with a key not seen yet asks again.
 *
 * @param {string} team
 * @param {boolean} [again]
 * @returns {Promise<Key[]>}
 */
async function keysOf(team, again = false) {
  if (!again && known && known.team === team && Date.now() - known.at < KEYS_MS) return known.keys;
  const response = await fetch(`${team.replace(/\/+$/, '')}/cdn-cgi/access/certs`);
  if (!response.ok) return known?.keys ?? [];
  const { keys = [] } = /** @type {{ keys?: Key[] }} */ (await response.json());
  known = { team, at: Date.now(), keys };
  return keys;
}

/**
 * Who sent a request through Access, or null.
 *
 * @param {Request} request
 * @param {{ ACCESS_TEAM?: string, ACCESS_AUD?: string }} env
 * @returns {Promise<Identity | null>}
 */
export async function identityOf(request, env) {
  const team = env.ACCESS_TEAM ?? '';
  const aud = env.ACCESS_AUD ?? '';
  const token = request.headers.get('cf-access-jwt-assertion') ?? '';
  if (!team || !aud || !token) return null;
  const options = { team, aud, keys: await keysOf(team) };
  const kid = (() => {
    try {
      return decode(token.split('.')[0]).kid;
    } catch {
      return '';
    }
  })();
  if (!options.keys.some((key) => key.kid === kid)) options.keys = await keysOf(team, true);
  return verify(token, options);
}
