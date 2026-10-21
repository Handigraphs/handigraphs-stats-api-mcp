import type { IncomingMessage } from "node:http";
import type { HostedConfig } from "./hosted-config.js";
import { readJsonBody } from "./http.js";
import type { DenialWitnessAttempt } from "./hosted-witness.js";

const ACCESS_TYPE = "urn:ietf:params:oauth:token-type:access_token";
export class HostedFailure extends Error {
  constructor(readonly status: number, readonly code: string, readonly scope?: string) { super(code); }
}

export function metadataUrl(config: HostedConfig): string {
  return new URL("/.well-known/oauth-protected-resource/mcp", config.resource).href;
}

export function challenge(config: HostedConfig, error?: string, scope?: string): string {
  return `Bearer resource_metadata="${metadataUrl(config)}"${error ? `, error="${error}"` : ""}${scope ? `, scope="${scope}"` : ""}`;
}

export function subjectToken(request: IncomingMessage): string {
  // The issuer's opaque MCP tokens are 32 random bytes, base64url encoded.
  // Personal keys and website/delegation JWTs have no authentication path here.
  const header = request.headers.authorization;
  if (!header) throw new HostedFailure(401, "unauthorized");
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(header);
  if (!match) throw new HostedFailure(401, "invalid_token");
  return match[1]!;
}

export function serviceAuthorization(config: HostedConfig): string {
  return "Basic " + Buffer.from(encodeURIComponent(config.serviceClientId) + ":" + encodeURIComponent(config.serviceSecret)).toString("base64");
}

export async function exchangeToken(config: HostedConfig, subject: string, signal: AbortSignal,
  fetchImpl: typeof fetch = fetch, witness?: DenialWitnessAttempt): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(config.issuer + "/oauth/token", { method: "POST", redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(config.exchangeTimeoutMs)]),
      headers: { ...witness?.headers, Authorization: serviceAuthorization(config), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: subject,
        subject_token_type: ACCESS_TYPE, requested_token_type: ACCESS_TYPE, audience: config.apiBaseUrl, resource: config.apiBaseUrl }).toString() });
    const body = await readJsonBody(response, 16384);
    const data = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    if (response.status === 400 && data.error === "invalid_grant") {
      try { witness?.confirmInvalidGrant(response); } catch { /* Optional auditing cannot replace an invalid grant. */ }
      throw new HostedFailure(401, "invalid_token");
    }
    if (response.status === 400 && data.error === "invalid_scope") throw new HostedFailure(403, "insufficient_scope", "stats:read");
    if (!response.ok || response.status !== 200 || data.token_type !== "Bearer" || data.issued_token_type !== ACCESS_TYPE
      || typeof data.access_token !== "string" || data.access_token.length > 4096
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.access_token)
      || data.access_token === subject || !Number.isInteger(data.expires_in) || Number(data.expires_in) < 1 || Number(data.expires_in) > 60
      || typeof data.scope !== "string" || !validScopes(data.scope) || "refresh_token" in data) {
      throw new HostedFailure(503, "temporarily_unavailable");
    }
    return data.access_token;
  } catch (error) {
    if (error instanceof HostedFailure) throw error;
    // No upstream body, fetch error, Authorization value or locals reach logs.
    throw new HostedFailure(503, "temporarily_unavailable");
  }
}

function validScopes(value: string): boolean {
  const scopes = value.split(" ");
  return scopes.includes("stats:read") && new Set(scopes).size === scopes.length
    && scopes.every((scope) => ["stats:read", "filters:write", "research:run"].includes(scope));
}
