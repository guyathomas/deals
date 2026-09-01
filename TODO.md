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
