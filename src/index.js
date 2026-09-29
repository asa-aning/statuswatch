import { loadConfig } from './config.js';
import { createMetrics } from './metrics.js';
import { Monitor } from './monitor.js';
import { createServer } from './server.js';

const config = loadConfig();
const metrics = createMetrics();

const monitor = new Monitor({
  ...config,
  metrics,
  onStateChange(target, result, previous) {
    const state = result.up ? 'UP' : 'DOWN';
    const detail = result.up ? `${result.responseTimeMs} ms` : result.error;
    const verb = previous ? 'is now' : 'is';
    console.log(`[${result.checkedAt}] ${target.name} ${verb} ${state}: ${detail}`);
  },
});

const server = createServer({ monitor, metrics });

server.listen(config.port, () => {
  console.log(
    `StatusWatch running on http://localhost:${config.port} — ` +
      `checking ${config.targets.length} target(s) every ${config.intervalSeconds}s`,
  );
  monitor.start();
});

// Graceful shutdown. `docker stop` sends SIGTERM and waits 10 seconds
// before force-killing, so finish in-flight requests and exit cleanly.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  monitor.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
