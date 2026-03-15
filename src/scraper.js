const pw = require('playwright');
const cheerio = require('cheerio');
const { sites } = require('../config/sites');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const CDP_TIMEOUT = 120000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// --- Bright Data Scraping Browser ---

function connectScrapingBrowser() {
  const auth = process.env.BRIGHT_DATA_AUTH;
  if (!auth) {
    throw new Error('BRIGHT_DATA_AUTH env var required (format: brd-customer-XXXXX-zone-ZONE:PASSWORD)');
  }
  const cdpUrl = `wss://${auth}@brd.superproxy.io:9222`;
  return pw.chromium.connectOverCDP(cdpUrl);
}

async function scrapeSite(siteConfig, { extractProducts, normalizeProducts }) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${siteConfig.key}...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }

    let browser;
    try {
      browser = await connectScrapingBrowser();
      const page = browser.contexts()[0].pages()[0];

      validateNavigationUrl(siteConfig.url);
      await page.goto(siteConfig.url, {
        waitUntil: 'domcontentloaded',
        timeout: CDP_TIMEOUT,
      });

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

module.exports = { scrapeSite, autoScroll, validateNavigationUrl, ALLOWED_HOSTS };
