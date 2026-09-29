import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, validateTargets } from '../src/config.js';

function targetsFile(targets) {
  const file = join(mkdtempSync(join(tmpdir(), 'statuswatch-')), 'targets.json');
  writeFileSync(file, JSON.stringify(targets));
  return file;
}

const good = [{ name: 'site', url: 'https://example.com' }];

test('defaults are used when env vars are not set', () => {
  const config = loadConfig({ TARGETS_FILE: targetsFile(good) });
  assert.equal(config.port, 3000);
  assert.equal(config.intervalSeconds, 60);
  assert.equal(config.timeoutMs, 10_000);
  assert.deepEqual(config.targets, good);
});

test('env vars override the defaults', () => {
  const config = loadConfig({ TARGETS_FILE: targetsFile(good), PORT: '8080', CHECK_INTERVAL_SECONDS: '30', CHECK_TIMEOUT_MS: '5000' });
  assert.equal(config.port, 8080);
  assert.equal(config.intervalSeconds, 30);
  assert.equal(config.timeoutMs, 5000);
});

test('bad numbers are rejected', () => {
  assert.throws(() => loadConfig({ TARGETS_FILE: targetsFile(good), PORT: 'abc' }), /PORT must be a positive whole number/);
});

test('timeout must be shorter than the interval', () => {
  assert.throws(
    () => loadConfig({ TARGETS_FILE: targetsFile(good), CHECK_INTERVAL_SECONDS: '5', CHECK_TIMEOUT_MS: '5000' }),
    /CHECK_TIMEOUT_MS must be shorter/,
  );
});

test('invalid targets are rejected', () => {
  assert.throws(() => validateTargets([]), /non-empty array/);
  assert.throws(() => validateTargets([{ url: 'https://a.com' }]), /needs a name/);
  assert.throws(() => validateTargets([{ name: 'a', url: 'not a url' }]), /Invalid URL/);
  assert.throws(() => validateTargets([{ name: 'a', url: 'ftp://a.com' }]), /http:\/\/ or https:\/\//);
  assert.throws(
    () => validateTargets([{ name: 'a', url: 'https://a.com' }, { name: 'a', url: 'https://b.com' }]),
    /Duplicate target name/,
  );
});
