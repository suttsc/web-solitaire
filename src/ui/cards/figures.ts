import type { Palette } from './themes';

/**
 * Stylised court portraits in the traditional English-pattern colours. Each is drawn in a
 * 150-wide box with the figure spanning roughly x 35–115, y 26–105 (shoulders at the bottom).
 */

const outline = (p: Palette) => `stroke="${p.ink}" stroke-width="0.8" stroke-linejoin="round"`;

function shoulders(p: Palette, robe: string, sash: string): string {
  const o = outline(p);
  return `<path fill="${robe}" ${o} d="M35 105 L35 88 Q44 76 57 73 L93 73 Q106 76 115 88 L115 105 Z"/>
<path fill="${sash}" ${o} d="M57 73 L68 73 L98 105 L85 105 Z"/>
<path fill="${p.gold}" ${o} d="M60 69 Q75 81 90 69 L93 73 Q75 87 57 73 Z"/>`;
}

const face = (p: Palette) =>
  `<ellipse fill="${p.skin}" ${outline(p)} cx="75" cy="56" rx="11" ry="13"/>
<ellipse fill="${p.ink}" cx="71" cy="54" rx="1.4" ry="1"/>
<ellipse fill="${p.ink}" cx="79" cy="54" rx="1.4" ry="1"/>`;

function king(p: Palette): string {
  const o = outline(p);
  return `<path fill="${p.hair}" ${o} d="M61 50 Q58 66 62 70 L88 70 Q92 66 89 50 Z"/>
${shoulders(p, p.robe, p.sash)}
${face(p)}
<path fill="${p.hair}" ${o} d="M65 60 Q75 77 85 60 Q83 71 75 73 Q67 71 65 60 Z"/>
<path fill="${p.gold}" ${o} d="M62 44 L62 32 L67 38 L71 28 L75 36 L79 28 L83 38 L88 32 L88 44 Z"/>
<rect fill="${p.robe}" ${o} x="62" y="41" width="26" height="4"/>
<rect fill="${p.ink}" x="103" y="36" width="2.5" height="56"/>
<path fill="${p.sash}" ${o} d="M105 40 Q116 44 114 56 L105 52 Z"/>`;
}

function queen(p: Palette): string {
  const o = outline(p);
  return `<path fill="${p.hair}" ${o} d="M60 48 Q55 72 58 90 L92 90 Q95 72 90 48 Z"/>
${shoulders(p, p.sash, p.robe)}
${face(p)}
<ellipse fill="${p.robe}" cx="75" cy="63" rx="3" ry="1.2"/>
<path fill="${p.gold}" ${o} d="M63 44 L63 36 Q69 27 75 34 Q81 27 87 36 L87 44 Z"/>
<circle fill="${p.sash}" cx="69" cy="32" r="1.8"/><circle fill="${p.robe}" cx="75" cy="33" r="1.8"/><circle fill="${p.sash}" cx="81" cy="32" r="1.8"/>
<path fill="none" stroke="${p.ink}" stroke-width="1.6" d="M101 92 Q103 70 104 52"/>
<circle fill="${p.robe}" ${o} cx="104" cy="48" r="6"/>
<circle fill="${p.gold}" cx="104" cy="48" r="2.4"/>`;
}

function jack(p: Palette): string {
  const o = outline(p);
  return `<path fill="${p.hair}" ${o} d="M61 48 Q59 62 63 68 L87 68 Q91 62 89 48 Z"/>
${shoulders(p, p.sash, p.gold)}
${face(p)}
<path fill="${p.hair}" ${o} d="M68 63 Q75 60 82 63 Q75 65 68 63 Z"/>
<path fill="${p.robe}" ${o} d="M59 46 Q73 30 92 39 L91 46 Z"/>
<rect fill="${p.gold}" ${o} x="59" y="43" width="32" height="4"/>
<path fill="${p.sash}" ${o} d="M88 40 Q98 30 104 22 Q100 34 91 43 Z"/>
<rect fill="${p.ink}" x="103" y="34" width="2.5" height="60"/>
<path fill="${p.sash}" ${o} d="M104 30 L112 36 L104 44 Z"/>
<path fill="${p.sash}" ${o} d="M104 30 L96 36 L104 44 Z"/>`;
}

export function courtFigure(rank: 11 | 12 | 13, palette: Palette): string {
  if (rank === 13) return king(palette);
  if (rank === 12) return queen(palette);
  return jack(palette);
}
