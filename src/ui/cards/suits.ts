import type { Suit } from '../../engine';

/** Suit shapes drawn in a 100 × 100 box. */
const SHAPES: Record<Suit, string> = {
  H: '<path d="M50 90 C22 68 4 50 4 31 C4 15 16 6 29 6 C39 6 46 12 50 20 C54 12 61 6 71 6 C84 6 96 15 96 31 C96 50 78 68 50 90 Z"/>',
  D: '<path d="M50 3 L86 50 L50 97 L14 50 Z"/>',
  S: '<path d="M50 4 C38 24 8 40 8 62 C8 76 19 84 31 84 C40 84 46 79 48 72 C47 84 43 91 34 96 L66 96 C57 91 53 84 52 72 C54 79 60 84 69 84 C81 84 92 76 92 62 C92 40 62 24 50 4 Z"/>',
  C: '<circle cx="50" cy="27" r="20"/><circle cx="27" cy="57" r="20"/><circle cx="73" cy="57" r="20"/><circle cx="50" cy="52" r="10"/><path d="M46 52 C46 74 42 88 33 96 L67 96 C58 88 54 74 54 52 Z"/>',
};

/** A suit symbol with its top-left at (x, y), `size` units square. */
export const suitMark = (suit: Suit, x: number, y: number, size: number, fill: string): string =>
  `<g transform="translate(${x} ${y}) scale(${size / 100})" fill="${fill}">${SHAPES[suit]}</g>`;

export const isRedSuit = (suit: Suit): boolean => suit === 'H' || suit === 'D';
