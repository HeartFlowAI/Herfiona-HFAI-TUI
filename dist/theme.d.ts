/**
 * Aurora's palette, lifted from the heartflow UI.
 * Truecolor when the terminal supports it, 256-color otherwise, plain as last resort.
 */
export type ColorLevel = 0 | 2 | 3;
export interface Palette {
    accent: [number, number, number];
    accent256: number;
    pink: [number, number, number];
    pink256: number;
    warm: [number, number, number];
    warm256: number;
    muted: [number, number, number];
    muted256: number;
    danger: [number, number, number];
    danger256: number;
    ok: [number, number, number];
    ok256: number;
    bg: [number, number, number];
}
export declare const palette: Palette;
export declare function detectColorLevel(env?: NodeJS.ProcessEnv, isTTY?: boolean): ColorLevel;
export interface Paint {
    accent(text: string): string;
    pink(text: string): string;
    warm(text: string): string;
    muted(text: string): string;
    danger(text: string): string;
    ok(text: string): string;
    bold(text: string): string;
    dim(text: string): string;
}
export declare function paint(level?: ColorLevel): Paint;
export declare const HEART = "\u2665";
