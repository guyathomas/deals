const { chromium } = require('playwright-extra');
const pw = require('playwright');
const stealth = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const Browserbase = require('@browserbasehq/sdk').default;
const { sites } = require('../config/sites');

chromium.use(stealth());

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const CDP_TIMEOUT = 120000;

// Build hostname allowlist from configured sites
const ALLOWED_HOSTS = new Set(sites.map((s) => new URL(s.url).hostname));

function validateNavigationUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Only HTTPS URLs allowed, got ${parsed.protocol}`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host not in allowlist: ${parsed.hostname}`);
  }
  return parsed;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
      // Safety timeout
      setTimeout(() => { clearInterval(timer); resolve(); }, 15000);
    });
  });
  await sleep(1000);
}

async function loadMorePages(page, siteConfig) {
  const { loadMore, maxPages = 5 } = siteConfig;
  if (!loadMore) return;

  for (let i = 0; i < maxPages; i++) {
    const countBefore = await page.$$eval(siteConfig.selectors.product, (els) => els.length);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);

    const btn = await page.$(loadMore);
    if (!btn) {
      console.log('    no load-more button found');
      break;
    }

    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const parent = el.closest('.invisible, [style*="visibility: hidden"]');
        if (parent) parent.classList.remove('invisible');
      }
    }, loadMore);

    try {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        el.scrollIntoView();
        el.click();
      }, loadMore);
    } catch (err) {
      console.log(`    load-more click failed: ${err.message.substring(0, 80)}`);
      break;
    }

    await page.waitForFunction(
      ({ sel, prev }) => document.querySelectorAll(sel).length > prev,
      { sel: siteConfig.selectors.product, prev: countBefore },
      { timeout: 15000 },
    ).catch(() => {});
    await sleep(2000);
    console.log(`    page ${i + 2}: ${await page.$$eval(siteConfig.selectors.product, (els) => els.length)} products`);
  }
}

// --- CDP connection providers ---

async function connectBrightData() {
  const auth = process.env.BRIGHT_DATA_AUTH;
  if (!auth) {
    throw new Error('BRIGHT_DATA_AUTH env var required (format: brd-customer-XXXXX-zone-ZONE:PASSWORD)');
  }
  const cdpUrl = `wss://${auth}@brd.superproxy.io:9222`;
  return pw.chromium.connectOverCDP(cdpUrl);
}

async function connectBrowserbase() {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error('BROWSERBASE_API_KEY env var required');
  }
  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserSettings: {
      solveCaptchas: true,
    },
  });
  console.log(`    browserbase session: ${session.id}`);
  const browser = await pw.chromium.connectOverCDP(session.connectUrl);
  return browser;
}

function getConnector(proxyType) {
  switch (proxyType) {
    case 'brightdata': return connectBrightData;
    case 'browserbase': return connectBrowserbase;
    default: return null;
  }
}

// --- Shared CDP scraping logic ---

async function scrapeWithCdp(siteConfig, { extractProducts, normalizeProducts }) {
  const connect = getConnector(siteConfig.proxy);
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${siteConfig.key}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    let browser;
    try {
      browser = await connect();
      const page = siteConfig.proxy === 'browserbase'
        ? browser.contexts()[0].pages()[0]
        : await browser.newPage();

      validateNavigationUrl(siteConfig.url);
      await page.goto(siteConfig.url, {
        waitUntil: 'domcontentloaded',
        timeout: CDP_TIMEOUT,
      });

      // For browserbase, wait for CAPTCHA solving if needed
      if (siteConfig.proxy === 'browserbase') {
        const hasCaptcha = await page.$('iframe[title*="CAPTCHA"], iframe[title*="captcha"], [class*="captcha"]');
        if (hasCaptcha) {
          console.log('    waiting for CAPTCHA solve...');
          await sleep(35000);
        }
      }

      if (siteConfig.waitFor) {
        await page.waitForSelector(siteConfig.waitFor, {
          timeout: CDP_TIMEOUT,
        });
      } else {
        await sleep(10000);
      }

      if (siteConfig.scrollToBottom) {
        await autoScroll(page);
      }

      await loadMorePages(page, siteConfig);

      const rawProducts = await extractProducts(page, siteConfig);
      const products = normalizeProducts(rawProducts, siteConfig.url);

      console.log(`  ${siteConfig.key}: ${products.length} products found`);
      return products;
    } catch (err) {
      lastError = err;
      console.error(`  ${siteConfig.key} attempt ${attempt}: ${err.message}`);
    } finally {
      if (browser) await browser.close();
    }
  }

  console.error(`  ${siteConfig.key}: FAILED after ${MAX_RETRIES + 1} attempts`);
  throw lastError;
}

