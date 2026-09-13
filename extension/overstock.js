// Overstock — agent-assisted extraction.
//
// Overstock "Access Denied"s a Playwright browser even with
// puppeteer-extra-plugin-stealth wired into src/scraper.js — confirmed
// across repeat runs, not a one-off. This runs instead through a real
// Claude-in-Chrome session, which clears it.
//
// Workflow:
//   1. Navigate a Claude-in-Chrome tab to
//      https://www.overstock.com/Fall-Overhaul-Sale,/link,/results.html
//      (or a later ?page=N — the site shows 64 tiles per page, ~84 pages)
//   2. Paste this into javascript_tool. It returns a JSON array.
//   3. Repeat for as many pages as you want, concatenating the arrays into
//      one file — `deals import` treats the whole file as ONE snapshot for
//      the site, same as an automated scrape's single combined snapshot
//      across all its pages. Importing page 1 alone, then page 2 alone as a
//      second `deals import` call, would show every page-1 product as
//      "removed" on the second import — it is not there to compare against.
//   4. `deals import overstock <file>.json`
//
// Unlike Bed Bath & Beyond, the two prices here ARE cleanly split by
// data-testid, so this is close to a direct port of the same selectors
// config/sites.js records for it (kept in sync by hand, not shared code,
// since one runs in Playwright's page.evaluate and this runs standalone).
//
// The product link is on an ANCESTOR of the tile, not a descendant — the
// tile itself has no <a> inside it — confirmed on the live page, which is
// why this walks up with closest() rather than querySelector('a').
//
// Overstock's sale campaign is seasonally renamed ("Fall Overhaul Sale" as
// of writing); the URL above will need updating when the campaign does.

JSON.stringify(
  (() => {
    const tiles = document.querySelectorAll('[data-testid="product-tile__polaroid"]');
    const products = [];

    for (const tile of tiles) {
      const nameEl = tile.querySelector('[data-testid="product-tile__product-name"]');
      const name = nameEl ? nameEl.textContent.trim() : null;
      if (!name) continue;

      const linkEl = tile.querySelector('a') || tile.closest('a');
      const rawHref = linkEl ? linkEl.getAttribute('href') : null;
      // Stripped of any query string, same reason as bed-bath-beyond.js:
      // the extension blocks a result containing one, confirmed live.
      const href = rawHref ? new URL(rawHref, location.origin).pathname : null;

      const imgEl = tile.querySelector('img');
      const rawImgSrc = imgEl ? imgEl.getAttribute('src') || imgEl.getAttribute('data-src') : null;
      // Same query-string stripping as the product url — CDN image URLs
      // carry resize params, which trip the same block.
      const imgSrc = rawImgSrc ? rawImgSrc.split('?')[0] : null;

      const saleEl = tile.querySelector('[data-testid="product-price-amount"]');
      const origEl = tile.querySelector('[data-testid^="ordinary-selling-price-amount-"]');

      products.push({
        name,
        url: href,
        imageUrl: imgSrc,
        originalPriceText: origEl ? origEl.textContent.trim() : null,
        salePriceText: saleEl ? saleEl.textContent.trim() : null,
      });
    }

    return products;
  })(),
);
