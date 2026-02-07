/**
 * IP lookup wrapper – currently ipregistry.co. Replace this module to switch providers.
 * Uses in-memory cache (24h per IP) to reduce API calls and respect quota.
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map(); // ip -> { data, expires }

function getFromCache(ip) {
  const entry = cache.get(ip);
  if (!entry || Date.now() > entry.expires) return null;
  return entry.data;
}

function setCache(ip, data) {
  cache.set(ip, { data, expires: Date.now() + CACHE_TTL_MS });
}

/**
 * Normalize ipregistry response into a single object for DB and middleware.
 */
function normalizeResult(ip, body) {
  const s = body.security || {};
  const loc = body.location || {};
  const conn = body.connection || {};
  const dev = body.user_agent?.device || {};
  return {
    ip,
    is_proxy: s.is_proxy === true ? 1 : 0,
    is_vpn: s.is_vpn === true ? 1 : 0,
    is_tor: s.is_tor === true ? 1 : 0,
    is_datacenter: (conn.type === 'hosting' || s.is_cloud_provider === true) ? 1 : 0,
    is_bot: (body.user_agent?.is_bot === true) ? 1 : 0,
    threat_level: s.is_threat ? 'threat' : s.is_abuser ? 'abuser' : s.is_attacker ? 'attacker' : null,
    country: loc.country?.code || null,
    device_type: dev.type || body.user_agent?.name || null,
  };
}

/**
 * Look up IP using ipregistry.co. Returns normalized result or throws.
 * @param {string} ip - IPv4 or IPv6
 * @param {string} apiKey - ipregistry API key
 * @returns {Promise<{ result: object, creditsConsumed?: number, creditsRemaining?: number }>}
 */
async function lookup(ip, apiKey) {
  if (!ip) throw new Error('IP is required');
  const cached = getFromCache(ip);
  if (cached) return { result: cached };

  const key = apiKey || process.env.IPREGISTRY_API_KEY || '';
  if (!key) throw new Error('ipregistry API key not set');

  const url = `https://api.ipregistry.co/${ip}?key=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    const err = new Error(body.message || body.error?.message || `IP lookup failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const result = normalizeResult(ip, body);
  setCache(ip, result);

  const creditsConsumed = res.headers.get('Ipregistry-Credits-Consumed') ? parseInt(res.headers.get('Ipregistry-Credits-Consumed'), 10) : null;
  const creditsRemaining = res.headers.get('Ipregistry-Credits-Remaining') ? parseInt(res.headers.get('Ipregistry-Credits-Remaining'), 10) : null;
  return { result, creditsConsumed, creditsRemaining };
}

/**
 * Test connectivity and quota for the given API key (optional IP for a real lookup).
 * @param {string} apiKey
 * @param {string} [testIp] - e.g. '8.8.8.8'
 */
async function testApiKey(apiKey, testIp = '8.8.8.8') {
  const { result, creditsConsumed, creditsRemaining } = await lookup(testIp, apiKey);
  return { ok: true, result, creditsConsumed, creditsRemaining };
}

module.exports = { lookup, testApiKey, getFromCache, setCache, normalizeResult };
