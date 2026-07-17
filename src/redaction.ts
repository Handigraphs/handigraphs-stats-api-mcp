const AUTH_LIKE = /(^|_)(authorization|api_?key|access_?token|auth_?token|token|secret|credential|password)($|_)/i;
const REDACTED = "[REDACTED]";

function redactString(value: string, apiKey: string): string {
  if (!apiKey) return value;
  return value.split(apiKey).join(REDACTED);
}

function isAuthLikeField(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return AUTH_LIKE.test(normalized);
}

export function redact(value: unknown, apiKey: string, seen = new WeakSet<object>()): unknown {
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

export function safeStderr(message: string, detail: unknown, apiKey: string): void {
  const safe = redact(detail, apiKey);
  process.stderr.write(`${message} ${JSON.stringify(safe)}\n`);
}
