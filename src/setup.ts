import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface SetupLaunchResult {
  status: "launched" | "unsupported";
  message: string;
}

export type SetupLauncher = () => Promise<SetupLaunchResult>;

export interface SetupLaunchSpec {
  command: string;
  args: string[];
  windowsHide: boolean;
}

export function getSetupLaunchSpec(platform: NodeJS.Platform = process.platform): SetupLaunchSpec | undefined {
  if (platform === "win32") {
    const scriptPath = fileURLToPath(new URL("../runtime/configure-windows.ps1", import.meta.url));
    return {
      command: "powershell.exe",
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
      ],
      // Hiding the PowerShell process also hides its WinForms setup dialog.
      windowsHide: false,
    };
  }

  if (platform === "darwin") {
    const scriptPath = fileURLToPath(new URL("../runtime/configure-macos.mjs", import.meta.url));
    return {
      command: process.execPath,
      args: [scriptPath],
      windowsHide: true,
    };
  }

  return undefined;
}

export async function launchLocalApiKeySetup(): Promise<SetupLaunchResult> {
  const launch = getSetupLaunchSpec();
  if (!launch) {
    return {
      status: "unsupported",
      message: "Automatic setup is available on Windows and macOS. Open https://handigraphs.com/developers#mcp for the Linux setup steps.",
    };
  }

  const scriptPath = launch.args.at(-1);
  if (!scriptPath) throw new Error("The setup helper path is missing.");
  await access(scriptPath);

  const childEnv = { ...process.env };
  delete childEnv.HANDIGRAPHS_API_KEY;
  delete childEnv.HANDIGRAPHS_API_BASE_URL;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(launch.command, launch.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: launch.windowsHide,
      env: childEnv,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });

  return {
    status: "launched",
    message: "A secure Handigraphs setup window opened. Create or copy your key there, paste it into the masked field, and save it. On macOS the key is stored in Keychain; on Windows it is stored as a user environment variable. Test keys use the sandbox API and live keys use production. Then fully quit and reopen Codex.",
  };
}

function setupResult(result: SetupLaunchResult): CallToolResult {
  return {
    content: [{ type: "text", text: result.message }],
    structuredContent: {
      status: result.status,
      secret_received_by_model: false,
      restart_required: result.status === "launched",
    },
  };
}

export function registerApiKeySetupTool(server: McpServer, launcher: SetupLauncher = launchLocalApiKeySetup): void {
  server.registerTool("configure_api_key", {
    title: "Connect Handigraphs account",
    description: "Open the secure local Handigraphs API-key setup window. Call this without asking for the key in chat or passing it as an argument.",
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async () => {
    try {
      return setupResult(await launcher());
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: "The secure setup window could not be opened. Use the fallback instructions at https://handigraphs.com/developers#mcp; never paste the key into chat." }],
        structuredContent: { status: "launch_failed", secret_received_by_model: false },
      };
    }
  });
}

export function createSetupServer(launcher: SetupLauncher = launchLocalApiKeySetup): McpServer {
  const server = new McpServer(
    { name: "handigraphs-stats-api", version: "0.2.1" },
    { instructions: "Handigraphs authentication is not configured. Call configure_api_key without asking the user to paste the key into chat." },
  );
  registerApiKeySetupTool(server, launcher);
  return server;
}
