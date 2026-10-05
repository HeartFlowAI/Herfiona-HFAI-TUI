/**
 * Pink matrix rain — falling glyphs for Aurora's panel and accents.
 *
 * Deterministic per tick so it animates without storing any state. All glyphs
 * are terminal width 1 (halfwidth katakana, braille, hearts, stars) so columns
 * stay aligned.
 */

export interface RainCell {
  char: string;
  color: string;
}

// Halfwidth katakana — the classic matrix look, width 1.
const KATAKANA =
  '\uff71\uff72\uff73\uff74\uff75\uff76\uff77\uff78\uff79\uff7a\uff7b\uff7c\uff7d\uff7e\uff7f\uff80\uff81\uff82\uff83\uff84\uff85\uff86\uff87\uff88\uff89\uff8a\uff8b\uff8c\uff8d\uff8e\uff8f\uff90\uff91\uff92\uff93';

// Cute set: hearts, stars, flowers, sparkles — all width 1 in a mono font.
const CUTE = '\u2661\u2665\u2665\u2727\u2726\u2728\u273f\u2740\u2741\u2735\u2736\u2737\u2738\u2739\u273a\u274a\u274b\u2766\u2618\u2619\u2749\u262e\u2670\u266a\u266b';

/** Mix the two sets so the rain feels both matrix and girly. */
function glyphAt(i: number, tick: number): string {
  const seed = (i * 7 + tick * 3) % 10;
  if (seed < 6) return KATAKANA[(i * 3 + tick * 5) % KATAKANA.length] ?? '\u00b7';
  return CUTE[(i * 5 + tick) % CUTE.length] ?? '\u2661';
}

// Dark plum -> hot pink -> white, the rain's vertical gradient.
const RAIN = ['#3a2350', '#5a3a78', '#8a4fb0', '#c06fd8', '#ff6fd8', '#ff9de2', '#ffe3fb'];

/** One horizontal scanline of rain. Deterministic in `tick`. */
export function matrixLine(width: number, tick: number, offset = 0): RainCell[] {
  const cells: RainCell[] = [];
  for (let i = 0; i < width; i++) {
    const phase = (i * 7 + tick * 13 + offset) % 37;
    if (phase < 2) {
      cells.push({ char: glyphAt(i, tick), color: RAIN[6]! }); // bright head
    } else if (phase < 5) {
      cells.push({ char: glyphAt(i, tick + 1), color: RAIN[5]! });
    } else if (phase < 8) {
      cells.push({ char: glyphAt(i, tick + 2), color: RAIN[4]! });
    } else if (phase < 11) {
      cells.push({ char: glyphAt(i, tick + 3), color: RAIN[3]! });
    } else if (phase < 14) {
      cells.push({ char: '\u00b7', color: RAIN[2]! });
    } else {
      cells.push({ char: ' ', color: RAIN[0]! });
    }
  }
  return cells;
}

/** Dense vertical rain for the panel: `rows` lines of `width` glyphs. */
export function rainBlock(width: number, rows: number, tick: number): RainCell[][] {
  const block: RainCell[][] = [];
  for (let row = 0; row < rows; row++) {
    // Each row trails a few ticks behind the one above so it reads as falling.
    block.push(matrixLine(width, tick + row * 2, row * 11));
  }
  return block;
}
