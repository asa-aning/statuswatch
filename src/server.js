import http from 'node:http';
import { renderPage } from './page.js';

// A tiny HTTP server with four routes. Node's built-in http module is
// enough here, so there's no Express dependency to keep updated.
export function createServer({ monitor, metrics }) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send(res, 405, 'text/plain', 'Method Not Allowed', { allow: 'GET, HEAD' });
      }

      const { pathname } = new URL(req.url, 'http://localhost');
      switch (pathname) {
        case '/':
          return send(res, 200, 'text/html; charset=utf-8', renderPage(monitor.getStatus()));

        case '/api/status':
          return sendJson(res, 200, { targets: monitor.getStatus() });

        // Liveness check: "is the StatusWatch process itself OK?"
        // It says nothing about the targets. Docker and load balancers
        // call this to decide whether to restart the container.
        case '/health':
          return sendJson(res, 200, { status: 'ok', uptimeSeconds: Math.round(process.uptime()) });

        case '/metrics':
          return send(res, 200, metrics.registry.contentType, await metrics.registry.metrics());

        default:
          return send(res, 404, 'text/plain', 'Not Found');
      }
    } catch (err) {
      console.error('Request failed:', err);
      if (!res.headersSent) send(res, 500, 'text/plain', 'Internal Server Error');
    }
  });
}

function send(res, status, contentType, body, headers = {}) {
  res.writeHead(status, { 'content-type': contentType, ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, 'application/json', JSON.stringify(data, null, 2));
}
