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

const DEFAULT_MAX_PAGES = 40;
const DEFAULT_STABLE_ROUNDS = 2;

async function countProducts(page, selector) {
  return page.$$eval(selector, (els) => els.length);
}

// Generic pagination driver: repeatedly invoke `step` to load more products,
// stopping when the count plateaus for `stableRounds` consecutive rounds, when
// `step` signals no more pages (returns false), or when the `maxPages` safety
// cap is reached. Returns the final product count. Pure control loop — all
// waiting/DOM interaction lives in the injected `step`, so it is unit-testable.
async function loadUntilStable(page, siteConfig, step, opts = {}) {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const stableRounds = opts.stableRounds ?? DEFAULT_STABLE_ROUNDS;
  const selector = siteConfig.selectors.product;

  let prev = await countProducts(page, selector);
  let stable = 0;

  for (let i = 0; i < maxPages; i++) {
    const advanced = await step(page, siteConfig, i);
    const count = await countProducts(page, selector);

    if (count > prev) {
      prev = count;
      stable = 0;
    } else {
      stable += 1;
    }

    console.log(`    round ${i + 1}: ${count} products`);

    if (advanced === false || stable >= stableRounds) break;
  }

  return prev;
}

const SCROLL_STEP_RATIO = 0.8;
const SCROLL_SETTLE_MS = 250;
const MAX_SCROLL_STEPS = 200;

// Inline styles marketing/consent modals pin onto <html>/<body> to lock scrolling.
const SCROLL_LOCK_PROPS = ['overflow', 'overflow-y', 'position', 'height', 'inset', 'top'];

// Viewport-sized offsets walking `from` down to the bottom of the page. Pure, so
// the stepping maths stays unit-testable; the DOM walk lives in scrollThroughViewport.
// Always ends exactly at `scrollHeight` — infinite-scroll listings only fetch the
// next batch once the bottom is actually reached.
function scrollOffsets(scrollHeight, innerHeight, from = 0, maxSteps = MAX_SCROLL_STEPS) {
  const step = Math.max(1, Math.round(innerHeight * SCROLL_STEP_RATIO));
  const offsets = [];
  for (let y = Math.max(0, from) + step; y < scrollHeight && offsets.length < maxSteps; y += step) {
    offsets.push(y);
  }
  offsets.push(scrollHeight);
  return offsets;
}

// Marketing/consent modals (Attentive email capture, OneTrust cookie banners) lock
// scrolling by pinning `overflow: hidden; position: absolute` on <html>/<body>.
// While locked, window.scrollTo is a silent no-op. Clearing the inline styles
// restores scrolling without needing a dismiss-button selector per vendor per site.
async function releaseScrollLock(page) {
  await page.evaluate((props) => {
    for (const el of [document.documentElement, document.body]) {
      for (const prop of props) el.style.removeProperty(prop);
    }
  }, SCROLL_LOCK_PROPS);
}

// Walk down to the bottom a viewport at a time so every row intersects the viewport
// at least once. Lazy-loading grids mount a product's <img> only on intersection, so
// a single jump to the bottom leaves every skipped row without an image.
async function scrollThroughViewport(page) {
  await releaseScrollLock(page);

  const [scrollHeight, innerHeight, scrollY] = await page.evaluate(() => [
    document.documentElement.scrollHeight,
    window.innerHeight,
    window.scrollY,
  ]);

  const offsets = scrollOffsets(scrollHeight, innerHeight, scrollY);
  // Capping drops straight to the bottom, silently reintroducing the skipped-row
  // bug this walk exists to fix — say so rather than quietly losing images.
  if (offsets.length > MAX_SCROLL_STEPS) {
    console.log(`    scroll cap hit at ${MAX_SCROLL_STEPS} steps; rows below may lack images`);
  }

  for (const y of offsets) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await sleep(SCROLL_SETTLE_MS);
  }
}

