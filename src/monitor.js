import { checkTarget } from './checker.js';

// Runs checks on a timer and remembers recent results for each target.
export class Monitor {
  #timer = null;

  constructor({
    targets,
    intervalSeconds = 60,
    timeoutMs = 10_000,
    historySize = 60,
    metrics = null,
    check = checkTarget,
    onStateChange = () => {},
  }) {
    this.targets = targets;
    this.intervalSeconds = intervalSeconds;
    this.timeoutMs = timeoutMs;
    this.historySize = historySize;
    this.metrics = metrics;
    this.check = check;
    this.onStateChange = onStateChange;
    this.history = new Map(targets.map((t) => [t.name, []]));
  }

  async runChecks() {
    await Promise.all(this.targets.map((target) => this.#checkOne(target)));
  }

  async #checkOne(target) {
    const result = await this.check(target, { timeoutMs: this.timeoutMs });
    const history = this.history.get(target.name);
    const previous = history.at(-1);

    history.push(result);
    if (history.length > this.historySize) history.shift();
    this.metrics?.record(target, result);

    // First check, or up→down / down→up. Phase 5 hooks alerts in here.
    if (!previous || previous.up !== result.up) {
      this.onStateChange(target, result, previous ?? null);
    }
  }

  start() {
    this.runChecks();
    this.#timer = setInterval(() => this.runChecks(), this.intervalSeconds * 1000);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = null;
  }

  getStatus() {
    return this.targets.map((target) => {
      const history = this.history.get(target.name);
      const last = history.at(-1) ?? null;
      const upCount = history.filter((r) => r.up).length;
      return {
        name: target.name,
        url: target.url,
        state: last ? (last.up ? 'up' : 'down') : 'pending',
        lastCheck: last,
        uptimePercent: history.length ? Math.round((upCount / history.length) * 1000) / 10 : null,
        history: history.map((r) => r.up),
      };
    });
  }
}
