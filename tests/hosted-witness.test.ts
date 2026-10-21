import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { request, type ServerResponse } from "node:http";
import test from "node:test";
import { exchangeToken, HostedFailure, serviceAuthorization } from "../src/hosted-auth.js";
import { loadHostedConfig } from "../src/hosted-config.js";
import { createHostedGateway } from "../src/hosted-index.js";
import { createDenialWitness, type DenialWitnessAttempt, type DenialWitnessEvent } from "../src/hosted-witness.js";

const PREFIX = "HANDIGRAPHS_MCP_DENIAL_WITNESS_";
const ID = "12345678-1234-4234-9234-123456789abc";
const OTHER_ID = "12345678-1234-4234-9234-123456789abd";
const RUN = "c".repeat(64);
const SECRET = "synthetic-independent-service-secret-not-a-run-reference";
const SUBJECT = "s".repeat(43);
const START = Date.parse("2026-10-21T12:00:00.000Z");
const NOW = START + 60000;
const env = { HANDIGRAPHS_HOSTED_ENABLED: "true", HEROKU_APP_NAME: "handigraphs-mcp-sandbox", NODE_ENV: "production",
  HANDIGRAPHS_MCP_RESOURCE_URL: "https://mcp-sandbox.handigraphs.com/mcp",
  HANDIGRAPHS_OAUTH_ISSUER: "https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com",
  HANDIGRAPHS_MCP_SERVICE_CLIENT_ID: "gateway-test", HANDIGRAPHS_MCP_SERVICE_SECRET: SECRET,
  [PREFIX + "ENABLED"]: "true", [PREFIX + "RUN_REF"]: RUN,
  [PREFIX + "STARTED_AT"]: "2026-10-21T12:00:00Z", [PREFIX + "UNTIL"]: "2026-10-21T16:00:00Z",
  [PREFIX + "EVENT_CAP"]: "2" };

function confirmation(attempt: DenialWitnessAttempt, changes: Record<string, string> = {}, status = 400) {
  return Response.json({ error: "invalid_grant" }, { status,
    headers: { ...attempt.headers, "X-Handigraphs-Acceptance-Witness": "revoked-grant-v1", ...changes } });
}

function fakeResponse(statusCode = 401, writableFinished = true, destroyed = false): ServerResponse {
  return Object.assign(new EventEmitter(), { statusCode, writableFinished, destroyed }) as unknown as ServerResponse;
}

test("optional witness is default-off, fixed-sandbox-only, strictly time/ref/cap bounded and nonfatal", async (t) => {
  const valid = loadHostedConfig(env);
  assert.ok(valid.denialWitness); assert.equal(Object.isFrozen(valid.denialWitness), true);
  assert.equal(valid.denialWitness.until - valid.denialWitness.startedAt, 4 * 60 * 60 * 1000);
  // Normal Heroku sandbox uses NODE_ENV=production; actual target identity wins.
  assert.ok(createDenialWitness(valid, { now: () => NOW }).begin());
  for (const change of [
    { [PREFIX + "ENABLED"]: undefined }, { [PREFIX + "ENABLED"]: "false" },
    { HEROKU_APP_NAME: undefined }, { HEROKU_APP_NAME: "handigraphs-mcp" },
    { HANDIGRAPHS_MCP_RESOURCE_URL: "https://mcp.handigraphs.com/mcp" },
    { HANDIGRAPHS_OAUTH_ISSUER: "https://www.handigraphs.com" },
    { [PREFIX + "RUN_REF"]: "C".repeat(64) }, { [PREFIX + "RUN_REF"]: "hg_live_synthetic" },
    { [PREFIX + "STARTED_AT"]: "2026-02-30T12:00:00Z" }, { [PREFIX + "STARTED_AT"]: "2026-10-21T12:00:00+00:00" },
    { [PREFIX + "UNTIL"]: "2026-10-21T16:00:00.001Z" }, { [PREFIX + "UNTIL"]: "2026-10-21T12:00:00Z" },
    { [PREFIX + "UNTIL"]: "invalid" }, { [PREFIX + "EVENT_CAP"]: "0" }, { [PREFIX + "EVENT_CAP"]: "101" },
    { [PREFIX + "EVENT_CAP"]: "1.5" }, { [PREFIX + "EVENT_CAP"]: "01" }, { [PREFIX + "EVENT_CAP"]: undefined },
    { HANDIGRAPHS_MCP_SERVICE_SECRET: RUN },
  ]) await t.test(JSON.stringify(Object.keys(change)), () => {
    const config = loadHostedConfig({ ...env, ...change });
    assert.equal(config.denialWitness, undefined);
    assert.equal(createDenialWitness(config, { now: () => NOW }).begin(), undefined);
  });
  for (const time of [START - 1, START + 4 * 60 * 60 * 1000, NaN]) {
    assert.equal(createDenialWitness(valid, { now: () => time }).begin(), undefined);
  }
  for (const value of ["incoming-client-id", ID.toUpperCase(), "12345678-1234-1234-9234-123456789abc"]) {
    assert.equal(createDenialWitness(valid, { now: () => NOW, uuid: () => value }).begin(), undefined);
  }
  assert.equal(createDenialWitness(valid, { now: () => NOW, uuid: () => { throw new Error(SECRET); } }).begin(), undefined);
  assert.equal(createDenialWitness(valid, { now: () => { throw new Error(SECRET); } }).begin(), undefined);
});

