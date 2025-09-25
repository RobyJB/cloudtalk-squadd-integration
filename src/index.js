import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createProxyMiddleware } from './proxy.js';
import { logRequest, logError, log } from './logger.js';
import { config } from './config.js';
import recordingsRouter from './routes/recordings.js';
import ghlWebhooksRouter from './routes/ghl-webhooks.js';
import cloudtalkWebhooksRouter from './routes/cloudtalk-webhooks.js';
import googleSheetsWebhooksRouter from './routes/google-sheets-webhooks.js';
import googleSheetsQueueService from './services/google-sheets-queue-service.js';

const app = express();

app.use(express.json());
app.use((req, _res, next) => { logRequest(req); next(); });

// Basic health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Recordings management routes
app.use('/api/recordings', recordingsRouter);

// GoHighLevel webhook routes
app.use('/api/ghl-webhooks', ghlWebhooksRouter);

// CloudTalk webhook routes
app.use('/api/cloudtalk-webhooks', cloudtalkWebhooksRouter);

// Google Sheets webhook routes
app.use('/api/google-sheets-webhooks', googleSheetsWebhooksRouter);

// Minimal proxy route: forwards any method/path under /api to TARGET_URL
app.use('/api', createProxyMiddleware());

// Error handler
app.use((err, _req, res, _next) => {
  logError(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(config.port, () => {
  log(`server:listening port=${config.port}`);
  console.log(`Listening on http://localhost:${config.port}`);

  // Log Google Sheets queue service status
  const queueHealth = googleSheetsQueueService.getHealthStatus();
  log(`📊 Google Sheets Queue Service: ${queueHealth.status}`);
  log(`📋 Queue Configuration: ${queueHealth.queue.maxConcurrent} concurrent, ${queueHealth.configuration.requestDelay}ms delay`);
  log(`🔧 Google Sheets URL Configured: ${queueHealth.configuration.googleSheetsConfigured}`);

  if (!queueHealth.configuration.googleSheetsConfigured) {
    log('⚠️  Set GOOGLE_SHEETS_APPS_SCRIPT_URL environment variable to enable Google Sheets tracking');
  }
});
