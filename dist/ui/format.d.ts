import { type ReactNode } from 'react';
export interface ChatEntry {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool' | 'error' | 'thinking';
    content: string;
    toolName?: string;
    toolOk?: boolean;
    diff?: string;
}
export declare const width: (s: string) => number;
/** Flatten one entry into an array of single-line React nodes. */
export declare function entryLines(entry: ChatEntry, max: number): ReactNode[];
