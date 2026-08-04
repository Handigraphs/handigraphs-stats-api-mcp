import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { SERVER_VERSION } from "./version.js";

export interface SetupLaunchResult {
  status: "launched" | "completed" | "cancelled" | "unsupported";
  message: string;
}

export type SetupLauncher = () => Promise<SetupLaunchResult>;

export interface SetupLaunchSpec {
  command: string;
  args: string[];
  windowsHide: boolean;
  launchCheckMs: number;
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
      launchCheckMs: 0,
    };
  }

  if (platform === "darwin") {
    const scriptPath = fileURLToPath(new URL("../runtime/configure-macos.mjs", import.meta.url));
    return {
      command: process.execPath,
      args: [scriptPath],
      windowsHide: true,
      // AppleScript syntax and launch failures surface immediately. Give the
      // helper time to exit before claiming that its dialog opened, without
      // blocking the MCP call while the user creates or pastes a key.
      launchCheckMs: 1_000,
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

  const result = await new Promise<"spawned" | "completed" | "cancelled">((resolve, reject) => {
    let launchTimer: NodeJS.Timeout | undefined;
    const child = spawn(launch.command, launch.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: launch.windowsHide,
      env: childEnv,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      if (launch.launchCheckMs === 0) {
        child.unref();
        resolve("spawned");
        return;
      }
      launchTimer = setTimeout(() => {
        child.unref();
        resolve("spawned");
      }, launch.launchCheckMs);
    });
    if (launch.launchCheckMs > 0) {
      child.once("close", (code) => {
        if (launchTimer) clearTimeout(launchTimer);
        if (code === 0) resolve("completed");
        else if (code === 2) resolve("cancelled");
        else reject(new Error("The setup helper exited before saving the credential."));
      });
    }
  });

  if (result === "completed") {
    return {
      status: "completed",
      message: "Your Handigraphs API key was saved securely in macOS Keychain. Fully quit and reopen Codex, then start a new task.",
    };
  }

  if (result === "cancelled") {
    return {
      status: "cancelled",
      message: "Handigraphs setup was cancelled. No credential was changed.",
    };
  }

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
      restart_required: result.status === "launched" || result.status === "completed",
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
    { name: "handigraphs-stats-api", version: SERVER_VERSION },
    { instructions: "Handigraphs authentication is not configured. Call configure_api_key without asking the user to paste the key into chat." },
  );
  registerApiKeySetupTool(server, launcher);
  return server;
}
