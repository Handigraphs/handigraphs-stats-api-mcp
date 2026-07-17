export interface SafeProblem {
  status: number;
  code: string;
  detail: string;
  field_errors?: unknown;
  request_id?: string;
  retry_after_seconds?: number;
  retry_at?: string;
}

export class ToolInputError extends Error {
  readonly code = "invalid_tool_input";
}

export class UpstreamError extends Error {
  constructor(readonly problem: SafeProblem) {
    super(problem.detail);
  }
}

export function parseRetryAfter(value: string | null, now = Date.now()): Pick<SafeProblem, "retry_after_seconds" | "retry_at"> {
  if (!value) return {};
  const delta = Number(value);
  if (Number.isFinite(delta) && delta >= 0) {
    return { retry_after_seconds: Math.ceil(delta), retry_at: new Date(now + Math.ceil(delta) * 1000).toISOString() };
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return {};
  return {
    retry_after_seconds: Math.max(0, Math.ceil((timestamp - now) / 1000)),
    retry_at: new Date(timestamp).toISOString(),
  };
}
