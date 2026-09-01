const { getSiteParams } = require('./db');
const { buildEffectiveUrl, extractDefaultParams } = require('./url-utils');

// Response shapes shared by the express routes and the static export, so the
// snapshot cannot drift from what the API serves.
function siteSummary(site, summary = {}) {
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
}

function siteUrlPayload(db, site) {
  const customParams = getSiteParams(db, site.key);
  return {
    baseUrl: site.url,
    defaultParams: extractDefaultParams(site.url),
    customParams: customParams || null,
    effectiveUrl: customParams ? buildEffectiveUrl(site.url, customParams) : site.url,
    isCustom: !!customParams,
  };
}

module.exports = { siteSummary, siteUrlPayload };
