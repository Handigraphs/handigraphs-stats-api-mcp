// Fixed-sandbox operator harness. Private stdin/IPC only; never retain wire traces.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const children = [], ready = new Set();
let readyTimer, stage = 'input', observations = [], measurements = {};
function percentile(values, p) { return [...values].sort((a,b) => a-b)[Math.ceil(values.length*p)-1]; }
async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(input.confirm, 'ACCEPT_NHL_RESEARCH_COHORT_SANDBOX');
  assert.ok(Array.isArray(input.owners) && input.owners.length === 5);
  assert.equal(new Set(input.owners.map(owner => owner.marker)).size, 5);
  stage = 'authorization_barrier';
  let startAll, rejectAll;
  const barrier = new Promise((resolve, reject) => { startAll = resolve; rejectAll = reject; });
  readyTimer = setTimeout(() => rejectAll(new Error('cohort_not_ready')), 120000);
  const runs = input.owners.map(owner => new Promise((resolve, reject) => {
    assert.match(owner.marker, /^mcp_slate_[a-f0-9]{32}$/);
    const child = fork(fileURLToPath(new URL('./browser-oauth.mjs', import.meta.url)), [], { silent: true });
    children.push(child);
    let output = '', oversized = false;
    child.stdout.on('data', chunk => {
      output += String(chunk);
      if (Buffer.byteLength(output) > 131072) { oversized = true; child.kill(); }
    });
    // Child exceptions and browser logs may contain auth details. Do not forward them.
    child.stderr.resume();
    child.once('error', reject);
    child.on('message', message => {
      if (message?.event !== 'ready') return;
      ready.add(child.pid);
      if (ready.size === 5) { clearTimeout(readyTimer); startAll(); }
    });
    child.once('close', code => {
      try {
        assert.equal(oversized, false);
        const result = JSON.parse(output);
        // Remove registration identifiers; only safe result aggregates survive.
        const { client_ids: _ids, ...safe } = result;
        if (code !== 0 || !safe.passed) rejectAll(new Error('cohort_client_failed'));
        resolve(safe);
      } catch { reject(new Error('invalid_cohort_report')); }
    });
    child.stdin.end(JSON.stringify({ ...owner, confirm: 'ACCEPT_NHL_SLATE_SANDBOX',
      date: input.date, game_count: input.game_count, cohort_barrier: true }));
  }));
  // Attach rejection handlers while browsers are authorizing.
  const completed = Promise.all(runs);
  completed.catch(() => {});
  await barrier;
  stage = 'cohort_clients';
  for (const child of children) child.send({ event: 'go' });
  const results = observations = await completed;
  const cold = results.flatMap(result => result.results.filter(item => item.name === 'cohort_cold'));
  const warm = results.flatMap(result => result.results.filter(item => item.name === 'cohort_warm'));
  measurements = { cold_calls: cold.length, warm_calls: warm.length,
    cold_ms: cold.map(item => item.latency_ms), warm_ms: warm.map(item => item.latency_ms) };
  assert.ok(results.every(result => result.passed));
  stage = 'sample_counts';
  assert.equal(cold.length, 5); assert.equal(warm.length, 15);
  stage = 'cold_cache_evidence';
  assert.ok(cold.some(item => item.cache['brief-v2-context'] === 'miss'));
  assert.ok(cold.some(item => item.cache['brief-v2-history_skater'] === 'miss'));
  stage = 'payload_bounds';
  assert.ok([...cold, ...warm].every(item => item.bytes <= 32768));
  const coldP95 = percentile(cold.map(item => item.latency_ms), .95);
  const warmP95 = percentile(warm.map(item => item.latency_ms), .95);
  stage = 'latency_bounds';
  assert.ok(coldP95 < 6000 && warmP95 < 2000);
  return { passed: true, owners: 5, cold_calls: 5, warm_calls: 15, cold_p95_ms: coldP95,
    warm_p95_ms: warmP95, max_bytes: Math.max(...cold.map(item => item.bytes), ...warm.map(item => item.bytes)),
    clients: results, native_client_acceptance: false };
}
let output;
try { output = await main(); }
catch (error) { output = { passed: false, stage, failure_class: error.constructor.name,
  ready_owners: ready.size, measurements, clients: observations }; process.exitCode = 1; }
finally {
  clearTimeout(readyTimer);
  await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => {
    const timer = setTimeout(() => { child.kill(); resolve(); }, 10000);
    child.once('close', () => { clearTimeout(timer); resolve(); });
    if (child.connected) child.send({ event: 'abort' }); else child.kill();
  })));
}
process.stdout.write(JSON.stringify(output) + '\n');
