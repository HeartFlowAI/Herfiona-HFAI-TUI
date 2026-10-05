import type { Message } from './types.js';
export interface SessionMeta {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    workspace: string;
    model: string;
    provider?: string;
    persona?: string;
    /** How many messages the session holds (for the resume list). */
    messageCount?: number;
}
export interface SavedSession extends SessionMeta {
    messages: Message[];
}
export declare function newSessionId(): string;
export declare function saveSession(session: SavedSession): void;
export declare function loadSession(id: string): SavedSession | undefined;
export declare function listSessions(): SessionMeta[];
export declare function deleteSession(id: string): void;
/** Append a single event line; used for crash-tolerant streaming logs. */
export declare function appendEvent(id: string, event: unknown): void;
/** Human-friendly relative time, e.g. "4m ago". */
export declare function relativeTime(iso: string, now?: number): string;
export declare function titleFromInput(input: string): string;
