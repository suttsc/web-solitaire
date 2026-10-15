import type { DrawMode, ScoringMode } from './engine';
import type { WinnableRequest, WinnableResponse } from './solver.worker';

const TIMEOUT_MS = 10_000;

/** Ask the solver (in a Web Worker, so the table stays responsive) for a deal it has proven winnable. */
export function findWinnableDeal(drawMode: DrawMode, scoring: ScoringMode): Promise<number | null> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
    const done = (seed: number | null) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(seed);
    };
    const timer = setTimeout(() => {
      done(null);
    }, TIMEOUT_MS);
    worker.addEventListener('message', (event: MessageEvent<WinnableResponse>) => {
      done(event.data.seed);
    });
    worker.addEventListener('error', () => {
      done(null);
    });
    const request: WinnableRequest = { drawMode, scoring };
    worker.postMessage(request);
  });
}
