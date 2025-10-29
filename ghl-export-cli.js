#!/usr/bin/env node

import 'dotenv/config';
import { GHLContactExportService } from './src/services/ghl-contact-export-service.js';
import { program } from 'commander';
import chalk from 'chalk';

// Create service instance with env vars
const exportService = new GHLContactExportService(
  process.env.GHL_API_KEY,
  process.env.GHL_LOCATION_ID
);

// Configure CLI
program
  .name('ghl-export')
  .description('GoHighLevel Contact Export CLI')
  .version('1.0.0');

// Export all contacts command
program
  .command('export-all')
  .description('Export all contacts from GHL to local database')
  .option('-l, --limit <number>', 'Limit number of contacts per batch', '100')
  .option('-d, --delay <ms>', 'Delay between batches in milliseconds', '1000')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting full contact export...'));

      const result = await exportService.exportAllContacts({
        pageLimit: parseInt(options.limit),
        delayBetweenBatches: parseInt(options.delay)
      });

      console.log(chalk.green('\n✅ Export completed successfully!'));
      console.log(chalk.cyan('📊 Statistics:'));
      console.log(`   Total Processed: ${result.totalProcessed}`);
      console.log(`   Successful: ${result.successCount}`);
      console.log(`   Errors: ${result.errorCount}`);

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error.message);
      process.exit(1);
    }
  });

// Export by date range command
program
  .command('export-range')
  .description('Export contacts within a date range')
  .requiredOption('-s, --start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('-e, --end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const startDate = new Date(options.start);
      const endDate = new Date(options.end);

      console.log(chalk.blue(`📅 Exporting contacts from ${options.start} to ${options.end}...`));

      const result = await exportService.exportContactsByDateRange(startDate, endDate);

      console.log(chalk.green('\n✅ Export completed!'));
      console.log(`   Processed: ${result.processed} contacts`);
      if (result.errors?.length > 0) {
        console.log(chalk.yellow(`   Errors: ${result.errors.length}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error.message);
      process.exit(1);
    }
  });

// Export single contact command
program
  .command('export-contact <contactId>')
  .description('Export a single contact by ID')
  .action(async (contactId) => {
    try {
      console.log(chalk.blue(`📥 Exporting contact ${contactId}...`));

      const contact = await exportService.exportSingleContact(contactId);

      console.log(chalk.green('✅ Contact exported successfully!'));
      console.log(`   Name: ${contact.firstName} ${contact.lastName}`);
      console.log(`   Email: ${contact.email || 'N/A'}`);
      console.log(`   Phone: ${contact.phone || 'N/A'}`);

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error.message);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Perform bidirectional sync with GHL')
  .option('-p, --push', 'Push local changes to GHL', false)
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔄 Starting sync...'));

      await exportService.syncContacts({
        pushLocalChanges: options.push
      });

      console.log(chalk.green('✅ Sync completed successfully!'));

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error.message);
      process.exit(1);
    }
  });

// Statistics command
program
  .command('stats')
  .description('Show export statistics and status')
  .action(async () => {
    try {
      const stats = await exportService.getStatistics();

      console.log(chalk.cyan('\n📊 Export Statistics'));
      console.log(chalk.white('─'.repeat(40)));
      console.log(`Total Contacts: ${stats.totalContacts}`);

      if (stats.latestSync) {
        console.log(`\nLatest Sync:`);
        console.log(`  Type: ${stats.latestSync.sync_type}`);
        console.log(`  Status: ${stats.latestSync.status}`);
        console.log(`  Started: ${stats.latestSync.started_at}`);
        console.log(`  Completed: ${stats.latestSync.completed_at || 'In Progress'}`);
        console.log(`  Processed: ${stats.latestSync.processed_contacts || 0}/${stats.latestSync.total_contacts || 0}`);
      }

      if (stats.apiStatus) {
        console.log(`\nAPI Status:`);
        console.log(`  Connected: ${stats.apiStatus.success ? '✅' : '❌'}`);
        console.log(`  Location ID: ${stats.apiStatus.locationId || 'N/A'}`);
        console.log(`  Total Contacts in GHL: ${stats.apiStatus.totalContacts || 0}`);
      }

      if (stats.rateLimitStatus) {
        console.log(`\nRate Limit:`);
        console.log(`  Remaining: ${stats.rateLimitStatus.remaining}`);
        console.log(`  Reset At: ${stats.rateLimitStatus.resetAt || 'Unknown'}`);
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Failed to get statistics:'), error.message);
      process.exit(1);
    }
  });

// Search command
program
  .command('search')
  .description('Search exported contacts')
  .option('-e, --email <email>', 'Search by email')
  .option('-p, --phone <phone>', 'Search by phone')
  .option('-n, --name <name>', 'Search by name')
  .option('-t, --type <type>', 'Filter by type (lead/contact)')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (options) => {
    try {
      const criteria = {};

      if (options.email) criteria.email = options.email;
      if (options.phone) criteria.phone = options.phone;
      if (options.name) criteria.name = options.name;
      if (options.type) criteria.type = options.type;
      if (options.limit) criteria.limit = parseInt(options.limit);

      console.log(chalk.blue('🔍 Searching contacts...'));

      const contacts = await exportService.searchLocalContacts(criteria);

      if (contacts.length === 0) {
        console.log(chalk.yellow('No contacts found matching criteria'));
      } else {
        console.log(chalk.green(`\n✅ Found ${contacts.length} contacts:\n`));

        contacts.forEach(contact => {
          console.log(chalk.white('─'.repeat(40)));
          console.log(`ID: ${contact.id}`);
          console.log(`Name: ${contact.first_name || ''} ${contact.last_name || ''}`);
          console.log(`Email: ${contact.email || 'N/A'}`);
          console.log(`Phone: ${contact.phone || 'N/A'}`);
          console.log(`Type: ${contact.type || 'N/A'}`);
          console.log(`Source: ${contact.source || 'N/A'}`);
        });
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Search failed:'), error.message);
      process.exit(1);
    }
  });

// Test connection command
program
  .command('test')
  .description('Test GHL API connection')
  .action(async () => {
    try {
      console.log(chalk.blue('🔌 Testing GHL API connection...'));

      await exportService.init();
      const stats = await exportService.getStatistics();

      if (stats.apiStatus.success) {
        console.log(chalk.green('✅ Connection successful!'));
        console.log(`   Location ID: ${stats.apiStatus.locationId}`);
        console.log(`   Total Contacts: ${stats.apiStatus.totalContacts}`);
      } else {
        console.log(chalk.red('❌ Connection failed'));
        console.log(`   Error: ${stats.apiStatus.error}`);
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Test failed:'), error.message);
      process.exit(1);
    }
  });

// Parse CLI arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}