test("only exact authenticated invalid_grant confirmation can witness a completed401", async (t) => {
  for (const [changes, status] of [
    [{ "X-Handigraphs-Acceptance-Witness": "" }, 400],
    [{ "X-Handigraphs-Acceptance-Witness": "other" }, 400],
    [{ "X-Handigraphs-Acceptance-Request-Id": OTHER_ID }, 400],
    [{ "X-Handigraphs-Acceptance-Run-Ref": "d".repeat(64) }, 400],
    [{ "X-Handigraphs-Acceptance-Request-Id": ID + ", " + ID }, 400],
    [{}, 401], [{}, 403], [{}, 503],
  ] as const) await t.test("invalid confirmation", () => {
    const events: DenialWitnessEvent[] = [];
    const attempt = createDenialWitness(loadHostedConfig(env), { now: () => NOW, uuid: () => ID, emit: (event) => { events.push(event); } }).begin()!;
    attempt.confirmInvalidGrant(confirmation(attempt, changes, status));
    const response = fakeResponse(); attempt.observeDeniedResponse(response); response.emit("finish");
    assert.deepEqual(events, []);
  });
  for (const [status, finished, destroyed, event] of [
    [200, true, false, "finish"], [403, true, false, "finish"], [503, true, false, "finish"],
    [401, false, false, "finish"], [401, true, true, "finish"], [401, true, false, "close"],
  ] as const) await t.test("not a finished denial", () => {
    const events: DenialWitnessEvent[] = [];
    const attempt = createDenialWitness(loadHostedConfig(env), { now: () => NOW, uuid: () => ID, emit: (value) => { events.push(value); } }).begin()!;
    attempt.confirmInvalidGrant(confirmation(attempt));
    const response = fakeResponse(status, finished, destroyed); attempt.observeDeniedResponse(response);
    response.emit(event); if (event === "close") response.emit("finish");
    assert.deepEqual(events, []);
  });
});

test("confirmation stays request-local; finish-time TTL and event cap fail closed", () => {
  const events: DenialWitnessEvent[] = [];
  let time = NOW;
  let sequence = 0;
  const witness = createDenialWitness(loadHostedConfig(env), { now: () => time, uuid: () => sequence++ % 2 ? OTHER_ID : ID,
    emit: (event) => { events.push(event); } });
  const a = witness.begin()!, b = witness.begin()!, c = witness.begin()!, pending = witness.begin()!;
  assert.notEqual(a.headers["X-Handigraphs-Acceptance-Request-Id"], b.headers["X-Handigraphs-Acceptance-Request-Id"]);
  a.confirmInvalidGrant(confirmation(a));
  const rb = fakeResponse(); b.observeDeniedResponse(rb); rb.emit("finish");
  assert.equal(events.length, 0);
  const ra = fakeResponse(); a.observeDeniedResponse(ra); a.observeDeniedResponse(ra); ra.emit("finish"); ra.emit("finish");
  assert.equal(events.length, 1);
  c.confirmInvalidGrant(confirmation(c)); const rc = fakeResponse(); c.observeDeniedResponse(rc); rc.emit("finish");
  pending.confirmInvalidGrant(confirmation(pending)); const rp = fakeResponse(); pending.observeDeniedResponse(rp); rp.emit("finish");
  assert.equal(events.length, 2); assert.equal(witness.begin(), undefined);
  assert.deepEqual(events[0], { schema_version: 1, event: "hosted_mcp_denial_witness", run_ref: RUN, request_id: ID,
    status: 401, response_finished: true, observed_at: "2026-10-21T12:01:00.000Z" });
  assert.equal(Object.isFrozen(events[0]), true);
  const lateEvents: DenialWitnessEvent[] = [];
  const late = createDenialWitness(loadHostedConfig(env), { now: () => time, uuid: () => ID, emit: (value) => { lateEvents.push(value); } }).begin()!;
  late.confirmInvalidGrant(confirmation(late)); const response = fakeResponse(); late.observeDeniedResponse(response);
  time = START + 4 * 60 * 60 * 1000; response.emit("finish"); assert.deepEqual(lateEvents, []);
  time = NOW;
  const reversedEvents: DenialWitnessEvent[] = [];
  const reversed = createDenialWitness(loadHostedConfig(env), { now: () => time, uuid: () => ID, emit: (value) => { reversedEvents.push(value); } }).begin()!;
  reversed.confirmInvalidGrant(confirmation(reversed)); const rr = fakeResponse(); reversed.observeDeniedResponse(rr);
  time--; rr.emit("finish"); assert.deepEqual(reversedEvents, []);
});

