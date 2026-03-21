function parsePriceString(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.replace(/,/g, '').match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

function calculateDiscount(originalPrice, salePrice) {
  if (!originalPrice || !salePrice || originalPrice <= 0) return null;
  if (salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

function resolveUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function normalizeUrl(href, baseUrl) {
  return resolveUrl(href, baseUrl);
}

function normalizeImageUrl(src, baseUrl) {
  if (!src || src.startsWith('data:')) return null;
  return resolveUrl(src, baseUrl);
}

function extractProducts(page, siteConfig) {
  return page.evaluate(({ selectors }) => {
    const productEls = document.querySelectorAll(selectors.product);
    const products = [];

    for (const el of productEls) {
      const nameEl = el.querySelector(selectors.name);
      const rawName = nameEl ? nameEl.textContent.trim() : null;
      if (!rawName) continue;

      const brandEl = selectors.brand ? el.querySelector(selectors.brand) : null;
      const brand = brandEl ? brandEl.textContent.trim() : null;
      const name = brand ? `${brand} - ${rawName}` : rawName;

      const linkEl = el.querySelector(selectors.url) || el.closest(selectors.url);
      const href = linkEl ? linkEl.getAttribute('href') : null;

      const imgEl = el.querySelector(selectors.image);
      const imgSrc = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : null;

      const origEl = el.querySelector(selectors.originalPrice);
      const saleEl = el.querySelector(selectors.salePrice);

      products.push({
        name,
        url: href,
        imageUrl: imgSrc,
        originalPriceText: origEl ? origEl.textContent.trim() : null,
        salePriceText: saleEl ? saleEl.textContent.trim() : null,
      });
    }

    return products;
  }, { selectors: siteConfig.selectors });
}

function normalizeProducts(rawProducts, baseUrl) {
  return rawProducts.map((p) => {
    const originalPrice = parsePriceString(p.originalPriceText);
    const salePrice = parsePriceString(p.salePriceText);
    const discountPct = calculateDiscount(originalPrice, salePrice);

    return {
      name: p.name,
      url: normalizeUrl(p.url, baseUrl),
      imageUrl: normalizeImageUrl(p.imageUrl, baseUrl),
      originalPrice,
      salePrice,
      discountPct,
    };
  });
}

module.exports = {
  parsePriceString,
  calculateDiscount,
  normalizeUrl,
  normalizeImageUrl,
  extractProducts,
  normalizeProducts,
};
