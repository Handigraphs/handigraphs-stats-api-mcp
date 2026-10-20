import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import test from "node:test";
import { exchangeToken, HostedFailure, serviceAuthorization, subjectToken } from "../src/hosted-auth.js";
import { loadHostedConfig } from "../src/hosted-config.js";
import { redact } from "../src/redaction.js";

const env = { HANDIGRAPHS_HOSTED_ENABLED: "true", HANDIGRAPHS_MCP_RESOURCE_URL: "https://mcp.example.test/mcp",
  HANDIGRAPHS_OAUTH_ISSUER: "https://issuer.example.test", HANDIGRAPHS_MCP_SERVICE_CLIENT_ID: "gateway-test",
  HANDIGRAPHS_MCP_SERVICE_SECRET: "synthetic-independent-service-secret-only" };
const subject = "s".repeat(43);
const delegated = "e30.eyJzdWIiOiIxIn0.synthetic_signature";
const accessType = "urn:ietf:params:oauth:token-type:access_token";

test("hosted config is explicit, bounded, independent and production HTTPS only", () => {
  assert.throws(() => loadHostedConfig({}));
  const config = loadHostedConfig(env);
  assert.equal(config.apiBaseUrl, "https://issuer.example.test/api/v1");
  assert.equal(Object.isFrozen(config), true);
  for (const change of [
    { HANDIGRAPHS_MCP_RESOURCE_URL: "https://mcp.example.test/other" },
    { HANDIGRAPHS_OAUTH_ISSUER: "https://user:secret@issuer.test" },
    { HANDIGRAPHS_MCP_RESOURCE_URL: "https://mcp.test/mcp?credential=value" },
    { HANDIGRAPHS_OAUTH_ISSUER: "https://issuer.test/path" },
    { HANDIGRAPHS_HOSTED_MAX_BODY_BYTES: "131073" }, { HANDIGRAPHS_HOSTED_MAX_CONCURRENCY: "10000" },
    { HANDIGRAPHS_MCP_SERVICE_SECRET: "short" }, { HANDIGRAPHS_HOSTED_ALLOWED_HOSTS: "*" },
    { HANDIGRAPHS_HOSTED_ALLOWED_ORIGINS: "https://host.test/path" },
    { HANDIGRAPHS_API_KEY: env.HANDIGRAPHS_MCP_SERVICE_SECRET },
    { NODE_ENV: "production", HANDIGRAPHS_HOSTED_ALLOW_LOOPBACK: "true", HANDIGRAPHS_OAUTH_ISSUER: "http://127.0.0.1" },
    { DYNO: "web.1", HANDIGRAPHS_HOSTED_ALLOW_LOOPBACK: "true", HANDIGRAPHS_OAUTH_ISSUER: "http://127.0.0.1" },
  ]) assert.throws(() => loadHostedConfig({ ...env, ...change }));
});

test("only issuer opaque MCP credentials enter the exchange path", () => {
  const request = (value?: string) => ({ headers: value ? { authorization: value } : {} }) as IncomingMessage;
  assert.equal(subjectToken(request("Bearer " + subject)), subject);
  for (const value of [undefined, "Basic value", "Bearer hg_test_key", "Bearer e30.e30.signature", "Bearer " + subject + ",duplicate"]) {
    assert.throws(() => subjectToken(request(value)), HostedFailure);
  }
});

test("confidential exchange pins endpoint, audience, resource and no redirects without global mutation", async () => {
  const config = loadHostedConfig(env);
  const original = process.env.HANDIGRAPHS_API_KEY;
  let count = 0;
  const fetchImpl: typeof fetch = async (input, options) => {
    count++;
    assert.equal(String(input), config.issuer + "/oauth/token");
    assert.equal(options?.redirect, "manual");
    assert.equal(new Headers(options?.headers).get("authorization"), serviceAuthorization(config));
    const fields = new URLSearchParams(String(options?.body));
    assert.equal(fields.get("subject_token"), subject);
    assert.equal(fields.get("audience"), config.apiBaseUrl);
    assert.equal(fields.get("resource"), config.apiBaseUrl);
    assert.equal(fields.get("grant_type"), "urn:ietf:params:oauth:grant-type:token-exchange");
    assert.equal(fields.has("sub"), false);
    return Response.json({ access_token: delegated, token_type: "Bearer", issued_token_type: accessType, expires_in: 60, scope: "stats:read" });
  };
  for (let i = 0; i < 2; i++) assert.equal(await exchangeToken(config, subject, new AbortController().signal, fetchImpl), delegated);
  assert.equal(count, 2); assert.equal(process.env.HANDIGRAPHS_API_KEY, original);
});

test("exchange errors, invalid proofs, limits and outages are safe and never retried", async (t) => {
  const config = loadHostedConfig(env);
  const good = { access_token: delegated, token_type: "Bearer", issued_token_type: accessType, expires_in: 60, scope: "stats:read" };
  for (const [response, expected] of [
    [Response.json({ error: "invalid_grant", detail: subject }, { status: 400 }), 401],
    [Response.json({ error: "invalid_client" }, { status: 401 }), 503],
    [Response.json({ error: "invalid_scope" }, { status: 400 }), 403],
    [Response.json({}, { status: 429 }), 503], [Response.json({}, { status: 503 }), 503],
    [new Response(null, { status: 302, headers: { location: "https://foreign.test/steal" } }), 503],
    [Response.json({ ...good, expires_in: 600 }), 503], [Response.json({ ...good, refresh_token: "forbidden" }), 503],
    [Response.json({ ...good, scope: "admin" }), 503], [Response.json({ ...good, access_token: subject }), 503],
    [Response.json(good, { headers: { "content-length": "16385" } }), 503],
  ] as const) await t.test(String(expected), async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => { calls++; return response; };
    await assert.rejects(exchangeToken(config, subject, new AbortController().signal, fetchImpl), (error: unknown) => {
      assert.ok(error instanceof HostedFailure); assert.equal(error.status, expected);
      assert.equal(String(error).includes(subject), false); return true;
    });
    assert.equal(calls, 1);
  });
  await assert.rejects(exchangeToken(config, subject, new AbortController().signal,
    async () => { throw new Error(config.serviceSecret); }), { status: 503 });
});

test("redaction covers OAuth fields and every configured secret including encoded Basic", () => {
  const config = loadHostedConfig(env);
  const secrets = [subject, delegated, config.serviceSecret, serviceAuthorization(config)];
  const safe = JSON.stringify(redact({ url: "?value=" + subject, nested: secrets, authorization: "private",
    refresh_token: "private", subjectToken: "private", authorization_code: "private", cookie: "private" }, secrets));
  for (const secret of [...secrets, "private"]) assert.equal(safe.includes(secret), false);
});
