import { type ReactNode } from 'react';
export interface PaletteItem {
    id: string;
    label: string;
    hint?: string;
    /** Right-aligned detail, e.g. "current" or "cloud". */
    detail?: string;
    group?: string;
    disabled?: boolean;
}
/** Case-insensitive subsequence match, ranked by how tight the match is. */
export declare function fuzzyScore(query: string, target: string): number;
export declare function filterPalette(items: PaletteItem[], query: string): PaletteItem[];
export interface PaletteViewProps {
    title: string;
    query: string;
    items: PaletteItem[];
    index: number;
    columns: number;
    maxRows: number;
    emptyText?: string;
}
/** A centered, bordered command palette overlay. */
export declare function PaletteView({ title, query, items, index, columns, maxRows, emptyText }: PaletteViewProps): ReactNode;
