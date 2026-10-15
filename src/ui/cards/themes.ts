import { cardKey } from '../layout';
import type { Card } from '../../engine';
import { courtFigure } from './figures';
import { isRedSuit, suitMark } from './suits';

export const THEME_IDS = ['classic', 'heritage', 'victorian', 'casino', 'neon'] as const;
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
  /** Font for the number ranks 2–10 when it differs, e.g. lining figures beside an old-style face. */
  readonly numberFont?: { readonly family: string; readonly weight: number; readonly size: number };
  readonly palette: Palette;
  /** Table felt: centre highlight, base and edge. */
  readonly felt: { readonly light: string; readonly base: string; readonly dark: string };
  readonly ace: 'ring' | 'rings' | 'gilt' | 'plain' | 'neon';
  readonly frame: 'single' | 'gilt' | 'neon';
  /** Draw suits and ranks with a soft glow (Neon). */
  readonly glow: boolean;
  /** Courts use the original deck's artwork (Classic) or the stylised portraits. */
  readonly courts: 'original' | 'figures' | 'monogram';
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

function neonBack(): string {
  return svgDoc(`<defs><pattern id="g" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#3FE0FF" stroke-width=".6" opacity=".35"/></pattern></defs>
<rect x="0.5" y="0.5" width="149" height="209" rx="10" fill="#0E0F14" stroke="#2C2F3D"/>
<rect x="8" y="8" width="134" height="194" rx="6" fill="url(#g)"/>
<rect x="12" y="12" width="126" height="186" rx="5" fill="none" stroke="#3FE0FF" stroke-width="6" opacity=".18"/>
<rect x="12" y="12" width="126" height="186" rx="5" fill="none" stroke="#3FE0FF" stroke-width="1.6"/>
<path d="M75 70 L105 105 L75 140 L45 105 Z" fill="none" stroke="#FF4D8D" stroke-width="8" opacity=".25" stroke-linejoin="round"/>
<path d="M75 70 L105 105 L75 140 L45 105 Z" fill="#0E0F14" stroke="#FF4D8D" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M75 88 L90 105 L75 122 L60 105 Z" fill="none" stroke="#FFD23D" stroke-width="1.6" stroke-linejoin="round"/>`);
}

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: 700,
    rankSize: 64,
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
    glow: false,
    frame: 'single',
    courts: 'original',
    back: () => '',
  },
  heritage: {
    id: 'heritage',
    name: 'Heritage',
    fontFamily: "'Libre Bodoni', Georgia, serif",
    fontWeight: 700,
    rankSize: 64,
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
    glow: false,
    frame: 'single',
    courts: 'figures',
    back: heritageBack,
  },
  victorian: {
    id: 'victorian',
    name: 'Victorian',
    fontFamily: "'IM Fell English SC', Georgia, serif",
    fontWeight: 400,
    rankSize: 70,
    // IM Fell only has old-style figures, which sit small and make "10" read like "IO".
    numberFont: { family: "'Libre Bodoni', Georgia, serif", weight: 700, size: 64 },
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
    glow: false,
    frame: 'gilt',
    courts: 'figures',
    back: victorianBack,
  },
  casino: {
    id: 'casino',
    name: 'Casino',
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 600,
    rankSize: 68,
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
    glow: false,
    frame: 'single',
    courts: 'figures',
    back: casinoBack,
  },
  neon: {
    id: 'neon',
    name: 'Neon',
    fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
    fontWeight: 600,
    rankSize: 68,
    palette: {
      stock: '#14151C',
      edge: '#2C2F3D',
      // Pink and cyan stand in for red and black, and differ in lightness as well as hue.
      red: '#FF4D8D',
      black: '#3FE0FF',
      ink: '#E8E9F0',
      ...ENGLISH,
      field: '#1B1D27',
      accent: '#FFD23D',
    },
    felt: { light: '#3A2C6E', base: '#211845', dark: '#0E0A1F' },
    ace: 'neon',
    frame: 'neon',
    glow: true,
    courts: 'monogram',
    back: neonBack,
  },
};

export const DEFAULT_THEME: ThemeId = 'classic';

export const getTheme = (id: string): Theme =>
  (THEME_IDS as readonly string[]).includes(id) ? THEMES[id as ThemeId] : THEMES[DEFAULT_THEME];

const RANK_TEXT = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Corner geometry: the rank's baseline and the top-right suit. Everything above y≈64 is the strip a column leaves visible. */
const RANK_BASELINE = 62;
const CORNER_SUIT = { x: 98, y: 10, size: 44 } as const;

/** Court picture frame (also used for the classic art crop). */
const FRAME = { x: 12, y: 78, w: 126, h: 122 } as const;

/** A suit symbol, with a soft halo underneath on glowing themes. */
function mark(theme: Theme, suit: Card['suit'], x: number, y: number, size: number, fill: string) {
  if (!theme.glow) return suitMark(suit, x, y, size, fill);
  const halo = suitMark(suit, x, y, size, fill).replace(
    `fill="${fill}">`,
    `fill="${fill}" stroke="${fill}" stroke-width="12" stroke-linejoin="round" opacity=".25">`,
  );
  return halo + suitMark(suit, x, y, size, fill);
}

const glowStroke = (d: string, color: string, width: number) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width * 4}" stroke-linejoin="round" opacity=".22"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;

