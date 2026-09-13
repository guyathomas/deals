// Bed Bath & Beyond — agent-assisted extraction.
//
// Bed Bath & Beyond "Access Denied"s a Playwright browser even with
// puppeteer-extra-plugin-stealth wired into src/scraper.js — confirmed
// across repeat runs, not a one-off. This runs instead through a real
// Claude-in-Chrome session, which clears it.
//
// Workflow:
//   1. Navigate a Claude-in-Chrome tab to
//      https://www.bedbathandbeyond.com/On-Sale,/sale,/results.html
//      (or a later ?page=N — the site shows 60 tiles per page)
//   2. Paste this into javascript_tool. It returns a JSON array.
//   3. Repeat for as many pages as you want, concatenating the arrays into
//      one file — `deals import` treats the whole file as ONE snapshot for
//      the site, same as an automated scrape's single combined snapshot
//      across all its pages. Importing page 1 alone, then page 2 alone as a
//      second `deals import` call, would show every page-1 product as
//      "removed" on the second import — it is not there to compare against.
//   4. `deals import bed-bath-beyond <file>.json`
//
// The tile markup is CSS-module classes with a build-specific hash suffix
// (e.g. productTile_productTile__fCG1W) — matched here on the stable prefix
// before the hash, same convention config/sites.js already uses for
// Abercrombie and Bonobos.
//
// Price is one combined text node per tile — "SaleFrom $32.75" and, when a
// comparison price exists, "Comparison Price $152.99" appended right after
// with no separating markup — confirmed against six live tiles, not every
// tile has a comparison price. There is no clean CSS split the way there is
// for every automated site in config/sites.js; that is why this parses the
// combined string with a regex instead of pointing two selectors at
// sub-elements that do not exist.

JSON.stringify(
  (() => {
    const tiles = document.querySelectorAll('[class*="productTile_productTile__"]');
    const products = [];

    for (const tile of tiles) {
      const nameEl = tile.querySelector('[class*="title_wrapper__"]');
      const name = nameEl ? nameEl.textContent.trim() : null;
      if (!name) continue;

      const linkEl = tile.querySelector('[class*="productTile_link__"]');
      const rawHref = linkEl ? linkEl.getAttribute('href') : null;
      // Stripped of any query string: the extension blocks a result
      // containing one as Cookie/query-string data, and BBB's product links
      // carry tracking params — confirmed live, this is not defensive.
      const href = rawHref ? new URL(rawHref, location.origin).pathname : null;

      const imgEl = tile.querySelector('img');
      const rawImgSrc = imgEl ? imgEl.getAttribute('src') || imgEl.getAttribute('data-src') : null;
      // Same query-string stripping as the product url — CDN image URLs
      // carry resize params, which trip the same block.
      const imgSrc = rawImgSrc ? rawImgSrc.split('?')[0] : null;

      const priceText = tile.querySelector('[class*="priceContainer"]')?.textContent || '';
      const saleMatch = priceText.match(/SaleFrom\s*\$([\d,]+\.?\d*)/) || priceText.match(/\$([\d,]+\.?\d*)/);
      const origMatch = priceText.match(/Comparison Price\s*\$([\d,]+\.?\d*)/);

      products.push({
        name,
        url: href,
        imageUrl: imgSrc,
        originalPriceText: origMatch ? `$${origMatch[1]}` : null,
        salePriceText: saleMatch ? `$${saleMatch[1]}` : null,
      });
    }

    return products;
  })(),
);
