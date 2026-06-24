const { chromium } = require('playwright');
const { sites } = require('../config/sites');

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 3000;
const PAGE_TIMEOUT = 120000;

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

async function launchBrowser() {
  const headless = process.env.HEADLESS !== 'false';
  const browser = await chromium.launch({
    headless,
    channel: 'chrome', // Use system Chrome instead of Playwright's Chromium
  });
  return browser;
}

async function createStealthPage(browser) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
  });

  const page = await context.newPage();

  // Hide automation flags
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  return page;
}

async function scrapeSite(siteConfig, { extractProducts, normalizeProducts }) {
  let lastError;

  const browser = await launchBrowser();

  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${siteConfig.key}...`);
        await sleep(RETRY_DELAY_MS * attempt);
      }

      try {
        const page = await createStealthPage(browser);

        validateNavigationUrl(siteConfig.url);
        await page.goto(siteConfig.url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT,
        });

        // Give JS time to render dynamic content
        await sleep(5000);

        if (siteConfig.waitFor) {
          await page.waitForSelector(siteConfig.waitFor, {
            timeout: 5000,
          });
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
      }
    }
  } finally {
    await browser.close();
  }

  console.error(`  ${siteConfig.key}: FAILED after ${MAX_RETRIES + 1} attempts`);
  throw lastError;
}

module.exports = { scrapeSite, validateNavigationUrl, ALLOWED_HOSTS };
