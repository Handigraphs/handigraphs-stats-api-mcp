import { object } from "./discovery.js";

const PROP_FIELDS = ["market", "player", "player_id", "team", "pick", "status", "reasoning", "text", "review_notes"];
const REVIEW_FIELDS = ["market", "status", "selection_status", "assessment_status", "reason_codes",
  "selected_count", "evaluation_scope", "text", "review_notes"];
const PACKET_FIELDS = ["sport", "game_id", "league_game_id", "game_date", "away_team", "home_team",
  "freshness", "citation_status", "content_role"];
const PUBLICATION_FIELDS = ["state", "mode", "assessment_status", "reason", "reason_codes", "source_schema",
  "generated_at", "published_at", "last_attempt_at", "cross_check"];

function fields(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(record, key)).map((key) => [key, record[key]]));
}

export function compactGamecenterPacket(packet: Record<string, unknown>, requestUrl: URL): Record<string, unknown> {
  const citations = new Map<string, number>();
  function item(value: unknown, keys: string[]): Record<string, unknown> {
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
  const analysis: Record<string, unknown> = {};
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
