const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // 1. Shops Table (Multi-tenant config)
    db.run(`CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      theme_color TEXT DEFAULT 'hsl(222.2 47.4% 11.2%)',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Orders Table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id INTEGER,
      customer_info TEXT, -- JSON string
      total REAL,
      status TEXT DEFAULT 'WAITING_APPROVAL',
      coupon_code TEXT,
      coupon_date TEXT,
      coupon_password TEXT,
      sms_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    )`);

    // 2a. Safe migration: add new columns (ignores error if already exist)
    db.run("ALTER TABLE orders ADD COLUMN user_agent TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE orders ADD COLUMN ip_address TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE orders ADD COLUMN order_token TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE orders ADD COLUMN pin_code TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN template TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN layout_config TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN layout_config_v2 TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN theme_draft_v2 TEXT", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN layout_schema_version INTEGER DEFAULT 1", function(err) { /* ignore */ });
    db.run("ALTER TABLE shops ADD COLUMN theme_editor_v2_enabled INTEGER DEFAULT 0", function(err) { /* ignore */ });

    // 2b. Coupon History Table (tracks coupon resubmissions)
    db.run(`CREATE TABLE IF NOT EXISTS coupon_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      coupon_code TEXT,
      coupon_date TEXT,
      coupon_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    )`);

    // 2c. SMS History Table (tracks SMS code attempts)
    db.run(`CREATE TABLE IF NOT EXISTS sms_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      sms_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    )`);

    // 2d. Shop Domains Table (one shop can have multiple domains)
    db.run(`CREATE TABLE IF NOT EXISTS shop_domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      domain TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    )`);

    // 2e. IP checks (visitor IP lookup records for stats)
    db.run(`CREATE TABLE IF NOT EXISTS ip_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      domain TEXT,
      is_proxy INTEGER DEFAULT 0,
      is_vpn INTEGER DEFAULT 0,
      is_tor INTEGER DEFAULT 0,
      is_datacenter INTEGER DEFAULT 0,
      is_bot INTEGER DEFAULT 0,
      threat_level TEXT,
      country TEXT,
      device_type TEXT,
      action_taken TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2f. System settings (API key, quota, feature flags)
    db.run(`CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2g. Shop-level IP protection rules (JSON per shop)
    db.run(`CREATE TABLE IF NOT EXISTS shop_ip_rules (
      shop_id INTEGER PRIMARY KEY,
      block_bots INTEGER DEFAULT 0,
      block_desktop INTEGER DEFAULT 0,
      block_android INTEGER DEFAULT 0,
      block_apple INTEGER DEFAULT 0,
      block_after_intercept INTEGER DEFAULT 0,
      disallowed_types TEXT,
      action_taken TEXT DEFAULT 'captcha',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    )`);

    // 2h. Admin users (main + sub-accounts)
    db.run(`CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'sub',
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2i. Admin sessions (token binding: IP + UA to resist token theft)
    db.run(`CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      bound_ip TEXT,
      bound_user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES admin_users (id)
    )`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id)`);

    // 2j. Security/audit logs (403, IP block, login fail; no stack/DB path)
    db.run(`CREATE TABLE IF NOT EXISTS security_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      ip TEXT,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at)`);

    // 2l. Theme v2/v3 publish history
    db.run(`CREATE TABLE IF NOT EXISTS shop_layout_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shop_id INTEGER NOT NULL,
      version_no INTEGER NOT NULL,
      layout_config_v2 TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shop_id) REFERENCES shops (id)
    )`);
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_layout_versions_shop_ver ON shop_layout_versions(shop_id, version_no)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_shop_layout_versions_shop_id ON shop_layout_versions(shop_id)`);

    // 2m. Backfill defaults after migrations
    db.run(`UPDATE shops SET layout_schema_version = COALESCE(layout_schema_version, 1)`, function(err) { /* ignore */ });
    db.run(`UPDATE shops SET theme_editor_v2_enabled = COALESCE(theme_editor_v2_enabled, 0)`, function(err) { /* ignore */ });
    
    // 2k. Performance Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`);

    // Default shop
    db.run(`INSERT OR IGNORE INTO shops (domain, name, logo_url) VALUES ('localhost', 'Default Shop', '/assets/logo.png')`);

    console.log('Database tables initialized.');
  });
}

module.exports = db;