// --- Web Unlocker (HTML-only, no browser) ---

function extractProductsFromHtml(html, siteConfig) {
  const $ = cheerio.load(html);
  const products = [];
  const { selectors } = siteConfig;

  $(selectors.product).each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find(selectors.name);
    const rawName = nameEl.text().trim();
    if (!rawName) return;

    const brandEl = selectors.brand ? $el.find(selectors.brand) : null;
    const brand = brandEl && brandEl.length ? brandEl.text().trim() : null;
    const name = brand ? `${brand} - ${rawName}` : rawName;

    const linkEl = $el.find(selectors.url);
    const href = linkEl.attr('href') || null;

    const imgEl = $el.find(selectors.image);
    const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || null;

    const origEl = $el.find(selectors.originalPrice);
    const saleEl = $el.find(selectors.salePrice);

    products.push({
      name,
      url: href,
      imageUrl: imgSrc,
      originalPriceText: origEl.length ? origEl.text().trim() : null,
      salePriceText: saleEl.length ? saleEl.text().trim() : null,
    });
  });

  return products;
}

async function fetchWithUnlocker(url) {
  const apiKey = process.env.BRIGHT_DATA_UNLOCKER_KEY;
  const zone = process.env.BRIGHT_DATA_UNLOCKER_ZONE;
  if (!apiKey || !zone) {
    throw new Error('BRIGHT_DATA_UNLOCKER_KEY and BRIGHT_DATA_UNLOCKER_ZONE env vars required');
  }

  const res = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ zone, url, format: 'raw' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Unlocker API ${res.status}: ${body.substring(0, 200)}`);
  }

  return res.text();
}

async function scrapeSiteUnlocker(siteConfig, { normalizeProducts }) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${siteConfig.key}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    try {
      validateNavigationUrl(siteConfig.url);
      const html = await fetchWithUnlocker(siteConfig.url);
      const rawProducts = extractProductsFromHtml(html, siteConfig);
      const products = normalizeProducts(rawProducts, siteConfig.url);

      console.log(`  ${siteConfig.key}: ${products.length} products found`);
      return products;
    } catch (err) {
      lastError = err;
      console.error(`  ${siteConfig.key} attempt ${attempt}: ${err.message}`);
    }
  }

  console.error(`  ${siteConfig.key}: FAILED after ${MAX_RETRIES + 1} attempts`);
  throw lastError;
}

// --- Main entry point ---

async function scrapeSite(browser, siteConfig, { extractProducts, normalizeProducts }) {
  if (siteConfig.proxy === 'unlocker') {
    return scrapeSiteUnlocker(siteConfig, { normalizeProducts });
  }
  if (siteConfig.proxy === 'brightdata' || siteConfig.proxy === 'browserbase') {
    return scrapeWithCdp(siteConfig, { extractProducts, normalizeProducts });
  }

  // Local browser (no proxy)
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${siteConfig.key}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    try {
      validateNavigationUrl(siteConfig.url);
      await page.goto(siteConfig.url, {
        waitUntil: 'domcontentloaded',
        timeout: siteConfig.timeout || 30000,
      });

      if (siteConfig.waitFor) {
        await page.waitForSelector(siteConfig.waitFor, {
          timeout: siteConfig.timeout || 30000,
        });
      } else {
        await sleep(5000);
      }

      if (siteConfig.scrollToBottom) {
        await autoScroll(page);
      }

      await loadMorePages(page, siteConfig);

      const rawProducts = await extractProducts(page, siteConfig);
      const products = normalizeProducts(rawProducts, siteConfig.url);

      console.log(`  ${siteConfig.key}: ${products.length} products found`);
      return products;
    } catch (err) {
      lastError = err;
      console.error(`  ${siteConfig.key} attempt ${attempt}: ${err.message}`);
    } finally {
      await context.close();
    }
  }

  console.error(`  ${siteConfig.key}: FAILED after ${MAX_RETRIES + 1} attempts`);
  throw lastError;
}

async function createBrowser() {
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

module.exports = { scrapeSite, createBrowser, autoScroll, validateNavigationUrl, ALLOWED_HOSTS };
