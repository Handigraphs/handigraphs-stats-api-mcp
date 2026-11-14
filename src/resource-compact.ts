import { object } from './discovery.js';
import { ToolInputError } from './errors.js';

/** Keep complete canonical definitions/units; full retains aliases and presentation diagnostics. */
export function compactResource(description: Record<string, unknown>, requested?: string[]) {
  const source = object(description.metrics);
  const definitions = object(source.metrics);
  if (requested?.some(key => !Object.hasOwn(definitions, key))) {
    throw new ToolInputError('Choose metric keys from this resource discovery.');
  }
  const { benchmark: _benchmark, ...header } = source;
  const metrics = Object.fromEntries(Object.entries(definitions)
    .filter(([key]) => !requested || requested.includes(key))
    .map(([key, value]) => {
      const { benchmark: _metricBenchmark, aliases: _aliases, precision: _precision, ...definition } = object(value);
      return [key, definition];
    }));
  const result = { ...description, detail: 'compact', metrics: { ...header, metrics },
    full_detail_hint: 'Use detail="full" for benchmarks, aliases and rounding; metrics=[...] narrows definitions.' };
  return result;
}

export function nhlRecipes(resource: string) {
  if (!['skaters', 'goalies'].includes(resource)) return undefined;
  const goalie = resource === 'goalies';
  return { screen: { tool: 'query_stats', arguments: { sport: 'nhl', resource, day: 'today',
    split: goalie ? 'season' : 'L10', prop_screen: true, page_size: 12, stat_format: 'compact',
    metrics: goalie ? ['saves_per_game', 'games_started', 'save_pct', 'gsax_per_60']
      : ['sog_per_game', 'icf_per_game', 'games_played'],
    sort: goalie ? '-saves_per_game' : '-sog_per_game', matchup_market: goalie ? 'saves' : 'shots', matchup_window: 'sea' } },
    evidence: { tool: 'get_player_prop_evidence', market: goalie ? 'goalie_saves' : 'skater_shots_on_goal',
      sections: ['hit_rates', 'odds', 'matchup'], max_players: 5 },
    sample_note: goalie ? 'Season volume is not a five-start sample. Evidence uses five starts; L60/L120 are minute windows.'
      : 'Compare recent volume, then exact-line recent/season rates and prices. Hit rates are not forecasts.' };
}
