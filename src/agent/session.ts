import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureConfigDir, sessionsDir } from '../config.js';
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

function sessionFile(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

export function newSessionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function saveSession(session: SavedSession): void {
  ensureConfigDir();
  const withCount: SavedSession = { ...session, messageCount: session.messages.length };
  writeFileSync(sessionFile(session.id), JSON.stringify(withCount, null, 2), 'utf8');
}

export function loadSession(id: string): SavedSession | undefined {
  const path = sessionFile(id);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SavedSession;
  } catch {
    return undefined;
  }
}

export function listSessions(): SessionMeta[] {
  ensureConfigDir();
  const dir = sessionsDir();
  if (!existsSync(dir)) return [];
  const sessions: SessionMeta[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as SavedSession;
      const { messages, ...meta } = data;
      sessions.push({ ...meta, messageCount: meta.messageCount ?? messages?.length ?? 0 });
    } catch {
      /* skip corrupt */
    }
  }
  return sessions.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function deleteSession(id: string): void {
  const path = sessionFile(id);
  if (existsSync(path)) rmSync(path, { force: true });
  const journal = `${path}.jsonl`;
  if (existsSync(journal)) rmSync(journal, { force: true });
}

/** Append a single event line; used for crash-tolerant streaming logs. */
export function appendEvent(id: string, event: unknown): void {
  ensureConfigDir();
  appendFileSync(sessionFile(id) + '.jsonl', JSON.stringify(event) + '\n', 'utf8');
}

/** Human-friendly relative time, e.g. "4m ago". */
export function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function titleFromInput(input: string): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? clean.slice(0, 45) + '...' : clean || 'new conversation';
}
