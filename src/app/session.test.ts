import { describe, expect, it } from 'vitest';
import { cards, defined, foundationUpTo, makeState } from '../engine/test-helpers';
import {
  currentScore,
  elapsed,
  hasStarted,
  pause,
  playMove,
  resume,
  startSession,
  undoMove,
  type Session,
} from './session';

const T0 = Date.UTC(2026, 9, 15, 12, 0, 0);

const nearlyWon = (): Session => {
  const session = startSession('id', 1, 3);
  return {
    ...session,
    game: {
      ...session.game,
      state: makeState({
        score: 100,
        waste: cards('KS'),
        foundations: [
          foundationUpTo('C', 13),
          foundationUpTo('D', 13),
          foundationUpTo('H', 13),
          foundationUpTo('S', 12),
        ],
      }),
    },
  };
};

describe('session clock', () => {
  it('starts on the first move, not the deal', () => {
    const session = startSession('id', 1, 3);
    expect(session.status).toBe('ready');
    expect(elapsed(session, T0 + 50_000)).toBe(0);

    const played = playMove(session, { type: 'draw' }, T0);
    expect(played?.status).toBe('playing');
    expect(played?.startedAt).toBe(new Date(T0).toISOString());
    expect(played && hasStarted(played)).toBe(true);
    expect(played && elapsed(played, T0 + 12_000)).toBe(12_000);
  });

  it('excludes paused time', () => {
    let session = defined(playMove(startSession('id', 1, 3), { type: 'draw' }, T0));
    session = pause(session, T0 + 10_000);
    expect(session.status).toBe('paused');
    expect(elapsed(session, T0 + 60_000)).toBe(10_000);

    session = resume(session, T0 + 60_000);
    expect(session.status).toBe('playing');
    expect(elapsed(session, T0 + 65_000)).toBe(15_000);
  });

  it('ignores pause before the first move and resume while playing', () => {
    const ready = startSession('id', 1, 3);
    expect(pause(ready, T0)).toBe(ready);
    const playing = defined(playMove(ready, { type: 'draw' }, T0));
    expect(resume(playing, T0 + 5)).toBe(playing);
  });

  it('blocks moves and undo while paused', () => {
    const playing = defined(playMove(startSession('id', 1, 3), { type: 'draw' }, T0));
    const paused = pause(playing, T0 + 1000);
    expect(playMove(paused, { type: 'draw' }, T0 + 2000)).toBeNull();
    expect(undoMove(paused, T0 + 2000)).toBeNull();
  });

  it('returns null for illegal moves and empty undo', () => {
    const ready = startSession('id', 1, 3);
    expect(playMove(ready, { type: 'recycle' }, T0)).toBeNull();
    expect(undoMove(ready, T0)).toBeNull();
  });

  it('undo counts as a move', () => {
    const played = defined(playMove(startSession('id', 1, 3), { type: 'draw' }, T0));
    const undone = undoMove(played, T0 + 1000);
    expect(undone?.game.state.moves).toBe(2);
    expect(undone?.game.state.waste).toEqual([]);
  });

  it('stops the clock on a win and adds the bonus', () => {
    const playing = {
      ...nearlyWon(),
      status: 'playing',
      startedAt: 'x',
      runningSince: T0,
    } as const;
    const won = playMove(playing, { type: 'waste-to-foundation', foundation: 3 }, T0 + 100_000);
    expect(won?.status).toBe('won');
    expect(won && elapsed(won, T0 + 999_999)).toBe(100_000);
    // 110 move points − 20 time penalty + 7000 bonus
    expect(won && currentScore(won, T0 + 999_999)).toBe(90 + 7000);
    expect(won && playMove(won, { type: 'draw' }, T0)).toBeNull();
  });
});
