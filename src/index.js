#!/usr/bin/env node

const path = require('path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

const fs = require('fs');
const { Command } = require('commander');
const { createDb, getChanges } = require('./db');
const { createServer } = require('./server');
const { runScrape, recordImport } = require('./scrape-runner');
const { buildStaticData, writeStaticData, DEFAULT_CHANGE_DAYS } = require('./static-export');
const { sites } = require('../config/sites');

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
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

program
  .command('import <site> <file>')
  .description(
    'Record products for a manualOnly site (bed-bath-beyond, overstock) collected via ' +
      'its extension/<site>.js snippet — run that in a Claude-in-Chrome session on the ' +
      "site's sale page, save its JSON array output to <file>, then import it here.",
  )
  .action((siteKey, file) => {
    let rawProducts;
    try {
      rawProducts = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      console.error(`Could not read ${file} as JSON: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    if (!Array.isArray(rawProducts)) {
      console.error(`${file} must be a JSON array of products — see extension/${siteKey}.js`);
      process.exitCode = 1;
      return;
    }

    const db = createDb();
    try {
      recordImport(db, siteKey, rawProducts);
      console.log('\nDone.');
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
      process.exitCode = 1;
    } finally {
      db.close();
    }
  });

program
  .command('serve')
  .description('Start the API server and dashboard')
  .option('-p, --port <number>', 'Port number', process.env.PORT || '3001')
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

program
  .command('export')
  .description('Export the database to static JSON for GitHub Pages')
  .option('-o, --out <dir>', 'Output directory', path.join(__dirname, '..', 'web', 'public', 'api'))
  .option('-d, --days <number>', 'Days of change history to include', String(DEFAULT_CHANGE_DAYS))
  .action((opts) => {
    const changeDays = parseInt(opts.days, 10);
    if (!Number.isInteger(changeDays) || changeDays < 0) {
      console.error(`Invalid --days: ${opts.days}`);
      process.exitCode = 1;
      return;
    }

    const db = createDb();
    try {
      const files = buildStaticData(db, sites, { changeDays });
      const count = writeStaticData(opts.out, files);
      console.log(`Exported ${count} file(s) to ${opts.out}`);
      console.log(`${files['sites.json'].length} site(s), ${files['products-all.json'].length} product(s), ${files['changes.json'].length} change(s)`);
    } finally {
      db.close();
    }
  });

program.parse();
