const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { getSiteSummaries, getChanges, getProducts, getAllProducts, getProductHistory, getSiteParams, setSiteParams, deleteSiteParams } = require('./db');
const { sites } = require('../config/sites');
const { validateParams, buildEffectiveUrl } = require('./url-utils');

function requireAuth(req, res, next) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return res.status(500).json({ error: 'ADMIN_TOKEN not configured' });

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function createServer(db, { runScrape } = {}) {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', apiLimiter);

  app.use(express.json());

  app.get('/api/sites', (req, res) => {
    const summaries = getSiteSummaries(db);
    const summaryMap = new Map(summaries.map((s) => [s.site_key, s]));

    const result = sites.map((site) => {
      const summary = summaryMap.get(site.key) || {};
      return {
        key: site.key,
        name: site.name,
        url: site.url,
        lastScrapedAt: summary.scraped_at || null,
        productCount: summary.product_count || 0,
        newCount: summary.new_count || 0,
        priceDropCount: summary.price_drop_count || 0,
        priceIncreaseCount: summary.price_increase_count || 0,
      };
    });

    res.json(result);
  });

  app.get('/api/changes', (req, res) => {
    const { site, days = '7', type, limit = '200' } = req.query;
    const parsedDays = parseInt(days, 10);
    const parsedLimit = Math.min(parseInt(limit, 10) || 200, 1000);
    if (isNaN(parsedDays) || parsedDays < 0) {
      return res.status(400).json({ error: 'Invalid days parameter' });
    }
    const changes = getChanges(db, {
      siteKey: site,
      days: parsedDays,
      changeType: type,
      limit: parsedLimit,
    });
    res.json(changes);
  });

  app.get('/api/products/all', (req, res) => {
    const products = getAllProducts(db);
    res.json(products);
  });

  app.get('/api/products', (req, res) => {
    const { site } = req.query;
    if (!site) return res.status(400).json({ error: 'site parameter required' });
    const products = getProducts(db, site);
    res.json(products);
  });

  app.get('/api/sites/:key/url', (req, res) => {
    const site = sites.find((s) => s.key === req.params.key);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const customParams = getSiteParams(db, req.params.key);
    const baseUrl = site.url;
    const defaultParams = new URL(baseUrl).search || '';

    res.json({
      baseUrl,
      defaultParams,
      customParams: customParams || null,
      effectiveUrl: customParams ? buildEffectiveUrl(baseUrl, customParams) : baseUrl,
      isCustom: !!customParams,
    });
  });

  app.put('/api/sites/:key/url', requireAuth, (req, res) => {
    const site = sites.find((s) => s.key === req.params.key);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const { params } = req.body;
    const err = validateParams(params);
    if (err) return res.status(400).json({ error: err });

    setSiteParams(db, req.params.key, params.trim());
    const customParams = params.trim();
    const baseUrl = site.url;

    res.json({
      baseUrl,
      customParams,
      effectiveUrl: buildEffectiveUrl(baseUrl, customParams),
      isCustom: true,
    });
  });

  app.delete('/api/sites/:key/url', requireAuth, (req, res) => {
    const site = sites.find((s) => s.key === req.params.key);
    if (!site) return res.status(404).json({ error: 'Site not found' });
    deleteSiteParams(db, req.params.key);
    res.json({
      baseUrl: site.url,
      customParams: null,
      effectiveUrl: site.url,
      isCustom: false,
    });
  });

  app.get('/api/history', (req, res) => {
    const { product, site } = req.query;
    if (!product || !site) {
      return res.status(400).json({ error: 'product and site parameters required' });
    }
    const history = getProductHistory(db, product, site);
    res.json(history);
  });

  app.post('/api/scrape', requireAuth, async (req, res) => {
    if (!runScrape) return res.status(501).json({ error: 'Scrape not available' });

    const { site } = req.body || {};
    try {
      const results = await runScrape(db, { siteKey: site });
      res.json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve frontend in production
  const distPath = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(distPath));
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) res.status(404).end();
    });
  });

  return app;
}

module.exports = { createServer };
