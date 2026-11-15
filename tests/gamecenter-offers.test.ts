import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCurrentOffers } from '../src/gamecenter-offers.js';
import { compactGamecenterPacket, compactGamecenterPage, GAMECENTER_PAGE_BYTES } from '../src/gamecenter-compact.js';

function packet() {
  return { sport: 'nhl', league_game_id: '42', game_date: '2026-11-15', game_id: 'opaque',
    publication: { state: 'published', generated_at: '2026-11-15T08:00:00Z' },
    freshness: { data_as_of: null, live_checked: false },
    analysis: { props: Array.from({ length: 5 }, (_, i) => ({ player_id: i+1, market: 'SOG', pick: 'Over',
      status: 'watch', reasoning: 'Accepted published reasoning. '.repeat(8), evidence_ids: ['fact-'+i] })), market_reviews: [] },
    current_offers: { schema: 'nhl-gamecenter-current-offers-v1', as_of: '2026-11-15T11:00:00Z', live_checked: false,
      status: 'ready', coverage: { requested: 5, returned: 5, omitted: 0 },
      items: Array.from({ length: 5 }, (_, i) => ({ prop_index: i, player_id: String(i+1), watch_market: 'SOG',
        market: 'skater_shots_on_goal', side: 'over', status: 'available', line: 4.5, price_american: -110,
        book: 'Stored book', fetched_at: '2026-11-15T10:55:00Z', source_market_key: 'player_shots_on_goal' })) } };
}
const url = new URL('https://www.handigraphs.com/api/v1/nhl/gamecenter/opaque?sections=analysis&include_current_offers=true');

test('pending publication preserves unavailable quote annotations with no invented watch', () => {
  assert.doesNotThrow(() => validateCurrentOffers({ analysis: {}, current_offers: {
    schema: 'nhl-gamecenter-current-offers-v1', live_checked: false, status: 'unavailable',
    reason: 'no_published_watches', items: [], coverage: { requested: 0, returned: 0, omitted: 0 } } }));
});

test('quote sidecars preserve exact accepted compact content and citation dependencies', () => {
  const source = packet(), original = structuredClone(source);
  assert.equal(validateCurrentOffers(source), source);
  const priced = compactGamecenterPacket(source, url);
  const unpriced = compactGamecenterPacket({ ...source, current_offers: undefined }, url);
  assert.deepEqual(priced.analysis, unpriced.analysis);
  assert.deepEqual(priced.citation_ids, unpriced.citation_ids);
  assert.deepEqual(priced.publication, unpriced.publication);
  assert.deepEqual(source, original);
  assert.equal(priced.current_offers, source.current_offers);
});

test('changing current quotes does not invalidate a frozen publication page or dangle references', () => {
  const source = packet();
  const first = compactGamecenterPage(compactGamecenterPacket(source, url), undefined);
  assert.equal(typeof first.next_cursor, 'string');
  assert.ok(Buffer.byteLength(JSON.stringify(first)) <= GAMECENTER_PAGE_BYTES);
  source.current_offers.as_of = '2026-11-15T11:01:00Z';
  source.current_offers.items[0]!.price_american = -120;
  const second = compactGamecenterPage(compactGamecenterPacket(source, url), first.next_cursor as string);
  const analysis = second.analysis as { props: { player_id: number }[] };
  const offers = second.current_offers as { items: { prop_index: number; player_id: string }[] };
  assert.ok(offers.items.length);
  for (const item of offers.items) assert.equal(item.player_id, String(analysis.props[item.prop_index]!.player_id));
  assert.ok(Buffer.byteLength(JSON.stringify(second)) <= GAMECENTER_PAGE_BYTES);
});

test('missing or mismatched annotation identities and prices fail without rewriting a watch', () => {
  for (const change of ['identity', 'price', 'coverage']) {
    const source = packet();
    if (change === 'identity') source.current_offers.items[0]!.player_id = '999';
    if (change === 'price') source.current_offers.items[0]!.line = Number.NaN;
    if (change === 'coverage') source.current_offers.coverage.returned = 4;
    assert.throws(() => validateCurrentOffers(source));
  }
});
