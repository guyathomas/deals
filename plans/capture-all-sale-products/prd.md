# Capture ALL sale products per store

## Problem
The scraper captures only ~page 1 of each store's sale listing (jcrew fixed 60, abercrombie 90, todd-snyder 100, etc.). The dashboard's "% off" sort (`web/src/pages/AllStores.jsx:92`) then reorders **only what was scraped** — so genuinely bigger discounts that sit past page 1 in the store's *default* order never enter the DB and can never surface. Concrete miss: J.Crew seersucker trouser at ~66% off, absent from the latest snapshot.

## Goal
Scrape the **complete** sale inventory for every configured store so the existing "% off" sort operates over all available sale products. No downstream changes needed — `getProducts`/`getAllProducts` (`src/db.js`) and the client sort already handle the full snapshot without a cap.

## Root cause (confirmed)
- `scrapeSite` (`src/scraper.js:127`) does one `autoScroll` + `loadMorePages`, then extracts once.
- `autoScroll` (`:31`) scrolls the already-rendered first page only.
- `loadMorePages` (`:50`) is a no-op unless a `loadMore` selector is set — **no site sets one today** — and is capped at a fixed `maxPages=5`.
- Stores paginate differently, so a single mechanism doesn't fit all.

## Design: pagination strategies + "load until stable"

Add an optional `pagination` object per site in `config/sites.js`. Three strategies share one stopping rule: **repeat the load action, recount products, stop when the count is unchanged for `stableRounds` (2) consecutive rounds OR a `maxPages` safety cap is hit OR timeout.** Always `log()` the final count and whether the cap was hit (never truncate silently).

1. **`scroll`** (infinite scroll) — loop: scroll to bottom → wait → recount. Replaces the one-shot `autoScroll` for these sites.
2. **`button`** (load-more / view-more) — generalize existing `loadMorePages`: loop-click until the button disappears or count stops growing; keep the invisible-parent un-hide handling; raise the cap.
3. **`query`** (URL param pagination) — iterate a param and **re-navigate** each page, extracting + accumulating, deduped by product URL; stop when a page yields 0 new products or the cap is hit. Runs at `scrapeSite` level (multiple `goto`s), not inside one page.

### Per-site assignment (validate live during Gate 3)
| Site | Strategy | Param / mechanism |
|------|----------|-------------------|
| abercrombie | `query` | offset `start` += `rows` (90) until empty page |
| jcrew | `query` | add `&sort=percent-off…` + page param (`Npge`) — or raise results-per-page |
| todd-snyder | `scroll` | Shopify + hash filters are client-side; `?page` likely ignores them — confirm |
| janji | `scroll` or `query` | Shopify filter params; confirm `?page=N` respects filters |

Assignments are hypotheses — each is verified against the live page in Gate 3, and the loop-until-stable rule makes every strategy self-terminating regardless.

## Gates (TDD)

**Gate 1 — Generalize in-page loader.** Refactor `autoScroll`/`loadMorePages` into a `loadUntilStable(page, siteConfig, action)` driver (scroll or button `action`). Unit test with a mock `page` whose product count grows then plateaus; assert it stops on plateau and on cap.

**Gate 2 — Query-param pagination + dedupe.** Add multi-navigation `query` path in `scrapeSite` accumulating across pages, dedupe by normalized URL. Unit test with a mock `goto`/extract returning decreasing new-product batches; assert termination + no dupes.

**Gate 3 — Per-site config + live validation.** Add `pagination` to each site in `config/sites.js`; run each store live (`HEADLESS=false` spot-check) and confirm: product_count materially exceeds today's cap, run terminates without hitting the safety cap under normal inventory, and the known 66%-off J.Crew trouser appears in the jcrew snapshot.

## Risks / mitigations
- **Bot detection** (more requests, esp. abercrombie/jcrew): keep stealth page, add jittered delays between pages, keep a sane `maxPages` cap.
- **Longer scrapes** (× many pages × 4 sites): watch the GitHub Action (`.github/workflows/scrape.yml`) timeout; parallelism unchanged.
- **Duplicates** from re-navigation: dedupe by normalized URL in the `query` path.
- **Selector/param drift**: loop-until-stable self-terminates; validation gate catches breakage.

## Out of scope
- Per-color tracking (jcrew tracks one tile per style).
- Dashboard pagination/virtualization (revisit only if snapshots grow large enough to lag).

## Exit criteria
Every store's latest snapshot reflects its full sale inventory; scrapes terminate cleanly; the dashboard "% off" sort surfaces the true biggest discounts across all stores (66%-off J.Crew trouser visible).
