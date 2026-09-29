// Checks one website and reports whether it's up.
// Never throws: every failure becomes a { up: false, error } result.
export async function checkTarget(target, { timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);

  try {
    const res = await fetchImpl(target.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'StatusWatch/0.1' },
    });
    // We only need the status code, so don't download the page body.
    await res.body?.cancel();

    return {
      up: res.ok, // true for 200–299
      statusCode: res.status,
      responseTimeMs: elapsed(),
      error: res.ok ? null : `HTTP ${res.status}`,
      checkedAt,
    };
  } catch (err) {
    return {
      up: false,
      statusCode: null,
      responseTimeMs: elapsed(),
      error: describeError(err, timeoutMs),
      checkedAt,
    };
  }
}

function describeError(err, timeoutMs) {
  if (err.name === 'TimeoutError') return `Timed out after ${timeoutMs} ms`;
  const code = err.cause?.code;
  if (code === 'ENOTFOUND') return 'DNS lookup failed (domain not found)';
  if (code === 'ECONNREFUSED') return 'Connection refused';
  if (code) return `Network error (${code})`;
  return err.message;
}
