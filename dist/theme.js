export const palette = {
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
export function detectColorLevel(env = process.env, isTTY = process.stdout.isTTY ?? false) {
    if (env.NO_COLOR !== undefined || env.TERM === 'dumb' || env.FORCE_COLOR === '0')
        return 0;
    if (!isTTY && env.FORCE_COLOR === undefined)
        return 0;
    return /^(truecolor|24bit)$/i.test(env.COLORTERM ?? '') || env.FORCE_COLOR === '3' ? 3 : 2;
}
function rgb(level, rgbValue, fallback256, text) {
    if (level === 0)
        return text;
    if (level === 3)
        return `\u001b[38;2;${rgbValue[0]};${rgbValue[1]};${rgbValue[2]}m${text}\u001b[39m`;
    return `\u001b[38;5;${fallback256}m${text}\u001b[39m`;
}
export function paint(level = detectColorLevel()) {
    const style = (code) => (text) => (level === 0 ? text : `\u001b[${code}m${text}\u001b[0m`);
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
//# sourceMappingURL=theme.js.map