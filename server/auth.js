const crypto = require('crypto');
const db = require('./db');

// Configurable iterations (env PBKDF2_ITERATIONS, default 300000 for 2026)
const PBKDF2_ITERATIONS = Math.max(100000, parseInt(process.env.PBKDF2_ITERATIONS, 10) || 300000);
const TOKEN_BYTES = 32;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Panel IDs for permission check (sub-accounts)
const ADMIN_PANELS = ['dashboard', 'data', 'shops', 'ipstats', 'system', 'accounts', 'logs'];

function sanitizePanels(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const p of arr) {
    const s = typeof p === 'string' ? p.trim().toLowerCase() : '';
    if (s && ADMIN_PANELS.includes(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash: salt + ':' + hash, salt };
}

function hashPasswordAsync(password, salt) {
  return new Promise((resolve, reject) => {
    salt = salt || crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve({ hash: salt + ':' + derivedKey.toString('hex'), salt });
    });
  });
}

function verifyPassword(password, stored) {
  if (!password || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts;
  const { hash: computedFull } = hashPassword(password, salt);
  const computedDigest = computedFull.split(':')[1];
  if (!computedDigest || storedHash.length !== computedDigest.length) return false;
  try {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(computedDigest, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

async function verifyPasswordAsync(password, stored) {
  if (!password || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, storedHash] = parts;
  
  try {
    const { hash: computedFull } = await hashPasswordAsync(password, salt);
    const computedDigest = computedFull.split(':')[1];
    if (!computedDigest || storedHash.length !== computedDigest.length) return false;
    
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(computedDigest, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function createSession(userId, ip, userAgent, cb) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.run(
    'INSERT INTO admin_sessions (user_id, token_hash, bound_ip, bound_user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
    [userId, tokenHash, ip || null, userAgent || null, expiresAt],
    function (err) {
      if (err) return cb(err);
      cb(null, token, expiresAt);
    }
  );
}

function verifySession(token, ip, userAgent, cb) {
  if (!token || typeof token !== 'string') return cb(null, null);
  const tokenHash = hashToken(token.trim());
  db.get(
    'SELECT s.id as session_id, s.user_id, s.bound_ip, s.bound_user_agent, u.username, u.role, u.permissions FROM admin_sessions s JOIN admin_users u ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > datetime("now")',
    [tokenHash],
    (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(null, null);
      if (row.bound_ip && ip && row.bound_ip !== ip) return cb(null, null);
      if (row.bound_user_agent && userAgent && row.bound_user_agent !== userAgent) return cb(null, null);
      let permissions = null;
      if (row.permissions) {
        try {
          const p = JSON.parse(row.permissions);
          permissions = Array.isArray(p) ? p : null;
        } catch (_) { /* invalid JSON -> no panels */ }
      }
      cb(null, { userId: row.user_id, username: row.username, role: row.role, permissions });
    }
  );
}

function revokeSession(token, cb) {
  if (!token) return cb();
  const tokenHash = hashToken(token.trim());
  db.run('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash], cb);
}

// Sanitize: no token/password; strip control chars and newlines to prevent log injection
function logSecurity(kind, ip, detail, cb) {
  const raw = typeof detail === 'string' ? detail : '';
  const safe = raw.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
  db.run('INSERT INTO security_logs (kind, ip, detail) VALUES (?, ?, ?)', [kind, ip || null, safe], cb || (() => {}));
}

module.exports = {
  ADMIN_PANELS,
  sanitizePanels,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
  hashToken,
  generateToken,
  createSession,
  verifySession,
  revokeSession,
  logSecurity,
  SESSION_TTL_MS,
};
