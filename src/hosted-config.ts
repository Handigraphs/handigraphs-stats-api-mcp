import { validateBaseUrl, type Config } from "./config.js";

export interface HostedConfig {
  readonly resource: string;
  readonly issuer: string;
  readonly apiBaseUrl: string;
  readonly serviceClientId: string;
  readonly serviceSecret: string;
  readonly allowedHosts: readonly string[];
  readonly allowedOrigins: readonly string[];
  readonly port: number;
  readonly maxBodyBytes: number;
  readonly bodyTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly exchangeTimeoutMs: number;
  readonly maxConcurrentRequests: number;
}

function integer(value: string | undefined, fallback: number, maximum: number): number {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > maximum) throw new Error("Invalid hosted request limit.");
  return result;
}

export function loadHostedConfig(env: NodeJS.ProcessEnv = process.env): HostedConfig {
  if (env.HANDIGRAPHS_HOSTED_ENABLED !== "true") throw new Error("Hosted MCP is disabled.");
  const local = env.HANDIGRAPHS_HOSTED_ALLOW_LOOPBACK === "true" && env.NODE_ENV !== "production" && !env.DYNO;
  function url(raw: string | undefined): URL {
    if (!raw || /[\s\\]/.test(raw)) throw new Error("Invalid hosted URL configuration.");
    let parsed: URL;
    try { parsed = new URL(raw); } catch { throw new Error("Invalid hosted URL configuration."); }
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    if (parsed.username || parsed.password || parsed.search || parsed.hash
      || (parsed.protocol !== "https:" && !(local && loopback && parsed.protocol === "http:"))) {
      throw new Error("Hosted URLs require HTTPS without credentials, queries or fragments.");
    }
    return parsed;
  }
  const resource = url(env.HANDIGRAPHS_MCP_RESOURCE_URL);
  const issuer = url(env.HANDIGRAPHS_OAUTH_ISSUER);
  if (resource.pathname !== "/mcp" || issuer.pathname !== "/") throw new Error("Invalid hosted resource or issuer path.");
  const apiBase = validateBaseUrl(issuer.origin + "/api/v1");
  const serviceClientId = env.HANDIGRAPHS_MCP_SERVICE_CLIENT_ID ?? "";
  const serviceSecret = env.HANDIGRAPHS_MCP_SERVICE_SECRET ?? "";
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(serviceClientId)
    || Buffer.byteLength(serviceSecret) < 32 || Buffer.byteLength(serviceSecret) > 512 || /[\r\n]/.test(serviceSecret)
    || serviceSecret === env.HANDIGRAPHS_API_KEY) throw new Error("Invalid independent hosted service credential.");
  const hosts = [resource.host, ...(env.HANDIGRAPHS_HOSTED_ALLOWED_HOSTS?.split(",") ?? [])];
  if (hosts.some((host) => !host || !/^(?:[A-Za-z0-9.-]+|\[[0-9a-fA-F:]+\])(?::[0-9]{1,5})?$/.test(host))) {
    throw new Error("Invalid hosted Host allowlist.");
  }
  const origins = [resource.origin, ...(env.HANDIGRAPHS_HOSTED_ALLOWED_ORIGINS?.split(",") ?? [])];
  if (origins.some((origin) => url(origin).origin !== origin)) throw new Error("Hosted Origin allowlist requires exact origins.");
  return Object.freeze({ resource: resource.href, issuer: issuer.origin, apiBaseUrl: apiBase.href,
    serviceClientId, serviceSecret, allowedHosts: Object.freeze([...new Set(hosts.map((host) => host.toLowerCase()))]),
    allowedOrigins: Object.freeze([...new Set(origins)]), port: integer(env.PORT, 3000, 65535),
    maxBodyBytes: integer(env.HANDIGRAPHS_HOSTED_MAX_BODY_BYTES, 128 * 1024, 128 * 1024),
    bodyTimeoutMs: integer(env.HANDIGRAPHS_HOSTED_BODY_TIMEOUT_MS, 2000, 5000),
    requestTimeoutMs: integer(env.HANDIGRAPHS_HOSTED_REQUEST_TIMEOUT_MS, 15000, 30000),
    exchangeTimeoutMs: integer(env.HANDIGRAPHS_HOSTED_EXCHANGE_TIMEOUT_MS, 5000, 10000),
    maxConcurrentRequests: integer(env.HANDIGRAPHS_HOSTED_MAX_CONCURRENCY, 20, 100) });
}

export function requestConfig(config: HostedConfig, delegatedToken: string): Config {
  // The legacy Config field names the API-bound bearer. This fresh frozen
  // configuration is never shared, persisted, or used for public discovery.
  return Object.freeze({ apiKey: delegatedToken, baseUrl: new URL(config.apiBaseUrl),
    discoveryTtlMs: 300000, timeoutMs: 8000, maxResponseBytes: 5 * 1024 * 1024 });
}
