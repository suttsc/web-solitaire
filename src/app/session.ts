import {
  displayScore,
  isWon,
  newGame,
  play,
  undo,
  type DrawMode,
  type Game,
  type Move,
} from '../engine';

export type SessionStatus = 'ready' | 'playing' | 'paused' | 'won';

/**
 * One deal being played: the engine game plus the clock. Pure data; every
 * function here takes `now` (epoch ms) so the timer is deterministic in tests.
 */
export interface Session {
  readonly id: string;
  readonly game: Game;
  readonly status: SessionStatus;
  /** Active play time accumulated before `runningSince`. */
  readonly elapsedMs: number;
  /** When the clock last started running, or null while stopped. */
  readonly runningSince: number | null;
  /** ISO time of the first move; null until then. */
  readonly startedAt: string | null;
}

export function startSession(id: string, seed: number, drawMode: DrawMode): Session {
  return {
    id,
    game: newGame(seed, drawMode),
    status: 'ready',
    elapsedMs: 0,
    runningSince: null,
    startedAt: null,
  };
}

export const elapsed = (session: Session, now: number): number =>
  session.elapsedMs + (session.runningSince === null ? 0 : Math.max(0, now - session.runningSince));

export const currentScore = (session: Session, now: number): number =>
  displayScore(session.game.state.score, elapsed(session, now), session.status === 'won');

/** Has the player made a move yet? */
export const hasStarted = (session: Session): boolean => session.startedAt !== null;

function stopClock(session: Session, now: number): Session {
  return { ...session, elapsedMs: elapsed(session, now), runningSince: null };
}

function withGame(session: Session, game: Game, now: number): Session {
  const started: Session =
    session.startedAt === null
      ? { ...session, startedAt: new Date(now).toISOString(), runningSince: now, status: 'playing' }
      : session;
  const next: Session = { ...started, game };
  return isWon(game.state.foundations) ? { ...stopClock(next, now), status: 'won' } : next;
}

/** Play a move, starting the clock on the first one. Null if the move is illegal or play is paused/over. */
export function playMove(session: Session, move: Move, now: number): Session | null {
  if (session.status === 'paused' || session.status === 'won') return null;
  const game = play(session.game, move);
  return game ? withGame(session, game, now) : null;
}

export function undoMove(session: Session, now: number): Session | null {
  if (session.status !== 'playing') return null;
  const game = undo(session.game);
  return game ? withGame(session, game, now) : null;
}

export function pause(session: Session, now: number): Session {
  return session.status === 'playing' ? { ...stopClock(session, now), status: 'paused' } : session;
}

export function resume(session: Session, now: number): Session {
  return session.status === 'paused'
    ? { ...session, status: 'playing', runningSince: now }
    : session;
}
