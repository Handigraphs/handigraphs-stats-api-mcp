import { spawn } from "node:child_process";

export const MACOS_KEYCHAIN_ACCOUNT = "handigraphs-stats-api";
export const MACOS_KEYCHAIN_SERVICE = "com.handigraphs.stats-api";

const MAX_KEYCHAIN_OUTPUT_BYTES = 16 * 1024;
const SUPPORTED_KEY_PATTERN = /^hg_(?:test|live)_[A-Za-z0-9_-]{9,}$/;

export type MacosKeychainReader = () => Promise<string | undefined>;

export interface ResolveApiKeyOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  readMacosKeychain?: MacosKeychainReader;
}

export function isSupportedApiKey(value: string): boolean {
  return SUPPORTED_KEY_PATTERN.test(value);
}

export async function readMacosKeychainApiKey(): Promise<string | undefined> {
  return await new Promise<string | undefined>((resolve, reject) => {
    const child = spawn("/usr/bin/security", [
      "find-generic-password",
      "-a",
      MACOS_KEYCHAIN_ACCOUNT,
      "-s",
      MACOS_KEYCHAIN_SERVICE,
      "-w",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let outputTooLarge = false;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 10_000);

    const collect = (target: Buffer[]) => (chunk: Buffer): void => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_KEYCHAIN_OUTPUT_BYTES) {
        outputTooLarge = true;
        child.kill();
        return;
      }
      target.push(chunk);
    };

    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.once("error", () => {
      clearTimeout(timeout);
      reject(new Error("The macOS Keychain credential could not be read."));
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error("The macOS Keychain credential read timed out."));
        return;
      }
      if (outputTooLarge) {
        reject(new Error("The macOS Keychain credential response was invalid."));
        return;
      }
      if (code !== 0) {
        const diagnostic = Buffer.concat(stderr).toString("utf8");
        if (code === 44 || /could not be found in the keychain/i.test(diagnostic)) {
          resolve(undefined);
          return;
        }
        reject(new Error("The macOS Keychain credential could not be read."));
        return;
      }

      const apiKey = Buffer.concat(stdout).toString("utf8").trim();
      if (!apiKey) {
        resolve(undefined);
        return;
      }
      if (!isSupportedApiKey(apiKey)) {
        reject(new Error("The Handigraphs API key stored in macOS Keychain is invalid. Run Connect my Handigraphs account again."));
        return;
      }
      resolve(apiKey);
    });
  });
}

export async function resolveApiKey(options: ResolveApiKeyOptions = {}): Promise<string | undefined> {
  const env = options.env ?? process.env;
  const environmentApiKey = env.HANDIGRAPHS_API_KEY?.trim();
  if (environmentApiKey) return environmentApiKey;

  const platform = options.platform ?? process.platform;
  if (platform !== "darwin") return undefined;

  const readKeychain = options.readMacosKeychain ?? readMacosKeychainApiKey;
  return await readKeychain();
}
