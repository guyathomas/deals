# Setup TODO

- [ ] Install Playwright browsers: `npx playwright install chromium`
- [ ] Test locally: `node src/index.js scrape -s jcrew`
- [ ] Add `ADMIN_TOKEN` as a GitHub Actions secret for the daily cron

## GitHub Pages (static snapshot)

- [ ] Repo Settings → Pages → Source: **GitHub Actions**
- [ ] Refresh the snapshot before pushing: `npm run scrape && npm run export`
- [ ] Commit `web/public/api/` — the Pages build deploys whatever snapshot is committed

Site: https://guyathomas.github.io/deals/ (read-only; scrape URL editing is server-only)

The daily scrape cron (`scrape.yml`) only refreshes the fly.io server. The Pages
snapshot changes only when a new export is committed and pushed.

## Sites that need a human/agent, not the cron (`manualOnly`)

`bed-bath-beyond` and `overstock` still "Access Denied" a Playwright browser
even with `puppeteer-extra-plugin-stealth` wired into `src/scraper.js` —
confirmed across repeat runs. `williams-sonoma` and `pottery-barn` were in the
same state until the stealth plugin cleared them; those two are automated
now. `deals scrape` (no `-s`) silently skips the two that are still blocked
rather than burning retries against a wall that will not move; asking for one
by name (`deals scrape -s bed-bath-beyond`) refuses with a pointer here.

To get their data in:

1. Open a Claude-in-Chrome tab on the site's sale page (URL is in
   `config/sites.js`'s entry for the site).
2. Paste `extension/<site>.js` into `javascript_tool`. It returns a JSON
   array of products.
3. Repeat across as many `?page=N` loads as you want, concatenating the
   arrays into one file — `deals import` treats the file as ONE complete
   snapshot for the site, same as an automated scrape's single snapshot
   across all its pages. Importing page 1 alone and then page 2 alone as a
   *second* `deals import` call would show every page-1 product as
   "removed" — it is not there to compare against in that second file.
4. `deals import <site> <file>.json`

The two test imports run while building this (2 products each, to prove the
pipeline rather than to be real data) are sitting in the local
`data/deals.db` under `bed-bath-beyond` and `overstock`. That file is
gitignored, so nothing leaked into the repo, but the first *real* import for
either site will diff against those 2-item snapshots and report a wall of
"new" products rather than a clean first scrape. Worth clearing before a real
import: delete `data/deals.db` (and the `-shm`/`-wal` files next to it) to
start clean, or accept the one noisy diff on the first real import.
