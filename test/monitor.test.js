import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Monitor } from '../src/monitor.js';

const target = { name: 'site', url: 'https://example.com' };

// A fake check that returns scripted results in order: no network needed.
function scripted(...ups) {
  let i = 0;
  return async () => {
    const up = ups[i++];
    return { up, statusCode: up ? 200 : 500, responseTimeMs: 5, error: up ? null : 'HTTP 500', checkedAt: new Date().toISOString() };
  };
}

test('a target is pending before its first check', () => {
  const monitor = new Monitor({ targets: [target], check: scripted() });
  const [status] = monitor.getStatus();
  assert.equal(status.state, 'pending');
  assert.equal(status.lastCheck, null);
  assert.equal(status.uptimePercent, null);
});

test('state and uptime follow the check results', async () => {
  const monitor = new Monitor({ targets: [target], check: scripted(true, true, true, false) });
  for (let i = 0; i < 4; i++) await monitor.runChecks();

  const [status] = monitor.getStatus();
  assert.equal(status.state, 'down');
  assert.equal(status.uptimePercent, 75);
  assert.deepEqual(status.history, [true, true, true, false]);
});

test('history keeps only the most recent results', async () => {
  const monitor = new Monitor({ targets: [target], historySize: 3, check: scripted(false, true, true, true) });
  for (let i = 0; i < 4; i++) await monitor.runChecks();

  const [status] = monitor.getStatus();
  assert.deepEqual(status.history, [true, true, true]);
  assert.equal(status.uptimePercent, 100);
});

test('onStateChange fires on the first check and on every flip', async () => {
  const changes = [];
  const monitor = new Monitor({
    targets: [target],
    check: scripted(true, true, false, false, true),
    onStateChange: (_t, result) => changes.push(result.up),
  });
  for (let i = 0; i < 5; i++) await monitor.runChecks();

  // up (first), stays up, DOWN, stays down, UP again
  assert.deepEqual(changes, [true, false, true]);
});

test('results are recorded in metrics', async () => {
  const recorded = [];
  const metrics = { record: (t, r) => recorded.push([t.name, r.up]) };
  const monitor = new Monitor({ targets: [target], metrics, check: scripted(true) });
  await monitor.runChecks();

  assert.deepEqual(recorded, [['site', true]]);
});
