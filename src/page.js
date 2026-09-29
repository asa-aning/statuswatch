// Renders the status page. Plain server-side HTML, no frontend framework.
// Every value from config or the network goes through escapeHtml().
export function renderPage(statuses, { refreshSeconds = 30, historySize = 60 } = {}) {
  const allUp = statuses.every((s) => s.state === 'up');
  const anyPending = statuses.some((s) => s.state === 'pending');
  const summary = anyPending ? 'Checking…' : allUp ? 'All systems operational' : 'Some systems are down';
  const summaryClass = anyPending ? 'pending' : allUp ? 'up' : 'down';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${refreshSeconds}">
<title>StatusWatch</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #fff; --text: #1a1d23; --muted: #6b7280; --border: #e5e7eb;
    --up: #16a34a; --down: #dc2626; --pending: #9ca3af; --empty: #e5e7eb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0f1115; --card: #181b21; --text: #e6e8eb; --muted: #9aa1ab; --border: #2a2f37;
      --up: #22c55e; --down: #ef4444; --pending: #6b7280; --empty: #2a2f37;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px; }
  h1 { font-size: 22px; margin: 0 0 16px; }
  .summary { padding: 14px 18px; border-radius: 10px; color: #fff; font-weight: 600; margin-bottom: 20px; }
  .summary.up { background: var(--up); } .summary.down { background: var(--down); }
  .summary.pending { background: var(--pending); }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          padding: 16px 18px; margin-bottom: 12px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .name { font-weight: 600; }
  .url { color: var(--muted); font-size: 13px; word-break: break-all; }
  .badge { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .badge.up { color: var(--up); } .badge.down { color: var(--down); } .badge.pending { color: var(--pending); }
  .bars { display: flex; gap: 2px; height: 28px; margin: 12px 0 8px; }
  .bars span { flex: 1; border-radius: 2px; background: var(--empty); }
  .bars .up { background: var(--up); } .bars .down { background: var(--down); }
  .meta { color: var(--muted); font-size: 13px; }
  .error { color: var(--down); font-size: 13px; margin-top: 4px; }
  footer { color: var(--muted); font-size: 12px; margin-top: 24px; }
</style>
</head>
<body>
<main>
  <h1>StatusWatch</h1>
  <div class="summary ${summaryClass}">${summary}</div>
  ${statuses.map((s) => renderTarget(s, historySize)).join('\n')}
  <footer>Refreshes every ${refreshSeconds}s · <a href="/api/status">JSON</a> · <a href="/metrics">metrics</a></footer>
</main>
</body>
</html>`;
}

function renderTarget(s, historySize) {
  const last = s.lastCheck;
  // Pad on the left with empty bars so the newest result is always on the right.
  const empty = Math.max(0, historySize - s.history.length);
  const bars = '<span></span>'.repeat(empty) + s.history.map((up) => `<span class="${up ? 'up' : 'down'}"></span>`).join('');

  const meta = last
    ? [
        last.statusCode ? `HTTP ${last.statusCode}` : null,
        `${last.responseTimeMs} ms`,
        s.uptimePercent !== null ? `${s.uptimePercent}% uptime (last ${s.history.length} checks)` : null,
        `checked ${new Date(last.checkedAt).toLocaleTimeString('en-GB')}`,
      ].filter(Boolean).join(' · ')
    : 'Waiting for first check';

  return `<div class="card">
    <div class="row">
      <div><div class="name">${escapeHtml(s.name)}</div><div class="url">${escapeHtml(s.url)}</div></div>
      <div class="badge ${s.state}">${s.state}</div>
    </div>
    <div class="bars" aria-hidden="true">${bars}</div>
    <div class="meta">${escapeHtml(meta)}</div>
    ${last && !last.up ? `<div class="error">${escapeHtml(last.error)}</div>` : ''}
  </div>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
