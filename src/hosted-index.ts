#!/usr/bin/env node
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { DiscoveryClient } from "./discovery.js";
import { StatsApiHttpClient } from "./http.js";
import { loadHostedConfig, requestConfig, type HostedConfig } from "./hosted-config.js";
import { challenge, exchangeToken, HostedFailure, serviceAuthorization, subjectToken } from "./hosted-auth.js";
import { redactCredentialEchoes } from "./redaction.js";
import { createServer } from "./server.js";
import { SERVER_VERSION } from "./version.js";
import { createDenialWitness, type DenialWitnessAttempt, type DenialWitnessDependencies } from "./hosted-witness.js";

export interface HostedDependencies { fetchImpl?: typeof fetch; witness?: DenialWitnessDependencies; }

function json(response: ServerResponse, status: number, value: unknown): void {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "Connection": "close" });
  response.end(JSON.stringify(value));
}

function trusted(request: IncomingMessage, config: HostedConfig): boolean {
  const host = request.headers.host;
  const origin = request.headers.origin;
  return typeof host === "string" && config.allowedHosts.includes(host.toLowerCase())
    && (origin === undefined || config.allowedOrigins.includes(origin));
}

async function body(request: IncomingMessage, config: HostedConfig, signal: AbortSignal): Promise<unknown> {
  if ((request.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
    || request.headers["content-encoding"] && request.headers["content-encoding"] !== "identity") {
    throw new HostedFailure(415, "unsupported_media_type");
  }
  if (Number(request.headers["content-length"] ?? 0) > config.maxBodyBytes) throw new HostedFailure(413, "request_too_large");
  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const timer = setTimeout(() => fail(new HostedFailure(408, "request_timeout")), config.bodyTimeoutMs);
    function clean() {
      clearTimeout(timer); request.off("data", data); request.off("end", end); request.off("error", error);
      signal.removeEventListener("abort", aborted);
    }
    function fail(error: HostedFailure) { clean(); reject(error); }
    function data(chunk: Buffer) {
      length += chunk.length;
      if (length > config.maxBodyBytes) { fail(new HostedFailure(413, "request_too_large")); return; }
      chunks.push(chunk);
    }
    function end() { clean(); resolve(Buffer.concat(chunks, length)); }
    function error() { fail(new HostedFailure(400, "invalid_request")); }
    function aborted() { fail(new HostedFailure(503, "temporarily_unavailable")); }
    request.on("data", data); request.once("end", end); request.once("error", error);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
  try {
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    // No batches: one bounded protocol message per authentication/admission slot.
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch { throw new HostedFailure(400, "invalid_request"); }
}

/** One gateway can span many users; only unauthenticated discovery is shared. */
export function createHostedGateway(config: HostedConfig, dependencies: HostedDependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const denialWitness = createDenialWitness(config, dependencies.witness);
  const discoveryLifetime = new AbortController();
  const publicDiscovery = new DiscoveryClient(new StatsApiHttpClient(requestConfig(config, ""), fetchImpl, discoveryLifetime.signal), 300000);
  const active = new Map<AbortController, Promise<void>>();
  let draining = false;
  let inFlight = 0;

  async function handle(request: IncomingMessage, response: ServerResponse, controller: AbortController): Promise<void> {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    if (!trusted(request, config)) { json(response, 403, { error: "forbidden" }); return; }
    if (request.method === "GET" && request.url === "/health/live") { json(response, 200, { live: true }); return; }
    if (request.method === "GET" && request.url === "/health/ready") {
      json(response, draining ? 503 : 200, { ready: !draining, stateless: true, version: SERVER_VERSION }); return;
    }
    if (request.method === "GET" && request.url === "/.well-known/oauth-protected-resource/mcp") {
      json(response, 200, { resource: config.resource, authorization_servers: [config.issuer],
        scopes_supported: ["stats:read", "filters:write", "research:run"], bearer_methods_supported: ["header"] }); return;
    }
    if (request.url !== "/mcp") { json(response, 404, { error: "not_found" }); return; }
    if (draining || inFlight >= config.maxConcurrentRequests) {
      response.setHeader("Retry-After", "1"); json(response, 503, { error: "temporarily_unavailable" }); return;
    }
    inFlight++;
    let admitted = true;
    const release = () => { if (admitted) { admitted = false; inFlight--; } };
    response.once("finish", release); response.once("close", release);
    const timer = setTimeout(() => {
      controller.abort(); json(response, 503, { error: "temporarily_unavailable" });
    }, config.requestTimeoutMs);
    const disconnected = () => { if (!response.writableEnded) controller.abort(); };
    response.once("close", disconnected);
    let mcp: ReturnType<typeof createServer> | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    let witness: DenialWitnessAttempt | undefined;
    try {
      const subject = subjectToken(request);
      const parsed = request.method === "POST" ? await body(request, config, controller.signal) : undefined;
      witness = denialWitness.begin();
      const delegated = await exchangeToken(config, subject, controller.signal, fetchImpl, witness);
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST"); json(response, 405, { error: "method_not_allowed" }); return;
      }
      const secrets = [subject, delegated, config.serviceSecret, encodeURIComponent(config.serviceSecret), serviceAuthorization(config),
        serviceAuthorization(config).slice(6)];
      let authorizationFailure: HostedFailure | undefined;
      const privateFetch: typeof fetch = async (input, init) => {
        const result = await fetchImpl(input, init);
        if (new Headers(init?.headers).has("Authorization")) {
          if (result.status === 401) authorizationFailure = new HostedFailure(401, "invalid_token");
          if (result.status === 403 && result.headers.get("www-authenticate")?.includes('error="insufficient_scope"')) {
            const scope = /scope="(filters:write|research:run|stats:read)"/.exec(result.headers.get("www-authenticate")!)?.[1];
            authorizationFailure = new HostedFailure(403, "insufficient_scope", scope);
          }
        }
        return result;
      };
      // SDK tools retain the same result contracts. If the API rejects the
      // delegated credential, preserve its HTTP authentication status as well;
      // the JSON-only SDK writes headers only after the tool finishes.
      const writeHead = response.writeHead;
      response.writeHead = ((status: number, ...args: unknown[]) => {
        if (authorizationFailure) {
          status = authorizationFailure.status;
          response.setHeader("WWW-Authenticate", challenge(config, authorizationFailure.code, authorizationFailure.scope));
        }
        return Reflect.apply(writeHead, response, [status, ...args]);
      }) as typeof response.writeHead;
      mcp = createServer(requestConfig(config, delegated), { publicDiscovery, fetchImpl: privateFetch,
        signal: controller.signal, redactionSecrets: secrets, maxToolInputElements: 10000 });
      transport = new StreamableHTTPServerTransport({ enableJsonResponse: true, maxRequestBodySize: config.maxBodyBytes });
      const send = transport.send.bind(transport);
      transport.send = (message, options) => send(redactCredentialEchoes(message, secrets), options);
      // SDK 1.x's accessor declarations include undefined, whereas its
      // Transport optional callbacks omit it under exactOptionalPropertyTypes.
      // The SDK itself implements Transport and installs these callbacks here.
      await mcp.connect(transport as Transport);
      await Promise.race([transport.handleRequest(request, response, parsed), new Promise<void>((resolve) => {
        response.once("finish", resolve); response.once("close", resolve);
      })]);
    } catch (error) {
      const failure = error instanceof HostedFailure ? error : new HostedFailure(503, "temporarily_unavailable");
      if (failure.status === 401 || failure.code === "insufficient_scope") {
        response.setHeader("WWW-Authenticate", challenge(config, failure.code === "unauthorized" ? undefined : failure.code, failure.scope));
      }
      if (failure.status === 503) response.setHeader("Retry-After", "1");
      if (failure.status === 401) witness?.observeDeniedResponse(response);
      json(response, failure.status, { error: failure.code });
    } finally {
      release(); response.off("finish", release); response.off("close", release);
      clearTimeout(timer); response.off("close", disconnected); controller.abort();
      await transport?.close().catch(() => undefined); await mcp?.close().catch(() => undefined);
      request.resume();
    }
  }

  const server = createHttpServer({ maxHeaderSize: 16384 }, (request, response) => {
    const controller = new AbortController();
    const task = handle(request, response, controller).catch(() => {
      // Never log request/error objects from a credential-bearing boundary.
      if (!response.headersSent) json(response, 503, { error: "temporarily_unavailable" }); else response.destroy();
    }).finally(() => active.delete(controller));
    active.set(controller, task);
  });
  server.headersTimeout = 5000;
  server.requestTimeout = config.requestTimeoutMs;
  server.maxRequestsPerSocket = 100;
  server.on("clientError", (_error, socket) => { socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n"); });
  let shutdown: Promise<void> | undefined;
  return { server, shutdown: () => shutdown ??= (async () => {
    draining = true;
    const closed = new Promise<void>((resolve) => server.close(() => resolve()));
    const deadline = setTimeout(() => {
      for (const controller of active.keys()) controller.abort();
      server.closeAllConnections();
    }, Math.min(config.requestTimeoutMs, 5000));
    await closed; clearTimeout(deadline); discoveryLifetime.abort(); await Promise.allSettled(active.values());
  })() };
}

async function main(): Promise<void> {
  const config = loadHostedConfig();
  const gateway = createHostedGateway(config);
  await new Promise<void>((resolve, reject) => {
    gateway.server.once("error", reject); gateway.server.listen(config.port, "0.0.0.0", resolve);
  });
  process.stderr.write("Handigraphs hosted MCP listening.\n");
  const stop = () => { void gateway.shutdown().catch(() => { process.exitCode = 1; }); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write("Handigraphs hosted MCP failed to start.\n"); process.exitCode = 1; });
}
