// Fetch with a timeout and a small, careful retry loop.
// Retries only: timeouts, connection failures, and 429/500/502/503/504.
// Never retries 400/401/403/404 (the request is wrong) or writes (POST/PUT/PATCH/DELETE).

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, config = {}) {
  const { timeoutMs = 1500, retries = 2, delayMs = 200 } = config;
  const method = (options.method || "GET").toUpperCase();
  const maxRetries = method === "GET" ? retries : 0; // never retry writes

  for (let attempt = 0; ; attempt++) {
    let wait = delayMs * 2 ** attempt; // 200 ms, then 400 ms

    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!RETRY_STATUSES.has(res.status) || attempt >= maxRetries) return res;

      const retryAfter = Number(res.headers.get("Retry-After"));
      if (res.status === 429 && retryAfter > 0) {
        // Asked to wait longer than we are willing to? Retrying early would only break
        // their limit again, so hand the 429 back and let the caller use its saved copy.
        if (retryAfter * 1000 > 5000) return res;
        wait = retryAfter * 1000; // wait as asked (5 s or less)
      }
    } catch (err) {
      if (attempt >= maxRetries) throw err; // out of retries
    }

    console.warn(`attempt ${attempt + 1} failed, retrying in ${wait} ms`);
    await sleep(wait);
  }
}

module.exports = { fetchWithRetry };
