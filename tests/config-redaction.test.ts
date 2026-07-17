import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, validateBaseUrl } from "../src/config.js";
import { parseRetryAfter } from "../src/errors.js";
import { redact } from "../src/redaction.js";

test("configuration requires the environment key and safe API base URL", () => {
  assert.throws(() => loadConfig({}), /HANDIGRAPHS_API_KEY is required/);
  for (const value of [
    "http://handigraphs.com/api/v1", "https://key@handigraphs.com/api/v1",
    "https://handigraphs.com/api/v2", "https://handigraphs.com/api/v1?key=x",
  ]) assert.throws(() => validateBaseUrl(value));
  assert.equal(validateBaseUrl("http://127.0.0.1:1234/api/v1/").pathname, "/api/v1");
  assert.equal(loadConfig({ HANDIGRAPHS_API_KEY: "test" }).maxResponseBytes, 5 * 1024 * 1024);
  assert.throws(() => loadConfig({ HANDIGRAPHS_API_KEY: "test", HANDIGRAPHS_MAX_RESPONSE_BYTES: "0" }), /positive integer/);
});

test("redaction is recursive and normalizes prefixed and hyphenated auth-like fields", () => {
  const key = "hg_live_super_secret";
  const value = redact({
    nested: [{ authorization: `Bearer ${key}`, detail: `failed ${key}` }],
    access_token: "x",
    "X-Api-Key": "key-value",
    "Proxy-Authorization": "proxy-value",
    "request.headers.x-auth-token": "token-value",
    proxyAuthorization: "camel-value",
    harmless_header: "preserved",
  }, key) as Record<string, unknown>;
  const encoded = JSON.stringify(value);
  assert.equal(encoded.includes(key), false);
  assert.equal(encoded.includes("Bearer"), false);
  assert.equal(encoded.includes("key-value"), false);
  assert.equal(encoded.includes("proxy-value"), false);
  assert.equal(encoded.includes("token-value"), false);
  assert.equal(encoded.includes("camel-value"), false);
  assert.equal(value.harmless_header, "preserved");
  assert.match(encoded, /REDACTED/);
});

test("Retry-After supports delta seconds and HTTP dates", () => {
  assert.deepEqual(parseRetryAfter("12", 0), { retry_after_seconds: 12, retry_at: "1970-01-01T00:00:12.000Z" });
  assert.deepEqual(parseRetryAfter("Thu, 01 Jan 1970 00:00:20 GMT", 10_000), { retry_after_seconds: 10, retry_at: "1970-01-01T00:00:20.000Z" });
  assert.deepEqual(parseRetryAfter("invalid", 0), {});
});
