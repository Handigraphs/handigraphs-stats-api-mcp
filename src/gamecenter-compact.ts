import { createHash } from "node:crypto";
import { object } from "./discovery.js";
import { ToolInputError } from "./errors.js";

const PROP_FIELDS = ["market", "player", "player_id", "team", "pick", "status", "reasoning", "text", "review_notes"];
const REVIEW_FIELDS = ["market", "status", "selection_status", "assessment_status", "reason_codes",
  "selected_count", "evaluation_scope", "text", "review_notes"];
const PACKET_FIELDS = ["sport", "game_id", "league_game_id", "game_date", "away_team", "home_team",
  "freshness", "citation_status", "content_role"];
const PUBLICATION_FIELDS = ["state", "mode", "assessment_status", "reason", "reason_codes", "source_schema",
  "generated_at", "published_at", "last_attempt_at", "cross_check"];
const ANALYSIS_SECTIONS = ["props", "market_reviews"] as const;
type AnalysisSection = typeof ANALYSIS_SECTIONS[number];
type CitedItem = Record<string, unknown> & { citation_indices: number[] };
type AnalysisItem = CitedItem & { counterpoint?: CitedItem };
type CompactAnalysis = Partial<Record<AnalysisSection, AnalysisItem[]>>;
type CompactPacket = Record<string, unknown> & { analysis: CompactAnalysis; citation_ids: string[] };

export const GAMECENTER_PAGE_BYTES = 3.5 * 1024;
export const GAMECENTER_PAGE_CURSOR = /^gcp1\.([1-9]\d{0,5})\.([A-Za-z0-9_-]{43})$/;

function fields(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
}

export function compactGamecenterPacket(packet: Record<string, unknown>, requestUrl: URL): CompactPacket {
  const citations = new Map<string, number>();
  function item(value: unknown, keys: string[]): CitedItem {
    const source = object(value);
    const citationIndices: number[] = [];
    for (const id of Array.isArray(source.evidence_ids) ? source.evidence_ids : []) {
      if (typeof id !== "string") continue;
      const index = citations.get(id) ?? citations.size;
      citations.set(id, index);
      citationIndices.push(index);
    }
    return { ...fields(source, keys), citation_indices: citationIndices };
  }

  const source = object(packet.analysis);
  const analysis: CompactAnalysis = {};
  if (Array.isArray(source.props)) {
    analysis.props = source.props.map((prop: unknown) => {
      const { counterpoint } = object(prop);
      return { ...item(prop, PROP_FIELDS), ...(counterpoint ? { counterpoint: item(counterpoint, ["text"]) } : {}) };
    });
  }
  if (Array.isArray(source.market_reviews)) {
    analysis.market_reviews = source.market_reviews.map((review: unknown) => item(review, REVIEW_FIELDS));
  }

  const publication = object(packet.publication);
  const sections = fields(object(publication.sections), ["props", "market_reviews"]);
  const evidenceUrl = new URL(requestUrl);
  evidenceUrl.search = "sections=evidence";
  return {
    schema: "gamecenter-compact-v1",
    ...fields(packet, PACKET_FIELDS),
    publication: { ...fields(publication, PUBLICATION_FIELDS), sections },
    analysis,
    citation_ids: [...citations.keys()],
    evidence_href: evidenceUrl.href,
  };
}

export function compactGamecenterPage(packet: CompactPacket, cursor: string | undefined): Record<string, unknown> {
  const { analysis, citation_ids, ...header } = packet;
  const entries = ANALYSIS_SECTIONS.flatMap((section) =>
    (analysis[section] ?? []).map((item, index) => ({ section, item, index })));
  // The projection includes the exact evidence URL, binding the cursor to the sport and game
  // even if the upstream packet has no analysis or game identity fields.
  const stamp = createHash("sha256").update(JSON.stringify(packet)).digest("base64url");
  const decoded = cursor === undefined ? null : GAMECENTER_PAGE_CURSOR.exec(cursor);
  const offset = decoded ? Number(decoded[1]) : 0;
  if (cursor !== undefined && (!decoded || decoded[2] !== stamp || offset >= entries.length)) {
    throw new ToolInputError("Invalid or stale Gamecenter page cursor. Restart with format=compact_page and omit cursor.");
  }

  function page(end: number, oversizedItem?: { section: AnalysisSection; index: number }) {
    const indices = new Map<number, number>();
    function reindex(item: CitedItem): CitedItem {
      return { ...item, citation_indices: item.citation_indices.map((original) => {
        const index = indices.get(original) ?? indices.size;
        indices.set(original, index);
        return index;
      }) };
    }

    const pageAnalysis: CompactAnalysis = {};
    for (const section of ANALYSIS_SECTIONS) {
      if (analysis[section]) pageAnalysis[section] = [];
    }
    if (!oversizedItem) {
      for (const { section, item } of entries.slice(offset, end)) {
        pageAnalysis[section]!.push({ ...reindex(item),
          ...(item.counterpoint ? { counterpoint: reindex(item.counterpoint) } : {}) });
      }
    }
    return {
      ...header,
      schema: "gamecenter-compact-page-v1",
      offset,
      analysis: pageAnalysis,
      citation_ids: [...indices.keys()].map((original) => citation_ids[original]),
      ...(oversizedItem ? { oversized_item: oversizedItem } : {}),
      next_cursor: end < entries.length ? `gcp1.${end}.${stamp}` : null,
    };
  }

  const fits = (value: Record<string, unknown>) => Buffer.byteLength(JSON.stringify(value), "utf8") <= GAMECENTER_PAGE_BYTES;
  let result = page(offset);
  for (let end = offset + 1; end <= entries.length; end++) {
    const candidate = page(end);
    if (!fits(candidate)) {
      if (end === offset + 1) {
        const { section, index } = entries[offset]!;
        result = page(end, { section, index });
      }
      break;
    }
    result = candidate;
  }
  if (!fits(result)) throw new ToolInputError("Gamecenter page metadata exceeds 3.5 KiB. Use compact=true for the full packet.");
  return result;
}