test("exchange requires ordinary invalid_grant body as well as marker; failures never retry or leak", async () => {
  const config = loadHostedConfig(env);
  for (const [error, status, expected] of [["invalid_grant", 400, 401], ["invalid_scope", 400, 403], ["invalid_grant", 401, 503],
    ["temporarily_unavailable", 503, 503]] as const) {
    const events: DenialWitnessEvent[] = [];
    const attempt = createDenialWitness(config, { now: () => NOW, uuid: () => ID, emit: (event) => { events.push(event); } }).begin()!;
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      calls++; assert.equal(String(input), config.issuer + "/oauth/token"); assert.equal(init?.redirect, "manual");
      const headers = new Headers(init?.headers); assert.equal(headers.get("authorization"), serviceAuthorization(config));
      assert.equal(headers.get("x-handigraphs-acceptance-request-id"), ID);
      assert.equal(headers.get("x-handigraphs-acceptance-run-ref"), RUN);
      return Response.json({ error, detail: SUBJECT + SECRET }, { status,
        headers: { ...attempt.headers, "X-Handigraphs-Acceptance-Witness": "revoked-grant-v1" } });
    };
    await assert.rejects(exchangeToken(config, SUBJECT, new AbortController().signal, fetchImpl, attempt), (failure: unknown) => {
      assert.ok(failure instanceof HostedFailure); assert.equal(failure.status, expected);
      assert.equal(String(failure).includes(SECRET), false); return true;
    });
    const response = fakeResponse(expected); attempt.observeDeniedResponse(response); response.emit("finish");
    assert.equal(calls, 1); assert.equal(events.length, expected === 401 ? 1 : 0);
    const output = JSON.stringify(events);
    for (const secret of [SUBJECT, SECRET, serviceAuthorization(config), "detail", "grant_ref", "client_ref"]) assert.equal(output.includes(secret), false);
  }
  const brokenAudit: DenialWitnessAttempt = { headers: {},
    confirmInvalidGrant: () => { throw new Error(SECRET); }, observeDeniedResponse: () => undefined };
  await assert.rejects(exchangeToken(config, SUBJECT, new AbortController().signal,
    async () => Response.json({ error: "invalid_grant" }, { status: 400 }), brokenAudit), { status: 401, code: "invalid_token" });
});

async function localGateway(fetchImpl: typeof fetch, emit: (event: DenialWitnessEvent) => void | Promise<void>,
  extra: NodeJS.ProcessEnv = {}) {
  const config = loadHostedConfig({ ...env, ...extra });
  const host = createHostedGateway(config, { fetchImpl, witness: { now: () => NOW, emit } });
  host.server.listen(0, "127.0.0.1"); await once(host.server, "listening");
  const address = host.server.address(); assert.ok(address && typeof address !== "string");
  const port = address.port;
  function post(headers: Record<string, string> = {}, value: unknown = { jsonrpc: "2.0", id: 1, method: "tools/list" }) {
    return new Promise<{ status: number; headers: import("node:http").IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = request({ hostname: "127.0.0.1", port, path: "/mcp", method: "POST",
        headers: { Host: "mcp-sandbox.handigraphs.com", Authorization: "Bearer " + SUBJECT, "Content-Type": "application/json", ...headers } }, (res) => {
        let body = ""; res.on("data", (chunk) => { body += String(chunk); }); res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body }));
      }); req.on("error", reject); req.end(JSON.stringify(value));
    });
  }
  return { host, post };
}

