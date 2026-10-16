import type { GameRecord, RecordsResponse } from '../../shared/schema';
import type { PlayerStats } from '../../shared/stats';

export type Metric = 'time' | 'moves' | 'score';

export interface MetricComparison {
  readonly metric: Metric;
  readonly value: number;
  /** Your best before this game, or null if this is your first win. */
  readonly personal: number | null;
  /** The best on record from anyone (excluding this game), null if none or not comparable. */
  readonly global: { readonly name: string; readonly value: number } | null;
  readonly newPersonalBest: boolean;
  readonly newRecord: boolean;
}

const LOWER_IS_BETTER: Record<Metric, boolean> = { time: true, moves: true, score: false };

const beats = (metric: Metric, value: number, other: number): boolean =>
  LOWER_IS_BETTER[metric] ? value < other : value > other;

/**
 * Compare a won game with the player's previous bests and the global records. `previous` must
 * be computed without this game; `records` may be null while loading or offline.
 */
export function compareWin(
  game: Pick<GameRecord, 'durationMs' | 'moves' | 'score' | 'scoringMode'>,
  previous: PlayerStats,
  records: RecordsResponse | null,
): MetricComparison[] {
  const rows: [Metric, number, number | null][] = [
    ['time', game.durationMs, previous.bestTimeMs],
    ['moves', game.moves, previous.fewestMoves],
    ['score', game.score, previous.bestScore],
  ];

  return rows.map(([metric, value, personal]) => {
    // Global score records are standard scoring only, so a Vegas score isn't compared.
    const comparable = metric !== 'score' || game.scoringMode === 'standard';
    const global = comparable && records ? records[metric] : null;
    return {
      metric,
      value,
      personal,
      global,
      newPersonalBest: personal === null || beats(metric, value, personal),
      newRecord:
        comparable && records !== null && (global === null || beats(metric, value, global.value)),
    };
  });
}
