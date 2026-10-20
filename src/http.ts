import { isSafeApiUrl, type Config } from "./config.js";
import { parseRetryAfter, ToolInputError, UpstreamError, type SafeProblem } from "./errors.js";

export type RequestOptions =
  | { method: "GET"; protectedData: boolean; etag?: string; body?: never; ifMatch?: never; idempotencyKey?: never }
  | { method: "POST" | "PUT"; protectedData: true; body: Record<string, unknown>; etag?: never; ifMatch?: string; idempotencyKey?: string }
  | { method: "POST"; protectedData: true; body: null; etag?: never; ifMatch?: never; idempotencyKey?: never };

function encodeBody(body: Record<string, unknown>): string {
  let encoded: string;
  try {
    encoded = JSON.stringify(body, (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value)) throw new Error();
      return value;
    });
  } catch { throw new ToolInputError("Request body must contain finite JSON values."); }
  if (!encoded || Buffer.byteLength(encoded, "utf8") > 65536) {
    throw new ToolInputError("Request body exceeds the 64 KiB limit.");
  }
  return encoded;
}

export interface JsonResponse {
  json: Record<string, unknown>;
  status: number;
  etag: string | null;
  metadata: Record<string, unknown>;
}

function safeMetadata(response: Response): Record<string, unknown> {
  const retry = parseRetryAfter(response.headers.get("retry-after"));
  const entries: Array<[string, string | null]> = [
    ["request_id", response.headers.get("x-request-id")],
    ["quota_minute_limit", response.headers.get("x-ratelimit-limit-minute")],
    ["quota_minute_remaining", response.headers.get("x-ratelimit-remaining-minute")],
    ["quota_minute_reset_seconds", response.headers.get("x-ratelimit-reset-minute")],
    ["quota_day_limit", response.headers.get("x-ratelimit-limit-day")],
    ["quota_day_remaining", response.headers.get("x-ratelimit-remaining-day")],
    ["quota_day_reset_seconds", response.headers.get("x-ratelimit-reset-day")],
    ["cache", response.headers.get("x-stats-api-cache")],
  ];
  return {
    status: response.status,
    ...Object.fromEntries(entries.filter(([, value]) => value !== null)),
    ...retry,
  };
}

function safeProblemBody(value: unknown, response: Response): SafeProblem {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const requestId = typeof body.request_id === "string" ? body.request_id : response.headers.get("x-request-id") ?? undefined;
  const detail = typeof body.detail === "string"
    ? body.detail
    : `Handigraphs Stats API returned HTTP ${response.status}.`;
  const code = typeof body.code === "string" ? body.code : "upstream_error";
  return {
    status: response.status,
    code,
    detail,
    ...(body.field_errors && typeof body.field_errors === "object" ? { field_errors: body.field_errors } : {}),
    ...(requestId ? { request_id: requestId } : {}),
    ...parseRetryAfter(response.headers.get("retry-after")),
  };
}

function responseTooLarge(): UpstreamError {
  return new UpstreamError({
    status: 502,
    code: "upstream_response_too_large",
    detail: "The Handigraphs Stats API response exceeded the configured size limit.",
  });
}

export async function readJsonBody(response: Response, maxBytes: number): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw responseTooLarge();
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json") || !response.body) return undefined;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw responseTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

export class StatsApiHttpClient {
  constructor(private readonly config: Config, private readonly fetchImpl: typeof fetch = fetch,
    private readonly signal?: AbortSignal) {}

  resolve(pathOrUrl: string): URL {
    const candidate = pathOrUrl === ""
      ? new URL(this.config.baseUrl.href)
      : new URL(pathOrUrl, `${this.config.baseUrl.href}/`);
    if (!isSafeApiUrl(this.config.baseUrl, candidate)) {
      throw new Error("Rejected an unsafe or cross-origin Stats API URL.");
    }
    return candidate;
  }

  async get(pathOrUrl: string, options: { protectedData: boolean; etag?: string } ): Promise<JsonResponse | { notModified: true }> {
    return this.request(pathOrUrl, { ...options, method: "GET" });
  }

  async request(pathOrUrl: string, options: RequestOptions): Promise<JsonResponse | { notModified: true }> {
    const url = this.resolve(pathOrUrl);
    if (!["GET", "POST", "PUT"].includes(options.method)) throw new ToolInputError("Unsupported HTTP method.");
    if (options.method === "GET" && (options.body !== undefined || options.ifMatch !== undefined || options.idempotencyKey !== undefined)) {
      throw new ToolInputError("GET requests cannot contain a body or write headers.");
    }
    const emptyPost = options.method === "POST" && options.body === null && options.ifMatch === undefined && options.idempotencyKey === undefined;
    if (options.method !== "GET" && (!options.protectedData || options.etag !== undefined || (!emptyPost && (!options.body || typeof options.body !== "object" || Array.isArray(options.body))))) {
      throw new ToolInputError("Typed JSON requests require protected data and an object body.");
    }
    const headers = new Headers({ Accept: "application/json, application/problem+json" });
    if (options.protectedData) headers.set("Authorization", `Bearer ${this.config.apiKey}`);
    for (const [name, value] of [["If-None-Match", options.etag], ["If-Match", options.ifMatch], ["Idempotency-Key", options.idempotencyKey]]) {
      if (value !== undefined) {
        if (!value || value.length > 256 || /[\r\n]/.test(value)) throw new ToolInputError("Invalid conditional request header.");
        headers.set(name!, value);
      }
    }
    const body = options.method === "GET" || options.body === null ? undefined : encodeBody(options.body);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: options.method,
        headers,
        ...(body === undefined ? {} : { body }),
        redirect: "manual",
        signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(this.config.timeoutMs)]) : AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      const detail = error instanceof Error && error.name === "TimeoutError"
        ? "The Handigraphs Stats API request timed out."
        : "The Handigraphs Stats API could not be reached.";
      throw new UpstreamError({ status: 503, code: "upstream_unavailable", detail });
    }
    if (response.status === 304) {
      if (options.method === "GET" && options.etag) return { notModified: true };
      throw new UpstreamError({ status: 502, code: "invalid_upstream_response", detail: "Unexpected conditional response from Handigraphs." });
    }
    if (response.status >= 300 && response.status < 400) {
      throw new UpstreamError({ status: 502, code: "unsafe_redirect", detail: "The Handigraphs Stats API returned a redirect, which was not followed." });
    }

    let parsed: unknown;
    try {
      parsed = await readJsonBody(response, this.config.maxResponseBytes);
    } catch (error) {
      if (error instanceof UpstreamError) throw error;
      throw new UpstreamError({ status: 503, code: "upstream_unavailable", detail: "The Handigraphs Stats API response could not be read." });
    }
    if (!response.ok) throw new UpstreamError(safeProblemBody(parsed, response));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new UpstreamError({ status: 502, code: "invalid_upstream_response", detail: "The Handigraphs Stats API returned an invalid JSON response." });
    }
    return {
      json: parsed as Record<string, unknown>,
      status: response.status,
      etag: response.headers.get("etag"),
      metadata: safeMetadata(response),
    };
  }
}
