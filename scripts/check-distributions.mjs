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

const serialized = JSON.stringify({ codexMarketplace, claudeMarketplace, codexManifest, claudeManifest, codexMcp, claudeMcp, bundleManifest });
assert.doesNotMatch(serialized, /hg_(?:live|test)_[A-Za-z0-9_-]+/);
assert.match(serialized, /https:\/\/handigraphs\.com\/privacy/);

process.stdout.write("distribution checks passed\n");
