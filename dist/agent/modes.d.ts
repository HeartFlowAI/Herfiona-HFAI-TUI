import type { Tool } from './tools.js';
export type AgentMode = 'build' | 'plan';
export interface ModeMeta {
    id: AgentMode;
    label: string;
    blurb: string;
    /** Tools the mode is allowed to use. */
    tools: string[];
    /** True when the mode may change the workspace. */
    mutates: boolean;
}
export declare const MODES: Record<AgentMode, ModeMeta>;
export declare function modeTools(mode: AgentMode, tools?: Tool[]): Tool[];
/** Extra system-prompt guidance for the mode. */
export declare function modePrompt(mode: AgentMode): string;
export declare function cycleMode(mode: AgentMode): AgentMode;
