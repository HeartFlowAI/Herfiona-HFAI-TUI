/**
 * A tiny LCS-based unified diff for approval previews and tool output.
 * Bounded and dependency-free; falls back to a simple line replacement when
 * inputs are too large to diff cheaply.
 */

const MAX_LINES = 2000;

function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  // DP table of prefix lengths; bounded by MAX_LINES so memory stays sane.
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** Produce a compact unified diff (without @@ hunk headers). */
export function unifiedDiff(oldText: string, newText: string, context = 2): string {
  if (oldText === newText) return '';
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  if (oldLines.length > MAX_LINES || newLines.length > MAX_LINES) {
    return `- ${oldLines.length} lines\n+ ${newLines.length} lines (diff too large to render)`;
  }

  const pairs = lcs(oldLines, newLines);
  const changes: { type: '+' | '-' | ' '; text: string }[] = [];
  let oi = 0;
  let ni = 0;
  const emitTo = (oiEnd: number, niEnd: number) => {
    while (oi < oiEnd) changes.push({ type: '-', text: oldLines[oi++] ?? '' });
    while (ni < niEnd) changes.push({ type: '+', text: newLines[ni++] ?? '' });
  };
  for (const [ai, bi] of pairs) {
    emitTo(ai, bi);
    changes.push({ type: ' ', text: oldLines[ai] ?? '' });
    oi = ai + 1;
    ni = bi + 1;
  }
  emitTo(oldLines.length, newLines.length);

  // Keep only lines near a change (context), and collapse long unchanged runs.
  const changeIdx: number[] = [];
  for (let index = 0; index < changes.length; index++) {
    if (changes[index]!.type !== ' ') changeIdx.push(index);
  }
  const keep = new Set<number>();
  for (const index of changeIdx) {
    for (let d = -context; d <= context; d++) {
      const j = index + d;
      if (j >= 0 && j < changes.length) keep.add(j);
    }
  }
  const out: string[] = [];
  let hidden = 0;
  for (let index = 0; index < changes.length; index++) {
    if (keep.has(index)) {
      if (hidden > 0) {
        out.push(`  \u22ef ${hidden} unchanged`);
        hidden = 0;
      }
      const change = changes[index]!;
      out.push(change.type === ' ' ? `  ${change.text}` : `${change.type} ${change.text}`);
    } else {
      hidden++;
    }
  }
  if (hidden > 0) out.push(`  \u22ef ${hidden} unchanged`);
  return out.join('\n');
}
