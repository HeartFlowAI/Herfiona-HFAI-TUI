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

export const palette: Palette = {
  accent: [199, 179, 245],
  accent256: 183,
  pink: [255, 111, 216],
  pink256: 213,
  warm: [255, 169, 130],
  warm256: 216,
  muted: [150, 143, 170],
  muted256: 245,
  danger: [255, 110, 140],
  danger256: 204,
  ok: [140, 240, 190],
  ok256: 121,
  bg: [13, 11, 18],
};

export function detectColorLevel(env: NodeJS.ProcessEnv = process.env, isTTY = process.stdout.isTTY ?? false): ColorLevel {
  if (env.NO_COLOR !== undefined || env.TERM === 'dumb' || env.FORCE_COLOR === '0') return 0;
  if (!isTTY && env.FORCE_COLOR === undefined) return 0;
  return /^(truecolor|24bit)$/i.test(env.COLORTERM ?? '') || env.FORCE_COLOR === '3' ? 3 : 2;
}

function rgb(level: ColorLevel, rgbValue: [number, number, number], fallback256: number, text: string): string {
  if (level === 0) return text;
  if (level === 3) return `\u001b[38;2;${rgbValue[0]};${rgbValue[1]};${rgbValue[2]}m${text}\u001b[39m`;
  return `\u001b[38;5;${fallback256}m${text}\u001b[39m`;
}

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

export function paint(level: ColorLevel = detectColorLevel()): Paint {
  const style = (code: string) => (text: string) => (level === 0 ? text : `\u001b[${code}m${text}\u001b[0m`);
  return {
    accent: (text) => rgb(level, palette.accent, palette.accent256, text),
    pink: (text) => rgb(level, palette.pink, palette.pink256, text),
    warm: (text) => rgb(level, palette.warm, palette.warm256, text),
    muted: (text) => rgb(level, palette.muted, palette.muted256, text),
    danger: (text) => rgb(level, palette.danger, palette.danger256, text),
    ok: (text) => rgb(level, palette.ok, palette.ok256, text),
    bold: style('1'),
    dim: style('2'),
  };
}

export const HEART = '\u2665';
