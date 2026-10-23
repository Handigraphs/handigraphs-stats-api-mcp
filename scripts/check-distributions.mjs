import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export const HOSTED_PLUGIN = "handigraphs-stats-api-hosted";
export const HOSTED_SERVER = "handigraphs-stats-hosted";
export const HOSTED_RESOURCE = "https://mcp.handigraphs.com/mcp";
export const HOSTED_FILES = Object.freeze([
  ".codex-plugin/plugin.json", ".claude-plugin/plugin.json", ".mcp.json", "mcp.claude.json",
  "skills/query-handigraphs-stats/SKILL.md", "skills/query-handigraphs-stats/agents/openai.yaml",
  "skills/research-handigraphs-filters/SKILL.md", "skills/research-handigraphs-filters/agents/openai.yaml",
]);
const normalized = value => value.replaceAll("\r\n", "\n");
export function businessWorkflow(skill) {
  const parts = normalized(skill).split("## Shared business workflow\n");
  assert.equal(parts.length, 2, "skill must declare one shared business workflow");
  return parts[1];
}
export async function readHostedDistribution() {
  const root = `plugins/${HOSTED_PLUGIN}`;
  async function files(directory, prefix = "") {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "hosted package must not reference outside files");
      const path = prefix + entry.name;
      if (entry.isDirectory()) result.push(...await files(`${directory}/${entry.name}`, path + "/"));
      else { assert.ok(entry.isFile()); result.push(path); }
    }
    return result.sort();
  }
  const names = ["query-handigraphs-stats", "research-handigraphs-filters"];
  const skills = {};
  for (const name of names) skills[name] = {
    hosted: await readFile(`${root}/skills/${name}/SKILL.md`, "utf8"),
    local: await readFile(`plugins/handigraphs-stats-api/skills/${name}/SKILL.md`, "utf8"),
    interface: await readFile(`${root}/skills/${name}/agents/openai.yaml`, "utf8"),
  };
  return { version: (await json("package.json")).version, files: await files(root), skills,
    codexManifest: await json(`${root}/.codex-plugin/plugin.json`), claudeManifest: await json(`${root}/.claude-plugin/plugin.json`),
    codexMcp: await json(`${root}/.mcp.json`), claudeMcp: await json(`${root}/mcp.claude.json`),
    codexMarketplace: await json(".agents/plugins/marketplace.json"), claudeMarketplace: await json(".claude-plugin/marketplace.json") };
}
export function validateHostedDistribution(value) {
  const { codexManifest, claudeManifest, codexMcp, claudeMcp, codexMarketplace, claudeMarketplace } = value;
  assert.deepEqual(value.files, [...HOSTED_FILES].sort(), "hosted must contain only remote configs and two business skills");
  for (const manifest of [codexManifest, claudeManifest]) {
    const allowed = ["name", "version", "description", "author", "homepage", "repository", "license", "keywords", "skills", "mcpServers",
      manifest === codexManifest ? "interface" : "displayName"];
    assert.deepEqual(Object.keys(manifest).sort(), allowed.sort(), "unexpected hosted manifest field");
    assert.equal(manifest.name, HOSTED_PLUGIN); assert.equal(manifest.version, value.version);
    assert.equal(manifest.skills, "./skills/");
    assert.match(manifest.description, /unreleased.*candidate/i);
    assert.match(manifest.description, /not available or recommended/i);
    assert.match(manifest.description, /hosted_mcp_oauth PR-09.*explicit launch approval/);
    assert.equal(manifest.userConfig, undefined);
    assert.equal(manifest.hooks, undefined); assert.equal(manifest.commands, undefined);
  }
  assert.match(codexManifest.interface.displayName, /candidate/i);
  assert.match(claudeManifest.displayName, /candidate/i);
  assert.deepEqual(codexManifest.interface.capabilities, ["Read", "Write"]);
  assert.equal(codexManifest.mcpServers, "./.mcp.json"); assert.equal(claudeManifest.mcpServers, "./mcp.claude.json");
  // Deliberately no headers, env, fixed client credentials, scope overrides or
  // local process command. Browser OAuth/DCR is discovered by each client.
  const expected = { mcpServers: { [HOSTED_SERVER]: { type: "http", url: HOSTED_RESOURCE } } };
  assert.deepEqual(codexMcp, expected); assert.deepEqual(claudeMcp, expected);
  for (const marketplace of [codexMarketplace, claudeMarketplace]) {
    assert.deepEqual(marketplace.plugins.map(plugin => plugin.name), ["handigraphs-stats-api", HOSTED_PLUGIN]);
  }
  const codex = codexMarketplace.plugins[1]; const claude = claudeMarketplace.plugins[1];
  assert.deepEqual(codex.source, { source: "local", path: `./plugins/${HOSTED_PLUGIN}` });
  assert.deepEqual(codex.policy, { installation: "NOT_AVAILABLE", authentication: "ON_INSTALL" });
  assert.equal(codex.category, "Data"); assert.equal(claude.source, `./plugins/${HOSTED_PLUGIN}`);
  assert.equal(claude.version, value.version);
  assert.match(claude.description, /unreleased candidate.*not available or recommended/i);
  assert.match(claude.description, /hosted_mcp_oauth PR-09.*explicit launch approval/);
  assert.deepEqual(Object.keys(value.skills).sort(), ["query-handigraphs-stats", "research-handigraphs-filters"]);
  for (const [name, skill] of Object.entries(value.skills)) {
    assert.match(skill.hosted, new RegExp(`^name: ${name}$`, "m"));
    assert.equal(businessWorkflow(skill.hosted), businessWorkflow(skill.local), "local/hosted business rules must not drift");
    assert.match(skill.hosted, /handigraphs-stats-hosted/);
    assert.match(skill.hosted, /separate, pre-ticked\s+choice/);
    assert.match(skill.hosted, /never silently switch connections/i);
    assert.doesNotMatch(skill.hosted, /setup-handigraphs-stats-api|configure_api_key|user_config|HANDIGRAPHS_API_KEY/);
    assert.match(skill.interface, new RegExp(`\\$${name}`)); assert.match(skill.interface, /hosted candidate/);
  }
  const serialized = JSON.stringify({ codexManifest, claudeManifest, codexMcp, claudeMcp });
  assert.doesNotMatch(serialized, /user_config|HANDIGRAPHS_API_KEY|configure_api_key|setup-handigraphs|hg_(?:live|test)_|Bearer |clientSecret/);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const { agentReadTools } = await import("../dist/agent-read.js");
const { agentActionTools } = await import("../dist/agent-actions.js");
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
const researchSkill = await readFile(`${pluginRoot}/skills/research-handigraphs-filters/SKILL.md`, "utf8");
const researchInterface = await readFile(`${pluginRoot}/skills/research-handigraphs-filters/agents/openai.yaml`, "utf8");
const agentAudit = await readFile("scripts/audit-agent-sandbox.mjs", "utf8");

for (const manifest of [codexManifest, claudeManifest, bundleManifest]) {
  assert.equal(manifest.name, "handigraphs-stats-api");
  assert.equal(manifest.version, packageManifest.version);
  assert.match(manifest.description, /save bounded research through a local MCP server/i);
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
assert.deepEqual(bundleManifest.tools.map(({ name }) => name).sort(),
  ["describe_resource", "list_resources", "query_stats", ...agentReadTools.map(t => t.name), ...agentActionTools.map(t => t.name)].sort());
for (const tool of [...agentReadTools, ...agentActionTools]) {
  assert.equal(bundleManifest.tools.find(item => item.name === tool.name)?.description, tool.description);
}
assert.deepEqual(codexManifest.interface.capabilities, ["Read", "Write"]);
assert.match(researchSkill, /^name: research-handigraphs-filters$/m);
assert.doesNotMatch(researchSkill, /\[TODO|STATS_API_KEY_PEPPER|public\.api_keys|web\/backend/);
assert.match(researchInterface, /\$research-handigraphs-filters/);
assert.match(skill, /research-handigraphs-filters/);
assert.match(agentAudit, /StdioClientTransport/);
assert.match(agentAudit, /read-only/);

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

validateHostedDistribution(await readHostedDistribution());
process.stdout.write("local and candidate hosted distribution checks passed\n");
}
