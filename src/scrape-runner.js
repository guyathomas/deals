const { sites } = require('../config/sites');
const { saveSnapshot, getPreviousSnapshot, saveChanges, getSiteParams } = require('./db');
const { extractProducts, normalizeProducts } = require('./parser');
const { diffSnapshots } = require('./differ');
const { scrapeSite } = require('./scraper');
const { buildEffectiveUrl } = require('./url-utils');

// Snapshot, diff against the previous run, and save — the part that is
// identical whether `products` came from Playwright or from an agent-
// assisted extension snippet. Split out so `runScrape` and `recordImport`
// (deals import, for the two sites Playwright cannot reach even with the
// stealth plugin — see config/sites.js) share one path into the database
// rather than the diff/save logic drifting between two copies.
function recordProducts(db, siteKey, products) {
  if (products.length === 0) {
    console.log('  0 products — skipping diff (possible scrape failure)');
    return { site: siteKey, products: 0, changes: 0 };
  }

  const snapshotId = saveSnapshot(db, siteKey, products);
  const prev = getPreviousSnapshot(db, siteKey, snapshotId);
  let changeCount = 0;

  if (prev) {
    const changes = diffSnapshots(prev.products, products);
    if (changes.length > 0) {
      saveChanges(db, siteKey, changes);
      changeCount = changes.length;
      console.log(`  ${changes.length} change(s) detected`);
      for (const c of changes.slice(0, 5)) {
        const priceInfo = c.priceDiff ? ` ($${c.oldPrice} → $${c.newPrice})` : '';
        console.log(`    ${c.changeType}: ${c.productName}${priceInfo}`);
      }
      if (changes.length > 5) {
        console.log(`    ...and ${changes.length - 5} more`);
      }
    } else {
      console.log('  No changes since last scrape');
    }
  } else {
    console.log('  First scrape — no previous data to compare');
  }

  return { site: siteKey, products: products.length, changes: changeCount };
}

async function runScrape(db, { siteKey } = {}) {
  let targetSites;
  if (siteKey) {
    const requested = sites.filter((s) => s.key === siteKey);
    if (requested.length === 0) {
      throw new Error(`Site "${siteKey}" not found. Available: ${sites.map((s) => s.key).join(', ')}`);
    }
    const manual = requested.find((s) => s.manualOnly);
    if (manual) {
      throw new Error(
        `"${manual.key}" cannot be scraped automatically — its site blocks Playwright even with ` +
          `stealth (see config/sites.js). Collect products via extension/${manual.key}.js and run ` +
          `"deals import ${manual.key} <file>" instead.`,
      );
    }
    targetSites = requested;
  } else {
    // manualOnly sites are silently skipped here, not attempted and left to
    // fail: every automated attempt against them "Access Denied"s after two
    // retries and ~10s of retry delay, for a result the operator already
    // knows going in. `deals scrape -s <key>` above still refuses loudly for
    // someone who asks for one by name — this is only about the unfiltered
    // "scrape everything" path not wasting a cron run on a wall that will
    // not move.
    targetSites = sites.filter((s) => !s.manualOnly);
  }

  console.log(`Scraping ${targetSites.length} site(s)...`);
  const results = [];

  for (const site of targetSites) {
    const customParams = getSiteParams(db, site.key);
    const effectiveUrl = customParams ? buildEffectiveUrl(site.url, customParams) : site.url;
    const effectiveSite = effectiveUrl !== site.url ? { ...site, url: effectiveUrl } : site;

    if (customParams) {
      console.log(`\n[${site.key}] ${site.name} (custom params: ${customParams})`);
    } else {
      console.log(`\n[${site.key}] ${site.name}`);
    }

    try {
      const products = await scrapeSite(effectiveSite, { extractProducts, normalizeProducts });
      results.push(recordProducts(db, site.key, products));
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
      results.push({ site: site.key, error: err.message });
    }

    if (site !== targetSites[targetSites.length - 1]) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  console.log('\nDone.');
  return results;
}

// The manual-intervention counterpart to runScrape, for a manualOnly site.
// `rawProducts` is whatever an agent-assisted extension snippet returned —
// the same {name, url, imageUrl, originalPriceText, salePriceText} shape
// extractProducts() produces from the DOM — normalized and recorded through
// the identical snapshot/diff/save path an automated scrape uses.
function recordImport(db, siteKey, rawProducts) {
  const site = sites.find((s) => s.key === siteKey);
  if (!site) {
    throw new Error(`Site "${siteKey}" not found. Available: ${sites.map((s) => s.key).join(', ')}`);
  }
  if (!site.manualOnly) {
    throw new Error(
      `"${siteKey}" is scraped automatically — run "deals scrape -s ${siteKey}" instead of importing.`,
    );
  }

  console.log(`Importing ${rawProducts.length} product(s) for [${site.key}] ${site.name}`);
  const products = normalizeProducts(rawProducts, site.url);
  return recordProducts(db, site.key, products);
}

module.exports = { runScrape, recordImport, recordProducts };
