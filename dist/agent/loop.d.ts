import type { Message, ModelAdapter } from './types.js';
import { type ApprovalRequest, type Tool } from './tools.js';
export interface AgentCallbacks {
    onText?(delta: string): void;
    onReasoning?(delta: string): void;
    onAssistantStart?(): void;
    onAssistantEnd?(): void;
    onToolStart?(name: string, args: Record<string, unknown>): void;
    onToolEnd?(name: string, result: string): void;
    onActivity?(activity: string): void;
    requestApproval(request: ApprovalRequest): Promise<boolean>;
}
export interface AgentOptions {
    adapter: ModelAdapter;
    workspace: string;
    systemPrompt: string;
    maxTurns: number;
    tools?: Tool[];
    callbacks: AgentCallbacks;
    signal?: AbortSignal;
    autoApprove?: boolean;
}
export interface TurnResult {
    text: string;
    toolCalls: {
        name: string;
        ok: boolean;
    }[];
    turns: number;
    stopped: 'done' | 'max-turns' | 'aborted';
    outputTokens: number;
}
export declare class Agent {
    private readonly options;
    readonly messages: Message[];
    private readonly tools;
    private totalOutputTokens;
    private totalTurns;
    /** Signal for the turn currently in flight (set by send()). */
    private signal?;
    constructor(options: AgentOptions);
    /** Estimated tokens currently held in the conversation. */
    contextTokens(): number;
    get usage(): {
        outputTokens: number;
        turns: number;
    };
    addAssistantMessage(content: string): void;
    /** Replace the system prompt (e.g. after loading AGENTS.md or a new persona). */
    setSystemPrompt(content: string): void;
    /** Drop the trailing user/assistant/tool block, returning how many were removed. */
    dropLastTurn(): number;
    send(input: string, signal?: AbortSignal): Promise<TurnResult>;
    private runModel;
    private runTool;
}
export declare function buildSystemPrompt(persona: string, workspace: string, locality: string, modePrompt?: string, rules?: string): string;
