const AUTH_LIKE = /(^|_)(authorization|authorization_?code|auth_?code|api_?key|access_?token|auth_?token|token|secret|credential|password|cookie)($|_)/i;
const REDACTED = "[REDACTED]";

function redactString(value: string, apiKey: string | readonly string[]): string {
  for (const secret of typeof apiKey === "string" ? [apiKey] : apiKey) {
    if (secret) value = value.split(secret).join(REDACTED);
  }
  return value;
}

function isAuthLikeField(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return AUTH_LIKE.test(normalized);
}

export function redact(value: unknown, apiKey: string | readonly string[], seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value, apiKey);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, apiKey),
      ...(value.cause === undefined ? {} : { cause: redact(value.cause, apiKey, seen) }),
    };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, apiKey, seen));
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = isAuthLikeField(key) ? REDACTED : redact(item, apiKey, seen);
  }
  return output;
}

export function safeStderr(message: string, detail: unknown, apiKey: string | readonly string[]): void {
  const safe = redact(detail, apiKey);
  process.stderr.write(`${message} ${JSON.stringify(safe)}\n`);
}

/** Exact credential echoes only: opaque business cursors/evaluation tokens survive. */
export function redactCredentialEchoes<T>(value: T, secrets: readonly string[]): T {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "string" ? redactString(item, secrets) : item)) as T;
}
