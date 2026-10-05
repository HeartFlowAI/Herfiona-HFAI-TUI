import { createElement as h } from 'react';
import { Box, Text } from 'ink';
const PINK = {
    accent: '#e9c7ff',
    pink: '#ff6fd8',
    hot: '#ff9de2',
    blush: '#ffc4ee',
    violet: '#a97fe0',
    deep: '#3a2a55',
    line: '#332745',
    muted: '#a79bc4',
    dim: '#6f6488',
    code: '#f6ecff',
    user: '#8ef0c4',
    warn: '#ffbe7a',
    err: '#ff7aa2',
    ok: '#8ef0c4',
    ink: '#e2d6f5',
    heart: '#ff5fb0',
};
const SAKURA = {
    accent: '#ffd6e8',
    pink: '#ff8fbf',
    hot: '#ffb3d4',
    blush: '#ffe0ee',
    violet: '#d98fc0',
    deep: '#4a2b3d',
    line: '#3d2733',
    muted: '#d3a9be',
    dim: '#8a6a7a',
    code: '#fff0f6',
    user: '#9fe8c9',
    warn: '#ffc38a',
    err: '#ff8aa8',
    ok: '#9fe8c9',
    ink: '#ffe6f0',
    heart: '#ff6fa6',
};
const VIOLET = {
    accent: '#d7c5ff',
    pink: '#b48cff',
    hot: '#cbb0ff',
    blush: '#e2d4ff',
    violet: '#8b6fd6',
    deep: '#2f2748',
    line: '#2a2340',
    muted: '#a99fc7',
    dim: '#6b6488',
    code: '#efe9ff',
    user: '#8ee0d0',
    warn: '#ffbe7a',
    err: '#ff7aa2',
    ok: '#8ee0d0',
    ink: '#e6dcff',
    heart: '#a878ff',
};
const MIDNIGHT = {
    accent: '#a9c7ff',
    pink: '#6fa8ff',
    hot: '#9cc4ff',
    blush: '#c4ddff',
    violet: '#5f7fd6',
    deep: '#1f2b45',
    line: '#1d2536',
    muted: '#8f9fc4',
    dim: '#5b6488',
    code: '#e9f1ff',
    user: '#7fe0c0',
    warn: '#ffc178',
    err: '#ff7a9a',
    ok: '#7fe0c0',
    ink: '#dce8ff',
    heart: '#4f8fff',
};
const MATCHA = {
    accent: '#cfe8b8',
    pink: '#8fd66f',
    hot: '#b0e88c',
    blush: '#e0f4cc',
    violet: '#6fa860',
    deep: '#26361f',
    line: '#243020',
    muted: '#9fb894',
    dim: '#66795c',
    code: '#eef8e6',
    user: '#e8d98f',
    warn: '#ffc978',
    err: '#ff8a7a',
    ok: '#b6e88f',
    ink: '#e6f2da',
    heart: '#6fbf4f',
};
export const THEMES = {
    pink: { label: 'pink', palette: PINK },
    sakura: { label: 'sakura', palette: SAKURA },
    violet: { label: 'violet', palette: VIOLET },
    midnight: { label: 'midnight', palette: MIDNIGHT },
    matcha: { label: 'matcha', palette: MATCHA },
};
/**
 * The active palette. This object is mutated in place by setTheme so every
 * component that reads C.* at render time picks up the change on the next frame.
 */
export const C = { ...PINK };
export function setTheme(name) {
    const theme = THEMES[name] ?? THEMES.pink;
    if (theme)
        Object.assign(C, theme.palette);
    return THEMES[name] ? name : 'pink';
}
export function themeNames() {
    return Object.keys(THEMES);
}
export function Rule({ width, color = C.line }) {
    const w = width ?? (process.stdout.columns ?? 80);
    return h(Text, { color }, '\u2500'.repeat(Math.max(0, w)));
}
export function Wordmark() {
    return h(Box, {}, h(Text, { color: C.heart }, '\u2665 '), h(Text, { color: C.pink, bold: true }, 'aurora'), h(Text, { color: C.violet }, ' / '), h(Text, { color: C.dim }, 'heartflow companion'));
}
export function Tag({ label, value, color = C.muted }) {
    return h(Text, {}, h(Text, { color: C.dim }, `${label} `), h(Text, { color }, value));
}
//# sourceMappingURL=chrome.js.map