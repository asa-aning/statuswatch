import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createMetrics } from '../src/metrics.js';
import { Monitor } from '../src/monitor.js';

let server;
let baseUrl;

before(async () => {
  // Target name contains HTML, to prove the page escapes it.
  const targets = [{ name: '<script>alert(1)</script>', url: 'https://example.com' }];
  const metrics = createMetrics({ defaultMetrics: false });
  const check = async () => ({ up: true, statusCode: 200, responseTimeMs: 42, error: null, checkedAt: new Date().toISOString() });
  const monitor = new Monitor({ targets, metrics, check });
  await monitor.runChecks();

  server = createServer({ monitor, metrics });
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => server.close());

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('GET /api/status returns target status as JSON', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const { targets } = await res.json();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].state, 'up');
  assert.equal(targets[0].lastCheck.responseTimeMs, 42);
});

test('GET /metrics returns Prometheus metrics', async () => {
  const res = await fetch(`${baseUrl}/metrics`);
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /statuswatch_target_up\{target=".*"\} 1/);
  assert.match(text, /statuswatch_checks_total\{target=".*",result="up"\} 1/);
});

test('GET / renders the status page with names escaped', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /All systems operational/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
});

test('unknown paths return 404', async () => {
  const res = await fetch(`${baseUrl}/nope`);
  assert.equal(res.status, 404);
});

test('POST is not allowed', async () => {
  const res = await fetch(`${baseUrl}/health`, { method: 'POST' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
});
