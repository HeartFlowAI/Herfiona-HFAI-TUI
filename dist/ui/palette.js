import { createElement as h } from 'react';
import { Box, Text } from 'ink';
import { C } from './chrome.js';
import { width as textWidth } from './format.js';
/** Case-insensitive subsequence match, ranked by how tight the match is. */
export function fuzzyScore(query, target) {
    if (!query)
        return 1;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let score = 0;
    let ti = 0;
    let streak = 0;
    for (const ch of q) {
        const found = t.indexOf(ch, ti);
        if (found === -1)
            return -1;
        streak = found === ti ? streak + 1 : 0;
        score += 1 + streak * 2 - (found - ti) * 0.1;
        ti = found + 1;
    }
    return score;
}
export function filterPalette(items, query) {
    if (!query.trim())
        return items;
    return items
        .map((item) => ({ item, score: fuzzyScore(query, `${item.label} ${item.id} ${item.hint ?? ''}`) }))
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.item);
}
/** A centered, bordered command palette overlay. */
export function PaletteView({ title, query, items, index, columns, maxRows, emptyText }) {
    const boxWidth = Math.min(Math.max(44, Math.floor(columns * 0.7)), columns - 4);
    const inner = boxWidth - 4;
    const visibleRows = Math.max(3, Math.min(items.length, maxRows - 6));
    // Keep the highlighted row in view.
    const start = Math.max(0, Math.min(index - Math.floor(visibleRows / 2), Math.max(0, items.length - visibleRows)));
    const window = items.slice(start, start + visibleRows);
    const rows = [
        h(Box, { key: 'title', justifyContent: 'space-between' }, h(Text, { color: C.hot, bold: true }, title), h(Text, { color: C.dim }, `${items.length}${items.length === 1 ? ' result' : ' results'}`)),
        h(Box, { key: 'query' }, h(Text, { color: C.heart, bold: true }, '\u276f '), h(Text, { color: C.ink }, query), h(Text, { color: C.pink }, '\u2588')),
        h(Text, { key: 'rule', color: C.line }, '\u2500'.repeat(inner)),
    ];
    if (!items.length) {
        rows.push(h(Text, { key: 'empty', color: C.dim }, `  ${emptyText ?? 'no matches'}`));
    }
    else {
        let lastGroup;
        for (let i = 0; i < window.length; i++) {
            const item = window[i];
            const absolute = start + i;
            const selected = absolute === index;
            if (item.group && item.group !== lastGroup) {
                rows.push(h(Text, { key: `g-${start}-${i}-${item.group}`, color: C.violet }, `  ${item.group}`));
                lastGroup = item.group;
            }
            const bg = selected ? C.deep : undefined;
            rows.push(h(Box, { key: `item-${start}-${i}-${item.id}`, justifyContent: 'space-between' }, h(Text, { backgroundColor: bg, color: selected ? C.ink : item.disabled ? C.dim : C.muted }, `${selected ? '\u276f ' : '  '}${item.label}`, item.hint ? h(Text, { color: selected ? C.blush : C.dim }, `  ${item.hint}`) : null), item.detail ? h(Text, { backgroundColor: bg, color: selected ? C.pink : C.dim }, `${item.detail} `) : h(Text, { backgroundColor: bg }, ' ')));
        }
        if (items.length > visibleRows) {
            rows.push(h(Text, { key: 'more', color: C.dim }, `  ${start + 1}\u2013${start + window.length} of ${items.length}`));
        }
    }
    rows.push(h(Text, { key: 'hint', color: C.dim }, '  up/down move   enter choose   esc close'));
    return h(Box, { flexDirection: 'column', alignItems: 'center' }, h(Box, { flexDirection: 'column', width: boxWidth, borderStyle: 'round', borderColor: C.pink, paddingX: 1 }, ...rows));
}
//# sourceMappingURL=palette.js.map