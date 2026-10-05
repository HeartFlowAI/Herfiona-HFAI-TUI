export type Role = 'system' | 'user' | 'assistant' | 'tool';
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface Message {
    id: string;
    role: Role;
    content: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
    toolName?: string;
    /** Model reasoning/thinking text, when the provider exposes it. */
    reasoning?: string;
}
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}
export interface ToolResult {
    callId: string;
    name: string;
    ok: boolean;
    content: string;
}
export interface ChatDelta {
    content?: string;
    /** Reasoning/thinking token, separate from the visible answer. */
    reasoning?: string;
    toolCalls?: ToolCall[];
    done?: boolean;
}
export interface ModelAdapter {
    readonly id: string;
    readonly provider: 'ollama' | 'openrouter';
    readonly model: string;
    /** Resolve whether this model runs locally or egresses. */
    locality(): Promise<{
        local: boolean;
        detail: string;
    }>;
    /** Stream a completion, yielding text deltas and any final tool calls. */
    stream(messages: Message[], tools: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<ChatDelta, void, void>;
}
export declare function uid(): string;
