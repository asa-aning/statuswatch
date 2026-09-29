import client from 'prom-client';

// Prometheus metrics, served at /metrics. In phase 4, Prometheus will
// "scrape" (fetch) this page every few seconds and Grafana will graph it.
export function createMetrics({ defaultMetrics = true } = {}) {
  const registry = new client.Registry();

  // CPU, memory, event-loop lag etc. of the StatusWatch process itself.
  if (defaultMetrics) client.collectDefaultMetrics({ register: registry });

  const up = new client.Gauge({
    name: 'statuswatch_target_up',
    help: '1 if the last check of the target succeeded, 0 if it failed',
    labelNames: ['target'],
    registers: [registry],
  });

  const duration = new client.Histogram({
    name: 'statuswatch_check_duration_seconds',
    help: 'How long each check took',
    labelNames: ['target'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const checks = new client.Counter({
    name: 'statuswatch_checks_total',
    help: 'Number of checks run, by result',
    labelNames: ['target', 'result'],
    registers: [registry],
  });

  return {
    registry,
    record(target, result) {
      const labels = { target: target.name };
      up.set(labels, result.up ? 1 : 0);
      duration.observe(labels, result.responseTimeMs / 1000);
      checks.inc({ ...labels, result: result.up ? 'up' : 'down' });
    },
  };
}
