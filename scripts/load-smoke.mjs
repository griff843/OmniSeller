const base = process.env.LOAD_API_BASE ?? 'http://127.0.0.1:3001';
const secret = process.env.OMNISELLER_API_INTERNAL_SECRET;
const userId = process.env.LOAD_USER_ID;
if (!secret || !userId) throw new Error('OMNISELLER_API_INTERNAL_SECRET and LOAD_USER_ID are required');
const requests = Number(process.env.LOAD_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const samples = [];
let failures = 0;
let next = 0;
async function worker() {
  while (next < requests) {
    next += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${base}/inventory`, { headers: { 'x-omniseller-internal-secret': secret, 'x-omniseller-user-id': userId } });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch { failures += 1; }
    samples.push(performance.now() - started);
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
samples.sort((a, b) => a - b);
const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))];
const result = { requests, concurrency, failures, errorRate: failures / requests, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
console.log(JSON.stringify(result));
if (result.errorRate > 0.01 || result.p95Ms > 500) process.exitCode = 1;
