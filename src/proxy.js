import http from 'http';
import https from 'https';
import { config } from './config.js';

// No deps proxy: forwards /api/* to TARGET_URL preserving method, headers, and body
export function createProxyMiddleware() {
  if (!config.targetUrl) {
    // return a handler that 500s if not configured
    return (_req, res) => res.status(500).json({ error: 'missing_TARGET_URL' });
  }

  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const target = new URL(url.pathname.replace(/^\/api/, '') + url.search, config.targetUrl);

    const options = {
      method: req.method,
      headers: { ...req.headers, host: target.host },
    };

    const client = target.protocol === 'https:' ? https : http;
    const proxyReq = client.request(target, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'bad_gateway', detail: err.message }));
    });

    if (req.readable) req.pipe(proxyReq, { end: true });
    else proxyReq.end();
  };
}
