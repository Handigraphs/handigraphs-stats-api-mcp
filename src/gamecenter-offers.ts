import { object } from './discovery.js';
import { UpstreamError } from './errors.js';

export const CURRENT_OFFERS_HELP = 'For a published NHL watch request include_current_offers=true when advertised: separate current stored exact-line/book/price/ingestion annotations, not part of the published reasoning. Missing/stale/started/unsupported offers stay unavailable; a watch is not betting value.';

export function validateCurrentOffers(packet: Record<string, unknown>): Record<string, unknown> {
  const sidecar = object(packet.current_offers);
  const props = object(packet.analysis).props ?? [];
  const items = sidecar.items;
  const coverage = object(sidecar.coverage);
  const fail = () => { throw new UpstreamError({ status: 503, code: 'gamecenter_current_offers_invalid',
    detail: 'The current-offer annotations do not match the published watch identities or coverage.' }); };
  if (sidecar.schema !== 'nhl-gamecenter-current-offers-v1' || sidecar.live_checked !== false
      || !['ready', 'partial', 'unavailable'].includes(String(sidecar.status))
      || !Array.isArray(props) || !Array.isArray(items) || items.length > 10
      || coverage.requested !== props.length || coverage.returned !== items.length
      || coverage.omitted !== props.length-items.length) return fail();
  const indices = new Set();
  for (const value of items) {
    const item = object(value), index = item.prop_index;
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= props.length || indices.has(index)) return fail();
    indices.add(index);
    const prop = object(props[index]);
    if (item.player_id !== String(prop.player_id) || item.watch_market !== prop.market
        || item.side !== String(prop.pick).toLowerCase()) return fail();
    if (item.status === 'available') {
      if (typeof item.line !== 'number' || !Number.isFinite(item.line) || item.line < 0
          || typeof item.price_american !== 'number' || !Number.isSafeInteger(item.price_american)
          || Math.abs(item.price_american) < 100 || typeof item.fetched_at !== 'string'
          || !Number.isFinite(Date.parse(item.fetched_at)) || typeof item.source_market_key !== 'string') return fail();
    } else if (item.status !== 'unavailable' || typeof item.reason !== 'string') return fail();
  }
  return packet;
}

export function pageCurrentOffers(value: unknown, originalIndices: number[]): Record<string, unknown> {
  const source = object(value);
  const indices = new Map(originalIndices.map((original, local) => [original, local]));
  const items = (Array.isArray(source.items) ? source.items : []).filter(item => indices.has(object(item).prop_index as number))
    .map<Record<string, unknown>>(item => ({ ...object(item), prop_index: indices.get(object(item).prop_index as number) }));
  const available = items.filter(item => item.status === 'available').length;
  const omitted = originalIndices.length-items.length;
  return { ...source, status: source.status === 'unavailable' ? 'unavailable' : omitted || available < items.length ? 'partial' : 'ready',
    items, coverage: { requested: originalIndices.length, returned: items.length, omitted, available } };
}
