#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { redact } from "./redaction.js";
import { createServer } from "./server.js";
import { createSetupServer } from "./setup.js";

async function main(): Promise<void> {
  const setupEnabled = process.env.HANDIGRAPHS_CODEX_SETUP === "1";
  const hasApiKey = Boolean(process.env.HANDIGRAPHS_API_KEY?.trim());
  const server = setupEnabled && !hasApiKey
    ? createSetupServer()
    : createServer(loadConfig(), { enableLocalSetup: setupEnabled });
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const apiKey = process.env.HANDIGRAPHS_API_KEY?.trim() ?? "";
  process.stderr.write(`Handigraphs Stats API MCP failed to start: ${JSON.stringify(redact(error, apiKey))}\n`);
  process.exitCode = 1;
});

export { loadConfig, validateBaseUrl } from "./config.js";
export { DiscoveryClient } from "./discovery.js";
export { parseRetryAfter } from "./errors.js";
export { StatsApiHttpClient } from "./http.js";
export { redact } from "./redaction.js";
export { createServer } from "./server.js";
export { createSetupServer, launchLocalApiKeySetup, registerApiKeySetupTool } from "./setup.js";
