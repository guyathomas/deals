# Setup TODO

- [ ] Set up Bright Data Scraping Browser zone in your BD dashboard — create a zone with type "Scraping Browser", note the credentials
- [ ] Update `.env` with the new zone credentials in `BRIGHT_DATA_AUTH`
- [ ] Test locally — `node src/index.js scrape -s jcrew` to verify BD Scraping Browser works
- [ ] Deploy to Fly.io:
  ```
  fly launch --copy-config
  fly volumes create deals_data --size 1 --region ewr
  fly secrets set ADMIN_TOKEN=<token> BRIGHT_DATA_AUTH=<auth>
  fly deploy
  ```
- [ ] Add `ADMIN_TOKEN` as a GitHub Actions secret for the daily cron
- [ ] Verify — hit https://deals-monitor.fly.dev, trigger a manual scrape via Actions
