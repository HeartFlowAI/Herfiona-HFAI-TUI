import { type ReactNode } from 'react';
export interface Palette {
    accent: string;
    pink: string;
    hot: string;
    blush: string;
    violet: string;
    deep: string;
    line: string;
    muted: string;
    dim: string;
    code: string;
    user: string;
    warn: string;
    err: string;
    ok: string;
    ink: string;
    heart: string;
}
export declare const THEMES: Record<string, {
    label: string;
    palette: Palette;
}>;
/**
 * The active palette. This object is mutated in place by setTheme so every
 * component that reads C.* at render time picks up the change on the next frame.
 */
export declare const C: Palette;
export declare function setTheme(name: string): string;
export declare function themeNames(): string[];
export declare function Rule({ width, color }: {
    width?: number;
    color?: string;
}): ReactNode;
export declare function Wordmark(): ReactNode;
export declare function Tag({ label, value, color }: {
    label: string;
    value: string;
    color?: string;
}): ReactNode;
