import { ToolInputError } from "./errors.js";
import type { DiscoveryClient, ResourceDocument } from "./discovery.js";

export const FILTER_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
export type FilterOperator = typeof FILTER_OPERATORS[number];

export interface QueryInput {
  sport: string;
  resource: string;
  split?: string;
  metrics?: string[];
  filters?: Array<{ metric: string; operator: FilterOperator; value: number }>;
  sort?: string;
  team?: string;
  opponent?: string;
  entity_id?: string;
  day?: string;
  page_size?: number;
  cursor?: string;
  stat_format?: "standard" | "compact" | "rich";
  meta?: "compact" | "full";
  category?: string;
  duration?: string;
  location?: string;
}

interface MetricMetadata { scale?: unknown; }

function metricMap(document: Record<string, unknown>): Record<string, MetricMetadata> {
  if (!document.metrics || typeof document.metrics !== "object" || Array.isArray(document.metrics)) {
    throw new Error("Metric discovery response was invalid.");
  }
  return document.metrics as Record<string, MetricMetadata>;
}

function splitIds(document: Record<string, unknown>): string[] {
  if (!Array.isArray(document.splits)) throw new Error("Split discovery response was invalid.");
  return document.splits.flatMap((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? [(item as { id: string }).id] : []);
}

function validateDiscoveredOption(document: Record<string, unknown>, field: string, value: string | undefined): void {
  if (value === undefined) return;
  const filters = document.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return;
  const options = (filters as Record<string, unknown>)[field];
  if (Array.isArray(options)) {
    const allowed = options.filter((item): item is string => typeof item === "string");
    if (!allowed.includes(value)) throw new ToolInputError(`Unknown ${field} '${value}'. Choose a value from live split discovery.`);
  }
}

function requireSupported(resource: ResourceDocument, field: string, present: boolean): void {
  if (present && !resource.filters.includes(field)) {
    throw new ToolInputError(`'${field}' is not supported by this resource.`);
  }
}

export interface ValidatedQuery { resource: ResourceDocument; url: string; }

async function validateOnce(discovery: DiscoveryClient, input: QueryInput, force: boolean): Promise<ValidatedQuery> {
  const resource = await discovery.resource(input.sport, input.resource, force);
  const [metricsDocument, splitsDocument] = await Promise.all([
    discovery.get(resource.metrics, force),
    discovery.get(resource.splits, force),
  ]);
  const availableMetrics = metricMap(metricsDocument);
  const availableSplits = splitIds(splitsDocument);

  if (input.split && !availableSplits.includes(input.split)) {
    throw new ToolInputError(`Unknown split '${input.split}' for '${input.sport}.${input.resource}'.`);
  }
  for (const metric of input.metrics ?? []) {
    if (!Object.hasOwn(availableMetrics, metric)) throw new ToolInputError(`Unknown metric '${metric}' for '${input.sport}.${input.resource}'.`);
  }
  for (const filter of input.filters ?? []) {
    if (!Number.isFinite(filter.value)) throw new ToolInputError(`Filter '${filter.metric}' must use a finite numeric value.`);
    if (!Object.hasOwn(availableMetrics, filter.metric)) throw new ToolInputError(`Unknown filter metric '${filter.metric}' for '${input.sport}.${input.resource}'.`);
    const metadata = availableMetrics[filter.metric];
    if (!metadata) throw new Error("Metric discovery response was invalid.");
    if (metadata.scale === "0_to_1" && Math.abs(filter.value) > 1) {
      throw new ToolInputError(`Metric '${filter.metric}' uses proportion units. Use 0.20 for 20%, not ${filter.value}.`);
    }
  }
  if (input.sort) {
    const metric = input.sort.startsWith("-") ? input.sort.slice(1) : input.sort;
    if (!metric || !Object.hasOwn(availableMetrics, metric)) throw new ToolInputError(`Unknown sort metric '${metric}'.`);
  }

  requireSupported(resource, "team", input.team !== undefined);
  requireSupported(resource, "opponent", input.opponent !== undefined);
  requireSupported(resource, "entity_id", input.entity_id !== undefined);
  requireSupported(resource, "day", input.day !== undefined);
  requireSupported(resource, "category", input.category !== undefined);
  requireSupported(resource, "duration", input.duration !== undefined);
  requireSupported(resource, "location", input.location !== undefined);
  validateDiscoveredOption(splitsDocument, "category", input.category);
  validateDiscoveredOption(splitsDocument, "duration", input.duration);
  validateDiscoveredOption(splitsDocument, "location", input.location);

  const params = new URLSearchParams();
  if (input.split) params.set("split", input.split);
  if (input.metrics?.length) params.set("metrics", input.metrics.join(","));
  for (const filter of input.filters ?? []) params.append("filter", `${filter.metric}:${filter.operator}:${filter.value}`);
  if (input.sort) params.set("sort", input.sort);
  for (const key of ["team", "opponent", "entity_id", "day", "cursor", "category", "duration", "location"] as const) {
    const value = input[key];
    if (value !== undefined) params.set(key, value);
  }
  if (input.page_size !== undefined) params.set("page_size", String(input.page_size));
  params.set("stat_format", input.stat_format ?? "compact");
  params.set("meta", input.meta ?? "compact");
  return { resource, url: `${resource.href}?${params.toString()}` };
}

export async function validateAndBuildQuery(discovery: DiscoveryClient, input: QueryInput): Promise<ValidatedQuery> {
  if (input.metrics) {
    if (input.metrics.length === 0) throw new ToolInputError("metrics must contain at least one metric when supplied.");
    if (new Set(input.metrics).size !== input.metrics.length) throw new ToolInputError("metrics must not contain duplicates.");
  }
  try {
    return await validateOnce(discovery, input, false);
  } catch (error) {
    if (!(error instanceof ToolInputError)) throw error;
    return validateOnce(discovery, input, true);
  }
}
