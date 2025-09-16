import fs from 'fs';
import path from 'path';

const logDir = path.resolve('logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, `${new Date().toISOString().slice(0,10)}.log`);

export function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFile, line);
}

export function logRequest(req) {
  log(`${req.method} ${req.url}`);
}

export function logError(err) {
  log(`ERROR: ${err.stack || err.message || err}`);
}
