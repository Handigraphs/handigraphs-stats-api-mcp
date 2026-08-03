import { spawnSync } from "node:child_process";

const KEYCHAIN_ACCOUNT = "handigraphs-stats-api";
const KEYCHAIN_SERVICE = "com.handigraphs.stats-api";
const KEY_PATTERN = /^hg_(?:test|live)_[A-Za-z0-9_-]{9,}$/;

function runAppleScript(source) {
  return spawnSync("/usr/bin/osascript", ["-e", source], {
    encoding: "utf8",
    maxBuffer: 16 * 1024,
  });
}

function showAlert(message, critical = false) {
  const style = critical ? " as critical" : " as informational";
  runAppleScript(`display alert "Handigraphs Stats API setup" message "${message}"${style} buttons {"OK"} default button "OK"`);
}

function promptForApiKey() {
  const result = runAppleScript([
    "set setupChoice to display dialog \"Create or copy your reveal-once Handigraphs Stats API key, then continue. The key will be entered in a masked local window and saved only in macOS Keychain.\"",
    "buttons {\"Cancel\", \"Open key page\", \"Continue\"} default button \"Continue\" cancel button \"Cancel\"",
    "with title \"Handigraphs Stats API setup\"",
    "if button returned of setupChoice is \"Open key page\" then open location \"https://handigraphs.com/account/api\"",
    "set keyResult to display dialog \"Paste your Handigraphs Stats API key. Test keys begin with hg_test_ and live keys begin with hg_live_.\"",
    "default answer \"\" with hidden answer buttons {\"Cancel\", \"Save\"} default button \"Save\" cancel button \"Cancel\"",
    "with title \"Handigraphs Stats API setup\"",
    "return text returned of keyResult",
  ].join(" "));
  if (result.status !== 0) return undefined;
  return result.stdout.trim();
}

function saveApiKey(apiKey) {
  const command = `add-generic-password -U -a ${KEYCHAIN_ACCOUNT} -s ${KEYCHAIN_SERVICE} -w ${apiKey}\n`;
  const result = spawnSync("/usr/bin/security", ["-i"], {
    input: command,
    encoding: "utf8",
    maxBuffer: 16 * 1024,
  });
  return result.status === 0;
}

function main() {
  if (process.platform !== "darwin") return 1;

  for (;;) {
    const candidate = promptForApiKey();
    if (candidate === undefined) return 0;
    if (!KEY_PATTERN.test(candidate)) {
      showAlert("Enter a valid key beginning with hg_test_ or hg_live_.", true);
      continue;
    }
    if (!saveApiKey(candidate)) {
      showAlert("The key could not be saved to macOS Keychain. No credential was changed.", true);
      return 1;
    }

    showAlert("Your key was saved securely in macOS Keychain. Fully quit and reopen Codex, then start a new task.");
    return 0;
  }
}

process.exitCode = main();
