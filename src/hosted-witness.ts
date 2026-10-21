import { randomUUID } from "node:crypto";
import { Console } from "node:console";
import type { ServerResponse } from "node:http";
import type { HostedConfig } from "./hosted-config.js";

const RESOURCE = "https://mcp-sandbox.handigraphs.com/mcp";
const ISSUER = "https://handigraphs-sandbox-web-49829810d1bb.herokuapp.com";
const PREFIX = "HANDIGRAPHS_MCP_DENIAL_WITNESS_";
const REQUEST_ID = "X-Handigraphs-Acceptance-Request-Id";
const RUN_REF = "X-Handigraphs-Acceptance-Run-Ref";
const MARKER = "X-Handigraphs-Acceptance-Witness";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface DenialWitnessConfig {
  readonly runRef: string;
  readonly startedAt: number;
  readonly until: number;
  readonly eventCap: number;
}

function timestamp(raw: string | undefined): number {
  if (!raw || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) return NaN;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === raw.replace(/Z$/, raw.includes(".") ? "Z" : ".000Z") ? parsed : NaN;
}

/** Invalid optional instrumentation is inert; it never changes authentication. */
export function loadDenialWitnessConfig(env: NodeJS.ProcessEnv, resource: string, issuer: string,
  serviceSecret: string): DenialWitnessConfig | undefined {
  if (env[PREFIX + "ENABLED"] !== "true" || env.HEROKU_APP_NAME !== "handigraphs-mcp-sandbox"
    || resource !== RESOURCE || issuer !== ISSUER) return undefined;
  const runRef = env[PREFIX + "RUN_REF"] ?? "";
  const startedAt = timestamp(env[PREFIX + "STARTED_AT"]);
  const until = timestamp(env[PREFIX + "UNTIL"]);
  const cap = env[PREFIX + "EVENT_CAP"] ?? "";
  const eventCap = Number(cap);
  if (!/^[0-9a-f]{64}$/.test(runRef) || runRef === serviceSecret
    || !Number.isFinite(startedAt) || !Number.isFinite(until) || until <= startedAt || until - startedAt > 4 * 60 * 60 * 1000
    || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(cap) || !Number.isSafeInteger(eventCap)) return undefined;
  return Object.freeze({ runRef, startedAt, until, eventCap });
}

export interface DenialWitnessEvent {
  readonly schema_version: 1;
  readonly event: "hosted_mcp_denial_witness";
  readonly run_ref: string;
  readonly request_id: string;
  readonly status: 401;
  readonly response_finished: true;
  readonly observed_at: string;
}

export interface DenialWitnessDependencies {
  now?: () => number;
  uuid?: () => string;
  emit?: (event: DenialWitnessEvent) => void | Promise<void>;
}

const auditConsole = new Console({ stdout: process.stderr, stderr: process.stderr, ignoreErrors: true, colorMode: false });
function stderrEvent(event: DenialWitnessEvent): void {
  // Console's local ignoreErrors handles synchronous/asynchronous stream errors
  // without global error handlers. Only a complete parsed line is evidence;
  // output loss produces no witness and never changes the denial.
  auditConsole.log("%s", JSON.stringify(event));
}

export interface DenialWitnessAttempt {
  readonly headers: Readonly<Record<string, string>>;
  confirmInvalidGrant(response: Response): void;
  observeDeniedResponse(response: ServerResponse): void;
}

/** Request-local proof; no user credential, grant identity or client identity is retained. */
export function createDenialWitness(config: HostedConfig, dependencies: DenialWitnessDependencies = {}) {
  const options = config.resource === RESOURCE && config.issuer === ISSUER && config.apiBaseUrl === ISSUER + "/api/v1"
    ? config.denialWitness : undefined;
  const now = dependencies.now ?? Date.now;
  const clock = () => { try { return now(); } catch { return NaN; } };
  const uuid = dependencies.uuid ?? randomUUID;
  const emit = dependencies.emit ?? stderrEvent;
  let emitted = 0;
  const active = (time: number) => {
    return options !== undefined && Number.isFinite(time) && time >= options.startedAt && time < options.until
      && emitted < options.eventCap;
  };
  return { begin(): DenialWitnessAttempt | undefined {
    const beganAt = clock();
    if (!options || !active(beganAt)) return undefined;
    let id: string;
    try { id = uuid(); } catch { return undefined; }
    if (!UUID.test(id)) return undefined;
    let confirmed = false;
    let observing = false;
    return Object.freeze({
      headers: Object.freeze({ [REQUEST_ID]: id, [RUN_REF]: options.runRef }),
      confirmInvalidGrant(response: Response): void {
        confirmed = response.status === 400 && response.headers.get(MARKER) === "revoked-grant-v1"
          && response.headers.get(REQUEST_ID) === id && response.headers.get(RUN_REF) === options.runRef;
      },
      observeDeniedResponse(response: ServerResponse): void {
        if (!confirmed || observing) return;
        observing = true;
        const close = () => response.off("finish", finish);
        const finish = () => {
          response.off("close", close);
          const time = clock();
          if (response.statusCode !== 401 || !response.writableFinished || response.destroyed || time < beganAt || !active(time)) return;
          // Reserve before any asynchronous sink work. Failed output is never
          // retried; the app independently caps/deduplicates the whole run.
          emitted++;
          try {
            void Promise.resolve(emit(Object.freeze({ schema_version: 1, event: "hosted_mcp_denial_witness",
              run_ref: options.runRef, request_id: id, status: 401, response_finished: true,
              observed_at: new Date(time).toISOString() }))).catch(() => undefined);
          } catch { /* Instrumentation must never change the denial. */ }
        };
        response.once("finish", finish); response.once("close", close);
      },
    });
  } };
}
