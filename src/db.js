const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DEFAULT_DB_PATH = path.join(dataDir, 'deals.db');

function createDb(dbPath = DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_key TEXT NOT NULL,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      product_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id),
      name TEXT NOT NULL,
      url TEXT,
      image_url TEXT,
      original_price REAL,
      sale_price REAL,
      discount_pct REAL
    );

    CREATE TABLE IF NOT EXISTS changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_key TEXT NOT NULL,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      change_type TEXT NOT NULL CHECK(change_type IN ('new', 'price_drop', 'price_increase', 'removed')),
      product_name TEXT NOT NULL,
      product_url TEXT,
      old_price REAL,
      new_price REAL,
      price_diff REAL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshots_site ON snapshots(site_key, scraped_at);
    CREATE INDEX IF NOT EXISTS idx_products_snapshot ON products(snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_changes_site ON changes(site_key, detected_at);

    CREATE TABLE IF NOT EXISTS site_urls (
      site_key TEXT PRIMARY KEY,
      url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_params (
      site_key TEXT PRIMARY KEY,
      params TEXT NOT NULL
    );
  `);

  return db;
}

function saveSnapshot(db, siteKey, products) {
  const insertSnapshot = db.prepare(
    'INSERT INTO snapshots (site_key, product_count) VALUES (?, ?)'
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (snapshot_id, name, url, image_url, original_price, sale_price, discount_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const txn = db.transaction((siteKey, products) => {
    const { lastInsertRowid } = insertSnapshot.run(siteKey, products.length);
    const snapshotId = Number(lastInsertRowid);

    for (const p of products) {
      insertProduct.run(
        snapshotId,
        p.name,
        p.url ?? null,
        p.imageUrl ?? null,
        p.originalPrice ?? null,
        p.salePrice ?? null,
        p.discountPct ?? null
      );
    }

    return snapshotId;
  });

  return txn(siteKey, products);
}

function withProducts(db, snapshot) {
  if (!snapshot) return null;
  const products = db.prepare(
    'SELECT * FROM products WHERE snapshot_id = ?'
  ).all(snapshot.id);
  return { ...snapshot, products };
}

function getLatestSnapshot(db, siteKey) {
  const snapshot = db.prepare(
    'SELECT * FROM snapshots WHERE site_key = ? ORDER BY scraped_at DESC LIMIT 1'
  ).get(siteKey);
  return withProducts(db, snapshot);
}

function getPreviousSnapshot(db, siteKey, beforeSnapshotId) {
  const snapshot = db.prepare(
    'SELECT * FROM snapshots WHERE site_key = ? AND id < ? ORDER BY id DESC LIMIT 1'
  ).get(siteKey, beforeSnapshotId);
  return withProducts(db, snapshot);
}

function saveChanges(db, siteKey, changes) {
  const insert = db.prepare(
    `INSERT INTO changes (site_key, change_type, product_name, product_url, old_price, new_price, price_diff)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const txn = db.transaction((changes) => {
    for (const c of changes) {
      insert.run(
        siteKey,
        c.changeType,
        c.productName,
        c.productUrl ?? null,
        c.oldPrice ?? null,
        c.newPrice ?? null,
        c.priceDiff ?? null
      );
    }
  });

  txn(changes);
}

function getChanges(db, { siteKey, days = 7, changeType, limit = 100 } = {}) {
  let sql = 'SELECT * FROM changes WHERE 1=1';
  const params = [];

  if (siteKey) {
    sql += ' AND site_key = ?';
    params.push(siteKey);
  }

  if (days) {
    sql += " AND detected_at >= datetime('now', ?)";
    params.push(`-${days} days`);
  }

  if (changeType) {
    sql += ' AND change_type = ?';
    params.push(changeType);
  }

  sql += ' ORDER BY detected_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function getSiteSummaries(db) {
  return db.prepare(`
    SELECT
      s.site_key,
      s.scraped_at,
      s.product_count,
      (SELECT COUNT(*) FROM changes c
       WHERE c.site_key = s.site_key
       AND c.detected_at >= datetime('now', '-1 day')
       AND c.change_type = 'new') as new_count,
      (SELECT COUNT(*) FROM changes c
       WHERE c.site_key = s.site_key
       AND c.detected_at >= datetime('now', '-1 day')
       AND c.change_type = 'price_drop') as price_drop_count,
      (SELECT COUNT(*) FROM changes c
       WHERE c.site_key = s.site_key
       AND c.detected_at >= datetime('now', '-1 day')
       AND c.change_type = 'price_increase') as price_increase_count
    FROM snapshots s
    INNER JOIN (
      SELECT site_key, MAX(id) as max_id
      FROM snapshots GROUP BY site_key
    ) latest ON s.id = latest.max_id
  `).all();
}

function getProducts(db, siteKey) {
  const snapshot = getLatestSnapshot(db, siteKey);
  return snapshot ? snapshot.products : [];
}

function getAllProducts(db) {
  return db.prepare(`
    SELECT p.*, s.site_key
    FROM products p
    JOIN snapshots s ON p.snapshot_id = s.id
    INNER JOIN (
      SELECT site_key, MAX(id) as max_id
      FROM snapshots GROUP BY site_key
    ) latest ON s.id = latest.max_id
  `).all();
}

function getProductHistory(db, productName, siteKey) {
  return db.prepare(`
    SELECT p.*, s.scraped_at, s.site_key
    FROM products p
    JOIN snapshots s ON p.snapshot_id = s.id
    WHERE p.name = ? AND s.site_key = ?
    ORDER BY s.scraped_at ASC
  `).all(productName, siteKey);
}

function getSiteUrl(db, siteKey) {
  const row = db.prepare('SELECT url FROM site_urls WHERE site_key = ?').get(siteKey);
  return row ? row.url : null;
}

function setSiteUrl(db, siteKey, url) {
  db.prepare(
    'INSERT INTO site_urls (site_key, url) VALUES (?, ?) ON CONFLICT(site_key) DO UPDATE SET url = excluded.url'
  ).run(siteKey, url);
}

function deleteSiteUrl(db, siteKey) {
  db.prepare('DELETE FROM site_urls WHERE site_key = ?').run(siteKey);
}

function getSiteParams(db, siteKey) {
  const row = db.prepare('SELECT params FROM site_params WHERE site_key = ?').get(siteKey);
  return row ? row.params : null;
}

function setSiteParams(db, siteKey, params) {
  db.prepare(
    'INSERT INTO site_params (site_key, params) VALUES (?, ?) ON CONFLICT(site_key) DO UPDATE SET params = excluded.params'
  ).run(siteKey, params);
}

function deleteSiteParams(db, siteKey) {
  db.prepare('DELETE FROM site_params WHERE site_key = ?').run(siteKey);
}

module.exports = {
  createDb,
  saveSnapshot,
  getLatestSnapshot,
  getPreviousSnapshot,
  saveChanges,
  getChanges,
  getSiteSummaries,
  getProducts,
  getAllProducts,
  getProductHistory,
  getSiteUrl,
  setSiteUrl,
  deleteSiteUrl,
  getSiteParams,
  setSiteParams,
  deleteSiteParams,
};
