import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { checkTarget } from '../src/checker.js';

// A fake website running on localhost, so tests never need the internet.
let server;
let baseUrl;

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/ok') return res.end('hello');
    if (req.url === '/broken') { res.statusCode = 500; return res.end('oops'); }
    if (req.url === '/slow') return setTimeout(() => res.end('finally'), 1_000);
    res.statusCode = 404;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, resolve)); // port 0 = any free port
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test('a 200 response is up', async () => {
  const result = await checkTarget({ name: 'ok', url: `${baseUrl}/ok` });
  assert.equal(result.up, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.error, null);
  assert.ok(result.responseTimeMs >= 0);
});

test('a 500 response is down', async () => {
  const result = await checkTarget({ name: 'broken', url: `${baseUrl}/broken` });
  assert.equal(result.up, false);
  assert.equal(result.statusCode, 500);
  assert.equal(result.error, 'HTTP 500');
});

test('a slow response times out and is down', async () => {
  const result = await checkTarget({ name: 'slow', url: `${baseUrl}/slow` }, { timeoutMs: 100 });
  assert.equal(result.up, false);
  assert.equal(result.statusCode, null);
  assert.equal(result.error, 'Timed out after 100 ms');
});

test('a server that is not running is down', async () => {
  // Grab a free port, then close it so nothing is listening there.
  const closed = http.createServer();
  await new Promise((resolve) => closed.listen(0, resolve));
  const { port } = closed.address();
  await new Promise((resolve) => closed.close(resolve));

  const result = await checkTarget({ name: 'gone', url: `http://127.0.0.1:${port}/` });
  assert.equal(result.up, false);
  assert.equal(result.error, 'Connection refused');
});