// Step for infinite-scroll listings: walk to the bottom and let lazy content load.
async function scrollStep(page) {
  await scrollThroughViewport(page);
  await sleep(1500);
  return true;
}

// Step for "load more"/"view more" button listings. Returns false when the
// button is gone, signalling the driver to stop.
async function buttonStep(page, siteConfig) {
  const { loadMore } = siteConfig;

  await scrollThroughViewport(page);
  await sleep(1000);

  const btn = await page.$(loadMore);
  if (!btn) {
    console.log('    no load-more button found');
    return false;
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
    return false;
  }

  await page.waitForFunction(
    ({ sel, prev }) => document.querySelectorAll(sel).length > prev,
    { sel: siteConfig.selectors.product, prev: await countProducts(page, siteConfig.selectors.product) },
    { timeout: 15000 },
  ).catch(() => {});
  await sleep(2000);
  return true;
}

// Exhaust an in-page listing (scroll or button strategy) until all products load.
async function loadAllInPage(page, siteConfig) {
  const pagination = siteConfig.pagination || {};
  const strategy = pagination.strategy || (siteConfig.loadMore ? 'button' : 'scroll');
  const step = strategy === 'button' ? buttonStep : scrollStep;
  await loadUntilStable(page, siteConfig, step, pagination);
  // Final pass: tiles added by the last round may never have entered the viewport,
  // so walk once more before extraction rather than rely on where the loop stopped.
  await scrollThroughViewport(page);
}

function dedupeKey(product) {
  return product.url || product.name;
}

// Accumulate products across query-param pages, deduping by URL (falling back to
// name). Stops when a page returns nothing new, is empty, or the cap is hit.
// Pure over the injected `fetchPage(pageIndex) -> products[]` — unit-testable.
async function accumulatePages(fetchPage, opts = {}) {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const seen = new Map();

  for (let i = 0; i < maxPages; i++) {
    const products = await fetchPage(i);
    let added = 0;
    for (const product of products) {
      const key = dedupeKey(product);
      if (!seen.has(key)) {
        seen.set(key, product);
        added += 1;
      }
    }
    if (products.length === 0 || added === 0) break;
  }

  return [...seen.values()];
}

// Build a listing URL for query-param page N (offset or page-number).
function buildPageUrl(baseUrl, { param, start = 1, step = 1 }, pageIndex) {
  const url = new URL(baseUrl);
  url.searchParams.set(param, String(start + pageIndex * step));
  return url.href;
}

// Query-param pagination: re-navigate per page, extract + accumulate, deduped.
async function loadAllByQuery(page, siteConfig, { extractProducts, normalizeProducts }) {
  const { pagination } = siteConfig;
  return accumulatePages(async (pageIndex) => {
    const url = buildPageUrl(siteConfig.url, pagination, pageIndex);
    validateNavigationUrl(url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT });
    await sleep(5000);
    if (siteConfig.waitFor) {
      await page.waitForSelector(siteConfig.waitFor, { timeout: 5000 }).catch(() => {});
    }
    await loadUntilStable(page, siteConfig, scrollStep, pagination);
    await scrollThroughViewport(page);
    const raw = await extractProducts(page, siteConfig);
    console.log(`    query page ${pageIndex + 1}: ${raw.length} products (${url})`);
    return normalizeProducts(raw, url);
  }, pagination);
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

        let products;
        if (siteConfig.pagination?.strategy === 'query') {
          products = await loadAllByQuery(page, siteConfig, { extractProducts, normalizeProducts });
        } else {
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

          await loadAllInPage(page, siteConfig);

          const rawProducts = await extractProducts(page, siteConfig);
          products = normalizeProducts(rawProducts, siteConfig.url);
        }

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

module.exports = {
  scrapeSite,
  validateNavigationUrl,
  ALLOWED_HOSTS,
  loadUntilStable,
  accumulatePages,
  scrollOffsets,
};
