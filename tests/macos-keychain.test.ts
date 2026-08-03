import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { readMacosKeychainApiKey } from "../src/credentials.js";

test("macOS setup AppleScript compiles without opening a dialog", {
  skip: process.platform !== "darwin",
}, () => {
  const result = spawnSync(process.execPath, [
    "runtime/configure-macos.mjs",
    "--validate-applescript",
  ], {
    encoding: "utf8",
    maxBuffer: 16 * 1024,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr);
});

test("macOS helper storage is readable by the runtime Keychain loader", {
  skip: process.platform !== "darwin",
}, async () => {
  const suffix = randomUUID().replaceAll("-", "");
  const account = `handigraphs-stats-api-ci-${suffix}`;
  const service = `com.handigraphs.stats-api.ci.${suffix}`;
  const apiKey = `hg_test_ci_${suffix}`;
  const addCommand = `add-generic-password -U -a ${account} -s ${service} -w ${apiKey}\n`;

  try {
    const stored = spawnSync("/usr/bin/security", ["-i"], {
      input: addCommand,
      encoding: "utf8",
      maxBuffer: 16 * 1024,
    });
    assert.equal(stored.status, 0, "temporary Keychain item should be stored through stdin");
    assert.equal(await readMacosKeychainApiKey({ account, service }), apiKey);
  } finally {
    spawnSync("/usr/bin/security", [
      "delete-generic-password",
      "-a",
      account,
      "-s",
      service,
    ], {
      stdio: "ignore",
    });
  }
});
