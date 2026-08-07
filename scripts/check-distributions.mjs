import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const packageManifest = await json("package.json");
const codexMarketplace = await json(".agents/plugins/marketplace.json");
const claudeMarketplace = await json(".claude-plugin/marketplace.json");
const pluginRoot = "plugins/handigraphs-stats-api";
const codexManifest = await json(`${pluginRoot}/.codex-plugin/plugin.json`);
const claudeManifest = await json(`${pluginRoot}/.claude-plugin/plugin.json`);
const codexMcp = await json(`${pluginRoot}/.mcp.json`);
const claudeMcp = await json(`${pluginRoot}/mcp.claude.json`);
const bundleManifest = await json("mcpb/manifest.json");
const skill = await readFile(`${pluginRoot}/skills/query-handigraphs-stats/SKILL.md`, "utf8");
const setupSkill = await readFile(`${pluginRoot}/skills/setup-handigraphs-stats-api/SKILL.md`, "utf8");
const macosSetup = await readFile(`${pluginRoot}/scripts/configure-macos.mjs`, "utf8");
const windowsSetup = await readFile(`${pluginRoot}/scripts/configure-windows.ps1`, "utf8");
const runtimeMacosSetup = await readFile("runtime/configure-macos.mjs", "utf8");
const runtimeWindowsSetup = await readFile("runtime/configure-windows.ps1", "utf8");
const credentialRuntime = await readFile("src/credentials.ts", "utf8");
const setupRuntime = await readFile("src/setup.ts", "utf8");
const versionRuntime = await readFile("src/version.ts", "utf8");
const liveAudit = await readFile("scripts/audit-live-sandbox.mjs", "utf8");

for (const manifest of [codexManifest, claudeManifest, bundleManifest]) {
  assert.equal(manifest.name, "handigraphs-stats-api");
  assert.equal(manifest.version, packageManifest.version);
  assert.match(manifest.description, /read-only local MCP server/i);
}

assert.equal(codexMarketplace.name, "handigraphs");
assert.equal(codexMarketplace.plugins[0]?.source?.path, "./plugins/handigraphs-stats-api");
assert.equal(claudeMarketplace.name, "handigraphs");
assert.equal(claudeMarketplace.plugins[0]?.source, "./plugins/handigraphs-stats-api");
assert.equal(claudeMarketplace.plugins[0]?.version, packageManifest.version);

assert.equal(codexManifest.mcpServers, "./.mcp.json");
assert.equal(claudeManifest.mcpServers, "./mcp.claude.json");
for (const config of [codexMcp, claudeMcp]) {
  const server = config.mcpServers?.["handigraphs-stats"];
  assert.equal(server?.command, "npx");
  assert.deepEqual(server?.args, ["-y", "@handigraphs/stats-api-mcp"]);
}
assert.deepEqual(codexMcp.mcpServers["handigraphs-stats"].env_vars, ["HANDIGRAPHS_API_KEY", "HANDIGRAPHS_API_BASE_URL"]);
assert.equal(codexMcp.mcpServers["handigraphs-stats"].env.HANDIGRAPHS_CODEX_SETUP, "1");

assert.equal(claudeManifest.userConfig?.api_key?.sensitive, true);
assert.equal(claudeManifest.userConfig?.api_key?.required, true);
assert.equal(claudeMcp.mcpServers["handigraphs-stats"].env.HANDIGRAPHS_API_KEY, "${user_config.api_key}");
assert.equal(bundleManifest.user_config?.api_key?.sensitive, true);
assert.equal(bundleManifest.server?.entry_point, "dist/index.js");
assert.equal(bundleManifest.server?.mcp_config?.env?.HANDIGRAPHS_API_KEY, "${user_config.api_key}");
assert.deepEqual(bundleManifest.tools.map(({ name }) => name).sort(), ["describe_resource", "list_resources", "query_stats"]);

