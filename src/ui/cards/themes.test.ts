import { describe, expect, it } from 'vitest';
import { createDeck } from '../../engine';
import { backImage, DEFAULT_THEME, getTheme, renderFace, THEME_IDS, THEMES } from './themes';

const faceUp = createDeck().map((card) => ({ ...card, faceUp: true }));

describe('card themes', () => {
  it('falls back to the default theme for unknown ids', () => {
    expect(getTheme('heritage').id).toBe('heritage');
    expect(getTheme('nope').id).toBe(DEFAULT_THEME);
  });

  it.each(THEME_IDS)('%s renders every face as a 150 × 210 SVG with its rank', (id) => {
    const theme = THEMES[id];
    for (const card of faceUp) {
      const svg = renderFace(theme, card);
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 150 210"/);
      const rank = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][
        card.rank
      ];
      expect(svg).toContain(`>${rank ?? ''}</text>`);
    }
  });

  it('colours red and black suits from the palette', () => {
    const theme = THEMES.victorian;
    const heart = faceUp.find((c) => c.suit === 'H' && c.rank === 7);
    const spade = faceUp.find((c) => c.suit === 'S' && c.rank === 7);
    expect(heart && renderFace(theme, heart)).toContain(`fill="${theme.palette.red}"`);
    expect(spade && renderFace(theme, spade)).toContain(`fill="${theme.palette.black}"`);
  });

  it('crops the original artwork for Classic courts and draws portraits for the others', () => {
    const king = faceUp.find((c) => c.suit === 'H' && c.rank === 13);
    if (!king) throw new Error('missing king');
    expect(renderFace(THEMES.classic, king)).toContain('href="/cards/H13.svg"');
    expect(renderFace(THEMES.heritage, king)).not.toContain('<image');
  });

  it('gives every theme a card back', () => {
    expect(backImage(THEMES.classic)).toBe('url(/cards/back.svg)');
    for (const id of ['heritage', 'victorian', 'casino'] as const) {
      expect(backImage(THEMES[id])).toMatch(/^url\("data:image\/svg\+xml,/);
    }
  });

  it('keeps theme ids and names in step', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort());
    for (const id of THEME_IDS) expect(THEMES[id].id).toBe(id);
  });
});
