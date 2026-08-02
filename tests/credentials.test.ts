import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedApiKey, resolveApiKey } from "../src/credentials.js";

test("environment key takes precedence on every platform", async () => {
  let keychainReads = 0;
  const apiKey = await resolveApiKey({
    env: { HANDIGRAPHS_API_KEY: "  hg_test_environment_example  " },
    platform: "darwin",
    readMacosKeychain: async () => {
      keychainReads += 1;
      return "hg_live_keychain_example";
    },
  });

  assert.equal(apiKey, "hg_test_environment_example");
  assert.equal(keychainReads, 0);
});

test("macOS falls back to Keychain when the environment key is absent", async () => {
  const apiKey = await resolveApiKey({
    env: {},
    platform: "darwin",
    readMacosKeychain: async () => "hg_live_keychain_example",
  });
  assert.equal(apiKey, "hg_live_keychain_example");
});

test("Windows and Linux do not read macOS Keychain", async () => {
  let keychainReads = 0;
  const readMacosKeychain = async (): Promise<string> => {
    keychainReads += 1;
    return "hg_live_keychain_example";
  };

  assert.equal(await resolveApiKey({ env: {}, platform: "win32", readMacosKeychain }), undefined);
  assert.equal(await resolveApiKey({ env: {}, platform: "linux", readMacosKeychain }), undefined);
  assert.equal(keychainReads, 0);
});

test("supported key validation accepts test and live URL-safe keys", () => {
  assert.equal(isSupportedApiKey("hg_test_abcdefghijk"), true);
  assert.equal(isSupportedApiKey("hg_live_abcDEF0123-_"), true);
  assert.equal(isSupportedApiKey("hg_stage_abcdefghijk"), false);
  assert.equal(isSupportedApiKey("hg_live_too short"), false);
});
