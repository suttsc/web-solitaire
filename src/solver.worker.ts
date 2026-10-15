import { findWinnableSeed, randomSeed, type DrawMode, type ScoringMode } from './engine';

export interface WinnableRequest {
  readonly drawMode: DrawMode;
  readonly scoring: ScoringMode;
}

export interface WinnableResponse {
  readonly seed: number | null;
}

self.addEventListener('message', (event: MessageEvent<WinnableRequest>) => {
  const { drawMode, scoring } = event.data;
  const response: WinnableResponse = { seed: findWinnableSeed(drawMode, scoring, randomSeed) };
  self.postMessage(response);
});
