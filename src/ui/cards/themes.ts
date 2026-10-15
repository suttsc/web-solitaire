import { cardKey } from '../layout';
import type { Card } from '../../engine';
import { courtFigure } from './figures';
import { isRedSuit, suitMark } from './suits';

export const THEME_IDS = ['classic', 'heritage', 'victorian', 'casino'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface Palette {
  readonly stock: string;
  readonly edge: string;
  readonly red: string;
  readonly black: string;
  /** Outlines on court figures. */
  readonly ink: string;
  readonly skin: string;
  readonly gold: string;
  readonly hair: string;
  readonly robe: string;
  readonly sash: string;
  /** Background inside the court picture frame. */
  readonly field: string;
  /** Secondary ornament colour (gilt on Victorian). */
  readonly accent: string;
}

export interface Theme {
  readonly id: ThemeId;
  readonly name: string;
  readonly fontFamily: string;
  readonly fontWeight: number;
  readonly rankSize: number;
  readonly palette: Palette;
  /** Table felt: centre highlight, base and edge. */
  readonly felt: { readonly light: string; readonly base: string; readonly dark: string };
  readonly ace: 'ring' | 'rings' | 'gilt' | 'plain';
  readonly frame: 'single' | 'gilt';
  /** Courts use the original deck's artwork (Classic) or the stylised portraits. */
  readonly courts: 'original' | 'figures';
  readonly back: () => string;
}

/** Card faces are drawn in a 150 × 210 box (the deck's 5:7 ratio). */
const W = 150;
const H = 210;

const ENGLISH: Pick<Palette, 'skin' | 'gold' | 'hair' | 'robe' | 'sash'> = {
  skin: '#F4D9BC',
  gold: '#F2C230',
  hair: '#F2C230',
  robe: '#C8102E',
  sash: '#1F4E9C',
};

const svgDoc = (body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${body}</svg>`;

const stockRect = (p: Palette) =>
  `<rect x="0.5" y="0.5" width="149" height="209" rx="10" fill="${p.stock}" stroke="${p.edge}"/>`;

function heritageBack(): string {
  return svgDoc(`<defs><pattern id="l" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H7M0 0V7" stroke="#fff" stroke-width=".9" opacity=".55"/></pattern></defs>
<rect x="0.5" y="0.5" width="149" height="209" rx="10" fill="#fff" stroke="#CFCBC2"/>
<rect x="8" y="8" width="134" height="194" rx="6" fill="#B3202A"/>
<rect x="8" y="8" width="134" height="194" rx="6" fill="url(#l)"/>
<rect x="14" y="14" width="122" height="182" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/>
<circle cx="75" cy="105" r="24" fill="#B3202A" stroke="#fff" stroke-width="1.5"/>
<circle cx="75" cy="105" r="19" fill="none" stroke="#fff" stroke-width="1.5"/>
${suitMark('S', 63, 93, 24, '#fff')}`);
}

function victorianBack(): string {
  const petals = Array.from(
    { length: 8 },
    (_, i) =>
      `<ellipse cx="75" cy="86" rx="4.5" ry="14" fill="#D9BD82" opacity=".85" transform="rotate(${i * 45} 75 105)"/>`,
  ).join('');
  const corners = [
    [10, 10],
    [130, 10],
    [10, 190],
    [130, 190],
  ]
    .map(([x, y]) => suitMark('D', x ?? 0, y ?? 0, 10, '#D9BD82'))
    .join('');
  return svgDoc(`<defs><pattern id="e" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0H4" stroke="#D9BD82" stroke-width=".5" opacity=".35"/></pattern></defs>
<rect x="0.5" y="0.5" width="149" height="209" rx="10" fill="#F5EEDC" stroke="#C9B48C"/>
<rect x="7" y="7" width="136" height="196" rx="6" fill="#6E1A26"/>
<rect x="7" y="7" width="136" height="196" rx="6" fill="url(#e)"/>
<rect x="12" y="12" width="126" height="186" rx="4" fill="none" stroke="#D9BD82"/>
<rect x="16" y="16" width="118" height="178" rx="3" fill="none" stroke="#D9BD82" stroke-width=".6"/>
${corners}
<circle cx="75" cy="105" r="38" fill="none" stroke="#D9BD82"/>
<circle cx="75" cy="105" r="33" fill="none" stroke="#D9BD82" stroke-width=".6"/>
${petals}
<circle cx="75" cy="105" r="6" fill="#6E1A26" stroke="#D9BD82"/>`);
}

function casinoBack(): string {
  return svgDoc(`<defs><pattern id="l" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect x="3" y="3" width="6" height="6" fill="none" stroke="#fff" stroke-width="1.1" opacity=".4"/></pattern></defs>
<rect x="0.5" y="0.5" width="149" height="209" rx="10" fill="#fff" stroke="#CFCBC2"/>
<rect x="8" y="8" width="134" height="194" rx="6" fill="#1B2A4A"/>
<rect x="8" y="8" width="134" height="194" rx="6" fill="url(#l)"/>
<rect x="14" y="14" width="122" height="182" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/>`);
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: 700,
    rankSize: 48,
    palette: {
      stock: '#FFFFFF',
      edge: '#9A9A9A',
      red: '#D40000',
      black: '#111111',
      ink: '#111111',
      ...ENGLISH,
      field: '#FFFFFF',
      accent: '#111111',
    },
    felt: { light: '#2A8A4C', base: '#1D6B3A', dark: '#0F3D22' },
    ace: 'ring',
    frame: 'single',
    courts: 'original',
    back: () => '',
  },
  heritage: {
    id: 'heritage',
    name: 'Heritage',
    fontFamily: "'Libre Bodoni', Georgia, serif",
    fontWeight: 700,
    rankSize: 48,
    palette: {
      stock: '#FFFFFF',
      edge: '#CFCBC2',
      red: '#C8102E',
      black: '#141414',
      ink: '#141414',
      ...ENGLISH,
      field: '#FBF6EA',
      accent: '#141414',
    },
    felt: { light: '#2A8A4C', base: '#1D6B3A', dark: '#0F3D22' },
    ace: 'rings',
    frame: 'single',
    courts: 'figures',
    back: heritageBack,
  },
  victorian: {
    id: 'victorian',
    name: 'Victorian',
    fontFamily: "'IM Fell English SC', Georgia, serif",
    fontWeight: 400,
    rankSize: 52,
    palette: {
      stock: '#F5EEDC',
      edge: '#C9B48C',
      red: '#8B1E2D',
      black: '#22202A',
      ink: '#22202A',
      skin: '#EED5B7',
      gold: '#C9A45C',
      hair: '#2C3A5A',
      robe: '#8B1E2D',
      sash: '#2C3A5A',
      field: '#EFE4CA',
      accent: '#B08D57',
    },
    felt: { light: '#2C6446', base: '#1F4A33', dark: '#102A1D' },
    ace: 'gilt',
    frame: 'gilt',
    courts: 'figures',
    back: victorianBack,
  },
  casino: {
    id: 'casino',
    name: 'Casino',
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 600,
    rankSize: 52,
    palette: {
      stock: '#FFFFFF',
      edge: '#CFCBC2',
      red: '#D0021B',
      black: '#111111',
      ink: '#111111',
      ...ENGLISH,
      robe: '#D0021B',
      field: '#EEF2F8',
      accent: '#111111',
    },
    felt: { light: '#2A8A4C', base: '#1D6B3A', dark: '#0F3D22' },
    ace: 'plain',
    frame: 'single',
    courts: 'figures',
    back: casinoBack,
  },
};

export const DEFAULT_THEME: ThemeId = 'classic';

export const getTheme = (id: string): Theme =>
  (THEME_IDS as readonly string[]).includes(id) ? THEMES[id as ThemeId] : THEMES[DEFAULT_THEME];

const RANK_TEXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Court picture frame (also used for the classic art crop). */
const FRAME = { x: 12, y: 60, w: 126, h: 140 } as const;

function aceBody(theme: Theme, card: Card, color: string): string {
  const p = theme.palette;
  const cx = 75;
  const cy = 132;
  const ring = (r: number, stroke: string, width: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  const compass = (mark: (x: number, y: number) => string) =>
    [
      [cx, cy - 54],
      [cx, cy + 54],
      [cx - 54, cy],
      [cx + 54, cy],
    ]
      .map(([x, y]) => mark(x ?? 0, y ?? 0))
      .join('');

  switch (theme.ace) {
    case 'plain':
      return suitMark(card.suit, 20, 78, 110, color);
    case 'ring':
      return ring(52, p.black, 1) + suitMark(card.suit, 37, 94, 76, color);
    case 'rings':
      return (
        ring(54, p.black, 1.2) +
        ring(50, p.black, 1.2) +
        compass((x, y) => suitMark('D', x - 4, y - 4, 8, p.black)) +
        suitMark(card.suit, 38, 95, 74, color)
      );
    case 'gilt':
      return (
        ring(55, p.accent, 1.2) +
        ring(51, p.ink, 0.6) +
        ring(48, p.ink, 0.6) +
        compass((x, y) => suitMark(card.suit, x - 5, y - 5, 10, p.accent)) +
        suitMark(card.suit, 40, 97, 70, color) +
        suitMark(card.suit, 63, 120, 24, p.accent)
      );
  }
}

function courtBody(theme: Theme, card: Card & { rank: 11 | 12 | 13 }): string {
  const p = theme.palette;
  const { x, y, w, h } = FRAME;
  const field = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${p.field}"/>`;
  const art =
    theme.courts === 'original'
      ? // The upper half of the original double-ended court artwork, cropped into the frame.
        `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="-82 -130 165 140" preserveAspectRatio="xMidYMid slice"><image href="/cards/${cardKey(card)}.svg" x="-120" y="-168" width="240" height="336"/></svg>`
      : // A nested viewport clips the portrait to the frame without needing a clipPath id.
        `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><g transform="translate(-37.5 42.5) scale(1.5)">${courtFigure(card.rank, p)}</g></svg>`;
  const frame =
    theme.frame === 'gilt'
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${p.accent}" stroke-width="1.4"/>
<rect x="${x + 3.5}" y="${y + 3.5}" width="${w - 7}" height="${h - 7}" rx="3" fill="none" stroke="${p.ink}" stroke-width=".6"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${p.ink}" stroke-width="1.2"/>`;
  return `${field}${art}${frame}`;
}

const isCourt = (card: Card): card is Card & { rank: 11 | 12 | 13 } => card.rank >= 11;

/**
 * Inline SVG for a face-up card: big rank top left, suit top right, and a large suit or a
 * court portrait filling the rest, so the card reads at phone size and from the top strip
 * left visible in a tableau column.
 */
export function renderFace(theme: Theme, card: Card): string {
  const p = theme.palette;
  const color = isRedSuit(card.suit) ? p.red : p.black;
  const rank = `<text x="10" y="48" fill="${color}" font-family="${theme.fontFamily.replaceAll('"', "'")}" font-weight="${theme.fontWeight}" font-size="${theme.rankSize}">${RANK_TEXT[card.rank] ?? ''}</text>`;
  const corner = suitMark(card.suit, 104, 10, 36, color);
  const body = isCourt(card)
    ? courtBody(theme, card)
    : card.rank === 1
      ? aceBody(theme, card, color)
      : suitMark(card.suit, 27, 88, 96, color);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${stockRect(p)}${rank}${corner}${body}</svg>`;
}

/** CSS background for a face-down card. */
export function backImage(theme: Theme): string {
  const svg = theme.back();
  return svg ? `url("data:image/svg+xml,${encodeURIComponent(svg)}")` : 'url(/cards/back.svg)';
}
