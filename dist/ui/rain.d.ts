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
/** One horizontal scanline of rain. Deterministic in `tick`. */
export declare function matrixLine(width: number, tick: number, offset?: number): RainCell[];
/** Dense vertical rain for the panel: `rows` lines of `width` glyphs. */
export declare function rainBlock(width: number, rows: number, tick: number): RainCell[][];