test("real HTTP finish witnesses only server-generated IDs; incoming IDs and secret echoes never escape", async (t) => {
  const events: DenialWitnessEvent[] = [];
  const ids: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    const id = headers.get("x-handigraphs-acceptance-request-id")!; ids.push(id);
    return Response.json({ error: "invalid_grant", detail: SECRET + SUBJECT }, { status: 400, headers: {
      "X-Handigraphs-Acceptance-Witness": "revoked-grant-v1", "X-Handigraphs-Acceptance-Request-Id": id,
      "X-Handigraphs-Acceptance-Run-Ref": headers.get("x-handigraphs-acceptance-run-ref")! } });
  };
  const instance = await localGateway(fetchImpl, (value) => { events.push(value); }); t.after(() => instance.host.shutdown());
  const responses = await Promise.all([instance.post({ "X-Request-ID": ID, "X-Handigraphs-Acceptance-Request-Id": ID }),
    instance.post({ "X-Handigraphs-Acceptance-Run-Ref": SECRET })]);
  assert.equal(new Set(ids).size, 2); assert.equal(ids.includes(ID), false);
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.request_id).sort(), [...ids].sort());
  for (const response of responses) {
    assert.equal(response.status, 401); assert.deepEqual(JSON.parse(response.body), { error: "invalid_token" });
    assert.match(response.headers["www-authenticate"] ?? "", /invalid_token/);
    assert.equal(response.headers["x-handigraphs-acceptance-witness"], undefined);
  }
  const output = JSON.stringify({ events, responses });
  for (const value of [SUBJECT, SECRET, serviceAuthorization(loadHostedConfig(env)), "grant_ref", "client_ref"]) assert.equal(output.includes(value), false);
});

test("disabled, unknown marker, auth absence and sink failure leave ordinary HTTP denial unchanged", async (t) => {
  for (const mode of ["disabled", "unknown-marker", "throwing-sink", "rejecting-sink", "absent-auth", "bad-host"] as const) {
    await t.test(mode, async (t) => {
      const events: DenialWitnessEvent[] = [];
      let calls = 0;
      const fetchImpl: typeof fetch = async (_input, init) => {
        calls++; const headers = new Headers(init?.headers);
        if (mode === "disabled") assert.equal(headers.has("x-handigraphs-acceptance-request-id"), false);
        return Response.json({ error: "invalid_grant" }, { status: 400, headers: {
          "X-Handigraphs-Acceptance-Witness": mode === "unknown-marker" ? "other" : "revoked-grant-v1",
          "X-Handigraphs-Acceptance-Request-Id": headers.get("x-handigraphs-acceptance-request-id") ?? ID,
          "X-Handigraphs-Acceptance-Run-Ref": RUN } });
      };
      const instance = await localGateway(fetchImpl, (event) => {
        if (mode === "throwing-sink") throw new Error(SUBJECT);
        if (mode === "rejecting-sink") return Promise.reject(new Error(SECRET));
        events.push(event);
      }, mode === "disabled" ? { [PREFIX + "ENABLED"]: "false" } : {});
      t.after(() => instance.host.shutdown());
      const response = await instance.post(mode === "absent-auth" ? { Authorization: "" } : mode === "bad-host" ? { Host: "foreign.example.test" } : {});
      assert.equal(response.status, mode === "bad-host" ? 403 : 401);
      assert.equal(calls, mode === "absent-auth" || mode === "bad-host" ? 0 : 1);
      assert.deepEqual(events, []);
      assert.equal(response.body.includes(SECRET), false); assert.equal(response.body.includes(SUBJECT), false);
    });
  }
});

test("hosted SDK rejects excessive nested argument elements below the128KiB byte cap before private API calls", async (t) => {
  let exchanges = 0;
  const events: DenialWitnessEvent[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    assert.equal(String(input), env.HANDIGRAPHS_OAUTH_ISSUER + "/oauth/token"); exchanges++;
    return Response.json({ access_token: "e30.e30.synthetic_signature", token_type: "Bearer",
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token", expires_in: 60, scope: "stats:read" });
  };
  const instance = await localGateway(fetchImpl, (event) => { events.push(event); }); t.after(() => instance.host.shutdown());
  const value = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "query_stats",
    arguments: { sport: "mlb", resource: "batters", filters: Array.from({ length: 10001 }, () => ({})) } } };
  assert.ok(Buffer.byteLength(JSON.stringify(value)) < 128 * 1024);
  const response = await instance.post({ Accept: "application/json, text/event-stream" }, value);
  assert.equal(response.status, 200);
  const parsed = JSON.parse(response.body) as { result: { isError: boolean; content: Array<{ text: string }> } };
  assert.equal(parsed.result.isError, true);
  assert.match(parsed.result.content[0]!.text, /maximum of 10000 elements/);
  assert.equal(exchanges, 1); assert.deepEqual(events, []);
});