function star(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`;
  });
  return `M${points.join(' L')} Z`;
}

const EMBLEMS: Record<11 | 12 | 13, string> = {
  13: 'M55 110 L55 92 L64 100 L75 84 L86 100 L95 92 L95 110 Z',
  12: 'M55 110 Q55 96 65 98 Q70 85 75 85 Q80 85 85 98 Q95 96 95 110 Z',
  11: star(75, 97, 14, 6),
};

function aceBody(theme: Theme, card: Card, color: string): string {
  const p = theme.palette;
  const cx = 75;
  const cy = 142;
  const ring = (r: number, stroke: string, width: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`;
  const compass = (draw: (x: number, y: number) => string) =>
    [
      [cx, cy - 54],
      [cx, cy + 54],
      [cx - 54, cy],
      [cx + 54, cy],
    ]
      .map(([x, y]) => draw(x ?? 0, y ?? 0))
      .join('');

  switch (theme.ace) {
    case 'plain':
      return suitMark(card.suit, 23, 92, 104, color);
    case 'ring':
      return ring(52, p.black, 1) + suitMark(card.suit, 39, 106, 72, color);
    case 'rings':
      return (
        ring(54, p.black, 1.2) +
        ring(50, p.black, 1.2) +
        compass((x, y) => suitMark('D', x - 4, y - 4, 8, p.black)) +
        suitMark(card.suit, 40, 107, 70, color)
      );
    case 'gilt':
      return (
        ring(55, p.accent, 1.2) +
        ring(51, p.ink, 0.6) +
        ring(48, p.ink, 0.6) +
        compass((x, y) => suitMark(card.suit, x - 5, y - 5, 10, p.accent)) +
        suitMark(card.suit, 42, 109, 66, color) +
        suitMark(card.suit, 64, 131, 22, p.accent)
      );
    case 'neon':
      return (
        `<circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="${p.accent}" stroke-width="6" opacity=".2"/>` +
        ring(52, p.accent, 1.5) +
        mark(theme, card.suit, 37, 104, 76, color)
      );
  }
}

function courtBody(theme: Theme, card: Card & { rank: 11 | 12 | 13 }, color: string): string {
  const p = theme.palette;
  const { x, y, w, h } = FRAME;
  const field = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${p.field}"/>`;
  let art: string;
  switch (theme.courts) {
    case 'original':
      // The upper half of the original double-ended court artwork, cropped into the frame.
      art = `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="-82 -130 165 140" preserveAspectRatio="xMidYMid slice"><image href="/cards/${cardKey(card)}.svg" x="-120" y="-168" width="240" height="336"/></svg>`;
      break;
    case 'figures':
      // A nested viewport clips the portrait to the frame without needing a clipPath id.
      art = `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"><g transform="translate(-37.5 42.5) scale(1.5)">${courtFigure(card.rank, p)}</g></svg>`;
      break;
    case 'monogram': {
      // A big outlined letter under a crown, tiara or star, all in glowing strokes.
      const letter = RANK_TEXT[card.rank] ?? '';
      const text = (stroke: number, opacity: number) =>
        `<text x="75" y="190" text-anchor="middle" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round" opacity="${opacity}" font-family="${theme.fontFamily.replaceAll('"', "'")}" font-weight="${theme.fontWeight}" font-size="86">${letter}</text>`;
      art = glowStroke(EMBLEMS[card.rank], p.accent, 2) + text(9, 0.22) + text(2.4, 1);
      break;
    }
  }
  let frame: string;
  switch (theme.frame) {
    case 'gilt':
      frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${p.accent}" stroke-width="1.4"/>
<rect x="${x + 3.5}" y="${y + 3.5}" width="${w - 7}" height="${h - 7}" rx="3" fill="none" stroke="${p.ink}" stroke-width=".6"/>`;
      break;
    case 'neon':
      frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${color}" stroke-width="1.2" opacity=".55"/>`;
      break;
    case 'single':
      frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${p.ink}" stroke-width="1.2"/>`;
      break;
  }
  return `${field}${art}${frame}`;
}

const isCourt = (card: Card): card is Card & { rank: 11 | 12 | 13 } => card.rank >= 11;

/**
 * Inline SVG for a face-up card: big rank top left, suit top right, and a large suit or a
 * court picture filling the rest, so the card reads at phone size and from the top strip
 * left visible in a tableau column.
 */
export function renderFace(theme: Theme, card: Card): string {
  const p = theme.palette;
  const color = isRedSuit(card.suit) ? p.red : p.black;
  const typeface =
    card.rank >= 2 && card.rank <= 10 && theme.numberFont
      ? theme.numberFont
      : { family: theme.fontFamily, weight: theme.fontWeight, size: theme.rankSize };
  const font = `font-family="${typeface.family.replaceAll('"', "'")}" font-weight="${typeface.weight}" font-size="${typeface.size}"`;
  const label = RANK_TEXT[card.rank] ?? '';
  const halo = theme.glow
    ? `<text x="8" y="${RANK_BASELINE}" fill="${color}" stroke="${color}" stroke-width="8" stroke-linejoin="round" opacity=".22" ${font}>${label}</text>`
    : '';
  const rank = `${halo}<text x="8" y="${RANK_BASELINE}" fill="${color}" ${font}>${label}</text>`;
  const corner = mark(theme, card.suit, CORNER_SUIT.x, CORNER_SUIT.y, CORNER_SUIT.size, color);
  const body = isCourt(card)
    ? courtBody(theme, card, color)
    : card.rank === 1
      ? aceBody(theme, card, color)
      : mark(theme, card.suit, 31, 100, 88, color);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">${stockRect(p)}${rank}${corner}${body}</svg>`;
}

/** CSS background for a face-down card. */
export function backImage(theme: Theme): string {
  const svg = theme.back();
  return svg ? `url("data:image/svg+xml,${encodeURIComponent(svg)}")` : 'url(/cards/back.svg)';
}