assert.doesNotMatch(skill, /\[TODO|STATS_API_KEY_PEPPER|STATS_API_MODE|public\.api_keys|web\/backend/);
assert.match(skill, /^name: query-handigraphs-stats$/m);
assert.match(skill, /Never ask for or repeat a Stats API key in chat/);
assert.match(skill, /setup-handigraphs-stats-api/);
assert.match(setupSkill, /^name: setup-handigraphs-stats-api$/m);
assert.match(setupSkill, /Never ask the user to paste, type, upload, or repeat the API key in chat/);
assert.match(setupSkill, /configure-macos\.mjs/);
assert.match(setupSkill, /configure-windows\.ps1/);
assert.match(setupSkill, /Do not call `configure_api_key` as the normal Windows path/);
assert.match(setupSkill, /sandbox_permissions/);
assert.match(setupSkill, /require_escalated/);
assert.match(setupSkill, /private desktop/i);
assert.match(setupSkill, /Call the plugin MCP tool `configure_api_key` immediately/);
assert.match(macosSetup, /with hidden answer/);
assert.match(macosSetup, /spawnSync\("\/usr\/bin\/security", \["-i"\]/);
assert.match(macosSetup, /add-generic-password -U/);
assert.match(macosSetup, /hg_\(\?:test\|live\)_/);
assert.doesNotMatch(macosSetup, /spawnSync\("\/usr\/bin\/security", \["add-generic-password"/);
assert.doesNotMatch(macosSetup, /console\.(?:log|error)|process\.(?:stdout|stderr)\.write/);
assert.equal(runtimeMacosSetup, macosSetup);
assert.match(windowsSetup, /UseSystemPasswordChar\s*=\s*\$true/);
assert.match(windowsSetup, /StartsWith\("hg_test_"\)/);
assert.match(windowsSetup, /StartsWith\("hg_live_"\)/);
assert.match(windowsSetup, /hg_test_ or hg_live_/);
assert.match(windowsSetup, /handigraphs-sandbox-web-49829810d1bb\.herokuapp\.com\/api\/v1/);
assert.match(windowsSetup, /SetEnvironmentVariable\("HANDIGRAPHS_API_BASE_URL", \$apiBaseUrl, "User"\)/);
assert.match(windowsSetup, /SetEnvironmentVariable\("HANDIGRAPHS_API_KEY", \$candidate, "User"\)/);
assert.match(windowsSetup, /SendMessageTimeout/);
assert.match(windowsSetup, /exit 2/);
assert.doesNotMatch(windowsSetup, /Write-(?:Host|Output).*\$(?:candidate|apiKey|keyBox)/i);
assert.equal(runtimeWindowsSetup, windowsSetup);
assert.match(credentialRuntime, /find-generic-password/);
assert.match(credentialRuntime, /MACOS_KEYCHAIN_SERVICE/);
assert.doesNotMatch(credentialRuntime, /console\.(?:log|error)|process\.(?:stdout|stderr)\.write/);
assert.match(setupRuntime, /platform === "darwin"/);
assert.match(setupRuntime, /configure-macos\.mjs/);
assert.match(setupRuntime, /windowsHide:\s*false/);
assert.match(setupRuntime, /launchCheckMs:\s*1_000/);
assert.equal(codexManifest.interface.defaultPrompt[0], "Connect my Handigraphs account.");
assert.match(versionRuntime, new RegExp(`SERVER_VERSION\\s*=\\s*["']${packageManifest.version.replaceAll(".", "\\.")}["']`));
assert.match(liveAudit, /StdioClientTransport/);
assert.match(liveAudit, /HANDIGRAPHS_API_KEY must be a temporary sandbox hg_test_ key/);
assert.match(liveAudit, /live launch audit refuses non-sandbox HANDIGRAPHS_API_BASE_URL/);
assert.doesNotMatch(liveAudit, /hg_live_/);

const serialized = JSON.stringify({ codexMarketplace, claudeMarketplace, codexManifest, claudeManifest, codexMcp, claudeMcp, bundleManifest });
assert.doesNotMatch(serialized, /hg_(?:live|test)_[A-Za-z0-9_-]+/);
assert.match(serialized, /https:\/\/www\.handigraphs\.com\/privacy/);

process.stdout.write("distribution checks passed\n");
