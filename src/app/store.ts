export type Listener<T> = (state: T, previous: T) => void;

export interface Store<T> {
  get(): T;
  set(update: Partial<T> | ((state: T) => Partial<T>)): void;
  subscribe(listener: Listener<T>): () => void;
}

/** Minimal observable store: shallow-merges updates and notifies subscribers with old and new state. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => state,
    set(update) {
      const previous = state;
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      listeners.forEach((listener) => {
        listener(state, previous);
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
