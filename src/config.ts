export interface Config {
  apiKey: string;
  baseUrl: URL;
  discoveryTtlMs: number;
  timeoutMs: number;
  maxResponseBytes: number;
}

const DEFAULT_BASE_URL = "https://handigraphs.com/api/v1";

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

export function validateBaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("HANDIGRAPHS_API_BASE_URL must be a valid absolute URL.");
  }
  if (url.username || url.password) {
    throw new Error("HANDIGRAPHS_API_BASE_URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("HANDIGRAPHS_API_BASE_URL must not contain a query or fragment.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
    throw new Error("HANDIGRAPHS_API_BASE_URL must use HTTPS (HTTP is allowed only for loopback tests).");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "/api/v1") {
    throw new Error("HANDIGRAPHS_API_BASE_URL must end at /api/v1.");
  }
  url.pathname = path;
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.HANDIGRAPHS_API_KEY?.trim();
  if (!apiKey) throw new Error("HANDIGRAPHS_API_KEY is required.");
  return {
    apiKey,
    baseUrl: validateBaseUrl(env.HANDIGRAPHS_API_BASE_URL ?? DEFAULT_BASE_URL),
    discoveryTtlMs: positiveInteger(env.HANDIGRAPHS_DISCOVERY_TTL_SECONDS, 300, "HANDIGRAPHS_DISCOVERY_TTL_SECONDS") * 1000,
    timeoutMs: positiveInteger(env.HANDIGRAPHS_HTTP_TIMEOUT_MS, 10_000, "HANDIGRAPHS_HTTP_TIMEOUT_MS"),
    maxResponseBytes: positiveInteger(env.HANDIGRAPHS_MAX_RESPONSE_BYTES, 5 * 1024 * 1024, "HANDIGRAPHS_MAX_RESPONSE_BYTES"),
  };
}

export function isSafeApiUrl(baseUrl: URL, candidate: URL): boolean {
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  return candidate.origin === baseUrl.origin
    && !candidate.username
    && !candidate.password
    && !candidate.hash
    && (candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`));
}
