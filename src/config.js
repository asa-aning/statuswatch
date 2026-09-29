import { readFileSync } from 'node:fs';

// All settings come from environment variables (with sensible defaults).
// This is the "12-factor app" convention: the same code/image runs
// anywhere, and only the environment changes between laptop and server.
export function loadConfig(env = process.env) {
  const targetsFile = env.TARGETS_FILE ?? new URL('../targets.json', import.meta.url);

  const config = {
    port: toPositiveInt(env.PORT ?? '3000', 'PORT'),
    intervalSeconds: toPositiveInt(env.CHECK_INTERVAL_SECONDS ?? '60', 'CHECK_INTERVAL_SECONDS'),
    timeoutMs: toPositiveInt(env.CHECK_TIMEOUT_MS ?? '10000', 'CHECK_TIMEOUT_MS'),
    targets: validateTargets(JSON.parse(readFileSync(targetsFile, 'utf8'))),
  };

  // A check must finish before the next one starts.
  if (config.timeoutMs >= config.intervalSeconds * 1000) {
    throw new Error('CHECK_TIMEOUT_MS must be shorter than CHECK_INTERVAL_SECONDS');
  }
  return config;
}

export function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('targets must be a non-empty array of { name, url }');
  }
  const names = new Set();
  for (const target of targets) {
    if (typeof target?.name !== 'string' || target.name.trim() === '') {
      throw new Error(`Every target needs a name: ${JSON.stringify(target)}`);
    }
    if (names.has(target.name)) {
      throw new Error(`Duplicate target name: ${target.name}`);
    }
    names.add(target.name);

    let url;
    try {
      url = new URL(target.url);
    } catch {
      throw new Error(`Invalid URL for "${target.name}": ${target.url}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`URL for "${target.name}" must start with http:// or https://`);
    }
  }
  return targets;
}

function toPositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive whole number, got "${value}"`);
  }
  return n;
}
