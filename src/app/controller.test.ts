import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../data/db';
import { createController, initialState, type AppState } from './controller';
import { startSession } from './session';
import { createStore } from './store';

/** Seed 2 deals the ace of spades face up on column 3; seed 4 has 9♥ (col 2) onto 10♣ (col 0). */
function setup(seed: number) {
  const store = createStore<AppState>(
    initialState(DEFAULT_SETTINGS, startSession('game-1', seed, 3)),
  );
  const finished = vi.fn();
  let time = 1_000_000;
  const controller = createController(store, { finished }, () => (time += 1000));
  return { store, controller, finished };
}

describe('controller', () => {
  it('draws from the stock and recycles when it is empty', () => {
    const { store, controller } = setup(2);
    for (let i = 0; i < 8; i++) controller.tapStock();
    expect(store.get().session.game.state.stock).toHaveLength(0);
    controller.tapStock();
    expect(store.get().session.game.state.passes).toBe(1);
  });

  it('selects a card on tap and moves it on tapping a target', () => {
    const { store, controller } = setup(4);
    controller.tapCard({ kind: 'tableau', index: 2 }, 2);
    expect(store.get().selection).toEqual({ pile: { kind: 'tableau', index: 2 }, cardIndex: 2 });
    expect(controller.tapCard({ kind: 'tableau', index: 0 }, 0)).toBe(true);
    expect(store.get().session.game.state.tableau[0]).toHaveLength(2);
    expect(store.get().selection).toBeNull();
  });

  it('deselects on a second tap of the same card and ignores face-down cards', () => {
    const { store, controller } = setup(4);
    controller.tapCard({ kind: 'tableau', index: 2 }, 2);
    controller.tapCard({ kind: 'tableau', index: 2 }, 2);
    expect(store.get().selection).toBeNull();
    controller.tapCard({ kind: 'tableau', index: 2 }, 0);
    expect(store.get().selection).toBeNull();
  });

  it('moves a selection onto an empty slot only when legal', () => {
    const { store, controller } = setup(4);
    controller.tapCard({ kind: 'tableau', index: 2 }, 2);
    expect(controller.tapSlot({ kind: 'foundation', index: 0 })).toBe(false);
    expect(store.get().selection).toBeNull();
  });

  it('sends a double-tapped card to its foundation', () => {
    const { store, controller } = setup(2);
    expect(controller.doubleTapCard({ kind: 'tableau', index: 3 }, 3)).toBe(true);
    expect(store.get().session.game.state.foundations.flat()).toHaveLength(1);
    expect(controller.doubleTapCard({ kind: 'tableau', index: 0 }, 0)).toBe(false);
  });

  it('drops a dragged card when legal and rejects otherwise', () => {
    const { controller } = setup(4);
    const source = { pile: { kind: 'tableau', index: 2 }, cardIndex: 2 } as const;
    expect(controller.drop(source, { kind: 'tableau', index: 1 })).toBe(false);
    expect(controller.drop(source, null)).toBe(false);
    expect(controller.drop(source, { kind: 'tableau', index: 0 })).toBe(true);
  });

  it('undoes, pauses and resumes', () => {
    const { store, controller } = setup(2);
    controller.tapStock();
    controller.pause();
    expect(store.get().session.status).toBe('paused');
    expect(controller.undo()).toBe(false);
    controller.resume();
    expect(controller.undo()).toBe(true);
    expect(store.get().session.game.state.moves).toBe(2);
  });

  it('records an unfinished game as abandoned on redeal, but not an untouched one', () => {
    const { store, controller, finished } = setup(2);
    controller.newGame(1);
    expect(finished).not.toHaveBeenCalled();
    expect(store.get().settings.drawMode).toBe(1);

    controller.tapStock();
    const played = store.get().session;
    controller.newGame(3, 77);
    expect(finished).toHaveBeenCalledWith(played, 'abandoned', expect.any(Number));
    expect(store.get().session.game.state.seed).toBe(77);
  });

  it('updates settings', () => {
    const { store, controller } = setup(2);
    controller.updateSettings({ sound: false });
    expect(store.get().settings.sound).toBe(false);
  });
});
