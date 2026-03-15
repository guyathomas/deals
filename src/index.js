#!/usr/bin/env node

const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

const { Command } = require('commander');
const { createDb, getChanges } = require('./db');
const { createServer } = require('./server');
const { runScrape } = require('./scrape-runner');

const program = new Command();

program
  .name('deals')
  .description('Monitor retail deal pages for price changes')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape one or all configured sites')
  .option('-s, --site <key>', 'Scrape a specific site')
  .action(async (opts) => {
    const db = createDb();
    try {
      await runScrape(db, { siteKey: opts.site });
    } finally {
      db.close();
    }
  });

program
  .command('serve')
  .description('Start the API server and dashboard')
  .option('-p, --port <number>', 'Port number', '3001')
  .action((opts) => {
    const db = createDb();
    const app = createServer(db, { runScrape: (db, opts) => runScrape(db, opts) });
    const port = parseInt(opts.port, 10);

    app.listen(port, () => {
      console.log(`Deals API running on http://localhost:${port}`);
      console.log('Press Ctrl+C to stop');
    });
  });

program
  .command('history')
  .description('Show recent changes in the terminal')
  .option('-s, --site <key>', 'Filter by site')
  .option('-d, --days <number>', 'Number of days', '7')
  .action((opts) => {
    const db = createDb();
    const changes = getChanges(db, {
      siteKey: opts.site,
      days: parseInt(opts.days, 10),
    });

    if (changes.length === 0) {
      console.log('No changes found.');
      db.close();
      return;
    }

    const typeColors = {
      new: '\x1b[32m',       // green
      price_drop: '\x1b[34m', // blue
      price_increase: '\x1b[31m', // red
      removed: '\x1b[90m',   // gray
    };
    const reset = '\x1b[0m';

    for (const c of changes) {
      const color = typeColors[c.change_type] || '';
      const priceInfo = c.price_diff
        ? ` ($${c.old_price} → $${c.new_price})`
        : '';
      console.log(
        `${color}[${c.change_type.padEnd(14)}]${reset} ${c.site_key.padEnd(16)} ${c.product_name}${priceInfo}`
      );
    }

    console.log(`\n${changes.length} change(s) in the last ${opts.days} day(s)`);
    db.close();
  });

program.parse();
