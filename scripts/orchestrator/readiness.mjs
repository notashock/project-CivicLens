/**
 * Readiness prober that periodically checks an HTTP endpoint until it responds
 * successfully or times out.
 * 
 * @param {string} url The HTTP endpoint URL to probe (e.g. 'http://127.0.0.1:8000/health')
 * @param {object} [options]
 * @param {number} [options.timeoutMs=15000] Maximum total time to wait in milliseconds
 * @param {number} [options.intervalMs=300] Time between probes in milliseconds
 * @param {number} [options.requestTimeoutMs=1000] Timeout for each individual request
 * @param {function} [options.onPoll] Optional callback for each probe attempt
 * @returns {Promise<boolean>} Resolves to true when healthy, false if timed out
 */
export async function waitForHealth(url, options = {}) {
  const {
    timeoutMs = 15000,
    intervalMs = 300,
    requestTimeoutMs = 1000,
    onPoll = null,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

      const res = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return true;
      }
    } catch {
      // Endpoint is not up yet, continue polling
    }

    if (typeof onPoll === 'function') {
      onPoll(Date.now() - startTime);
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return false;
}
