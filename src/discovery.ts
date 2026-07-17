import { ToolInputError } from "./errors.js";
import { StatsApiHttpClient } from "./http.js";

interface CacheEntry { json: Record<string, unknown>; etag: string | null; expiresAt: number; }

export interface ResourceDocument {
  id: string;
  href: string;
  metrics: string;
  splits: string;
  filters: string[];
}

export class DiscoveryClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<Record<string, unknown>>>();

  constructor(private readonly http: StatsApiHttpClient, private readonly ttlMs: number, private readonly now = Date.now) {}

  async get(path: string, force = false): Promise<Record<string, unknown>> {
    const key = this.http.resolve(path).href;
    const cached = this.cache.get(key);
    if (!force && cached && cached.expiresAt > this.now()) return cached.json;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const request = this.load(key, cached).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async load(key: string, cached?: CacheEntry): Promise<Record<string, unknown>> {
    const response = await this.http.get(key, { protectedData: false, ...(cached?.etag ? { etag: cached.etag } : {}) });
    if ("notModified" in response) {
      if (!cached) throw new Error("Received 304 without a cached discovery response.");
      cached.expiresAt = this.now() + this.ttlMs;
      return cached.json;
    }
    this.cache.set(key, { json: response.json, etag: response.etag, expiresAt: this.now() + this.ttlMs });
    return response.json;
  }

  async sports(force = false): Promise<string[]> {
    const root = await this.get("", force);
    if (!Array.isArray(root.sports)) throw new Error("Discovery response did not contain sports.");
    return root.sports.flatMap((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" ? [(item as { id: string }).id] : []);
  }

  async resources(sport: string, force = false): Promise<ResourceDocument[]> {
    const sports = await this.sports(force);
    if (!sports.includes(sport)) throw new ToolInputError(`Unknown sport '${sport}'. Refresh discovery and choose a supported sport.`);
    const payload = await this.get(sport, force);
    if (!Array.isArray(payload.resources)) throw new Error("Discovery response did not contain resources.");
    return payload.resources.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      if (typeof value.id !== "string" || typeof value.href !== "string" || typeof value.metrics !== "string" || typeof value.splits !== "string") return [];
      this.http.resolve(value.href);
      this.http.resolve(value.metrics);
      this.http.resolve(value.splits);
      return [{ id: value.id, href: value.href, metrics: value.metrics, splits: value.splits, filters: Array.isArray(value.filters) ? value.filters.filter((v): v is string => typeof v === "string") : [] }];
    });
  }

  async resource(sport: string, resource: string, force = false): Promise<ResourceDocument> {
    const found = (await this.resources(sport, force)).find((item) => item.id === resource);
    if (!found) throw new ToolInputError(`Unknown resource '${sport}.${resource}'. Refresh discovery and choose a supported resource.`);
    return found;
  }

  async describe(sport: string, resource: string, force = false): Promise<Record<string, unknown>> {
    const item = await this.resource(sport, resource, force);
    const [metrics, splits] = await Promise.all([this.get(item.metrics, force), this.get(item.splits, force)]);
    return { sport, resource: item, metrics, splits };
  }
}
