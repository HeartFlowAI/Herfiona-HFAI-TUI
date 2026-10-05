import { createElement as h } from 'react';
import { Text } from 'ink';
import { C } from './chrome.js';
import { styleReply } from '../agent/text.js';
const ANSI = /\u001b\[[0-9;]*m/g;
/** Approximate terminal display width: emoji, CJK and wide symbols count as 2. */
function charWidth(code) {
    if (code === 0)
        return 0;
    // Combining marks.
    if (code >= 0x0300 && code <= 0x036f)
        return 0;
    // Common wide ranges: CJK, Hangul, fullwidth forms.
    if ((code >= 0x1100 && code <= 0x115f) ||
        (code >= 0x2e80 && code <= 0xa4cf) ||
        (code >= 0xac00 && code <= 0xd7a3) ||
        (code >= 0xf900 && code <= 0xfaff) ||
        (code >= 0xfe30 && code <= 0xfe6f) ||
        (code >= 0xff00 && code <= 0xff60) ||
        (code >= 0xffe0 && code <= 0xffe6)) {
        return 2;
    }
    // Emoji & pictographs.
    if ((code >= 0x2600 && code <= 0x27bf) ||
        (code >= 0x1f000 && code <= 0x1faff) ||
        (code >= 0x2190 && code <= 0x21ff) ||
        (code >= 0x2300 && code <= 0x23ff) ||
        (code >= 0x2b00 && code <= 0x2bff)) {
        return 2;
    }
    // Variation selectors are zero-width.
    if (code >= 0xfe00 && code <= 0xfe0f)
        return 0;
    return 1;
}
export const width = (s) => {
    let total = 0;
    for (const ch of s.replace(ANSI, ''))
        total += charWidth(ch.codePointAt(0) ?? 0);
    return total;
};
function truncate(text, max) {
    let out = '';
    let used = 0;
    for (const ch of text) {
        const w = charWidth(ch.codePointAt(0) ?? 0);
        if (used + w > max)
            break;
        out += ch;
        used += w;
    }
    return out;
}
function wrap(text, max) {
    if (max < 4)
        return [text];
    const out = [];
    for (const rawLine of text.split('\n')) {
        if (width(rawLine) <= max) {
            out.push(rawLine);
            continue;
        }
        let line = '';
        for (const word of rawLine.split(' ')) {
            const candidate = line ? `${line} ${word}` : word;
            if (width(candidate) > max && line) {
                out.push(line);
                line = word;
            }
            else {
                line = candidate;
            }
        }
        if (line)
            out.push(line);
    }
    return out;
}
/** Inline code spans within a line -> styled children. */
function InlineContent({ text }) {
    const parts = text.split(/(`[^`]+`)/g).filter((p) => p !== '');
    return h(Text, {}, ...parts.map((part, i) => part.startsWith('`') && part.endsWith('`') && part.length > 2
        ? h(Text, { key: i, color: C.code, backgroundColor: '#2a1f3d' }, part.slice(1, -1))
        : h(Text, { key: i }, part)));
}
/** Flatten one entry into an array of single-line React nodes. */
export function entryLines(entry, max) {
    const lines = [];
    const key = `${entry.id}`;
    if (entry.role === 'user') {
        const wrapped = wrap(entry.content, max - 2);
        lines.push(h(Text, { key: `${key}-u0` }, h(Text, { color: C.user, bold: true }, ' \u2503 '), h(Text, { color: C.ink, bold: true }, wrapped[0] ?? '')));
        for (let i = 1; i < wrapped.length; i++) {
            lines.push(h(Text, { key: `${key}-u${i}` }, h(Text, { color: C.user }, ' \u2503 '), h(Text, { color: C.ink }, wrapped[i])));
        }
        lines.push(h(Text, { key: `${key}-g` }, ' '));
        return lines;
    }
    if (entry.role === 'system') {
        for (const [i, line] of wrap(entry.content, max - 3).entries()) {
            lines.push(h(Text, { key: `${key}-s${i}`, color: C.muted }, `${i === 0 ? ' \u2502 ' : '   '}${line}`));
        }
        lines.push(h(Text, { key: `${key}-g` }, ' '));
        return lines;
    }
    if (entry.role === 'thinking') {
        const body = wrap(entry.content, max - 5);
        lines.push(h(Text, { key: `${key}-th0`, color: C.violet }, ' \u2726 thinking'));
        for (const [i, line] of body.slice(0, 24).entries()) {
            lines.push(h(Text, { key: `${key}-th${i}`, color: C.dim, italic: true }, `   ${line}`));
        }
        if (body.length > 24)
            lines.push(h(Text, { key: `${key}-thmore`, color: C.dim }, `   (${body.length - 24} more)`));
        lines.push(h(Text, { key: `${key}-g` }, ' '));
        return lines;
    }
    if (entry.role === 'error') {
        for (const [i, line] of wrap(entry.content, max - 3).entries()) {
            lines.push(h(Text, { key: `${key}-e${i}`, color: C.err }, `${i === 0 ? ' ! ' : '   '}${line}`));
        }
        lines.push(h(Text, { key: `${key}-g` }, ' '));
        return lines;
    }
    if (entry.role === 'tool') {
        const glyph = entry.toolOk === false ? '\u2717' : '\u2713';
        const color = entry.toolOk === false ? C.err : C.hot;
        const head = `\u2962 ${glyph} ${entry.toolName ?? 'tool'}`;
        const room = Math.max(0, max - width(head) - 2);
        const summary = entry.content.split('\n').find((l) => l.trim()) ?? '';
        lines.push(h(Text, { key: `${key}-t` }, h(Text, { color: C.violet }, ' \u2962 '), h(Text, { color }, `${glyph} ${entry.toolName ?? 'tool'}`), h(Text, { color: C.dim }, room > 4 ? `  ${truncate(summary, room)}` : '')));
        if (entry.diff) {
            for (const [i, line] of entry.diff.split('\n').slice(0, 40).entries()) {
                const c = line.startsWith('+') ? C.ok : line.startsWith('-') ? C.err : C.dim;
                lines.push(h(Text, { key: `${key}-d${i}`, color: c }, `   ${line}`));
            }
        }
        return lines;
    }
    // Assistant: markdown-ish rendering, prefixed with a pink bar.
    const body = renderMarkdownLines(styleReply(entry.content), max - 2);
    for (const [i, node] of body.entries()) {
        lines.push(h(Text, { key: `${key}-a${i}` }, h(Text, { color: i === 0 ? C.pink : C.line }, ' \u2503 '), node));
    }
    lines.push(h(Text, { key: `${key}-g` }, ' '));
    return lines;
}
/** Minimal markdown -> flat lines: fenced code, headings, bullets, inline code. */
function renderMarkdownLines(content, max) {
    const nodes = [];
    const segments = content.split(/```/);
    segments.forEach((segment, segIndex) => {
        if (segIndex % 2 === 1) {
            const nl = segment.indexOf('\n');
            const lang = nl === -1 ? '' : segment.slice(0, nl).trim();
            const code = (nl === -1 ? segment : segment.slice(nl + 1)).replace(/\n$/, '');
            nodes.push(h(Text, { key: `c${segIndex}-l`, color: C.violet }, `\u250c ${lang || 'code'}`));
            for (const [i, line] of code.split('\n').entries()) {
                nodes.push(h(Text, { key: `c${segIndex}-${i}`, color: C.code }, `\u2502 ${truncate(line, max - 2)}`));
            }
            nodes.push(h(Text, { key: `c${segIndex}-r`, color: C.violet }, '\u2514'));
            return;
        }
        for (const [i, line] of segment.split('\n').entries()) {
            if (line.trim() === '') {
                nodes.push(h(Text, { key: `sp${segIndex}-${i}` }, ' '));
                continue;
            }
            const heading = /^(#{1,6})\s+(.*)$/.exec(line);
            if (heading) {
                nodes.push(h(Text, { key: `h${segIndex}-${i}`, bold: true, color: C.accent }, (heading[2] ?? '').slice(0, max)));
                continue;
            }
            const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
            if (bullet) {
                const wrapped = wrap(bullet[2] ?? '', max - 3);
                wrapped.forEach((part, j) => {
                    nodes.push(h(Text, { key: `b${segIndex}-${i}-${j}` }, j === 0 ? h(Text, { color: C.pink }, '  \u2022 ') : h(Text, {}, '    '), h(InlineContent, { text: part })));
                });
                continue;
            }
            for (const part of wrap(line, max)) {
                nodes.push(h(InlineContent, { key: `l${segIndex}-${i}`, text: part }));
            }
        }
    });
    return nodes;
}
//# sourceMappingURL=format.js.map