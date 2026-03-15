const { sites } = require('../config/sites');
const { saveSnapshot, getPreviousSnapshot, saveChanges, getSiteParams } = require('./db');
const { extractProducts, normalizeProducts } = require('./parser');
const { diffSnapshots } = require('./differ');
const { scrapeSite } = require('./scraper');
const { buildEffectiveUrl } = require('./server');

async function runScrape(db, { siteKey } = {}) {
  let targetSites;
  if (siteKey) {
    targetSites = sites.filter((s) => s.key === siteKey);
    if (targetSites.length === 0) {
      throw new Error(`Site "${siteKey}" not found. Available: ${sites.map((s) => s.key).join(', ')}`);
    }
  } else {
    targetSites = sites;
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

      if (products.length === 0) {
        console.log('  0 products — skipping diff (possible scrape failure)');
        results.push({ site: site.key, products: 0, changes: 0 });
        continue;
      }

      const snapshotId = saveSnapshot(db, site.key, products);
      const prev = getPreviousSnapshot(db, site.key, snapshotId);
      let changeCount = 0;

      if (prev) {
        const changes = diffSnapshots(prev.products, products);
        if (changes.length > 0) {
          saveChanges(db, site.key, changes);
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

      results.push({ site: site.key, products: products.length, changes: changeCount });
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

module.exports = { runScrape };
