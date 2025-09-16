import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from './proxy.js';
import { logRequest, logError, log } from './logger.js';
import { config } from './config.js';
import recordingsRouter from './routes/recordings.js';

const app = express();

app.use(express.json());
app.use((req, _res, next) => { logRequest(req); next(); });

// Basic health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Recordings management routes
app.use('/api/recordings', recordingsRouter);

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
});
