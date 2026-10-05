import type { ChatDelta, Message, ModelAdapter, ToolDefinition } from '../agent/types.js';
export interface OllamaOptions {
    host: string;
    model: string;
    temperature: number;
    apiKey?: string;
    fetch?: typeof globalThis.fetch;
}
export declare class OllamaAdapter implements ModelAdapter {
    readonly id: string;
    readonly provider: "ollama";
    readonly model: string;
    private readonly base;
    private readonly temperature;
    private readonly apiKey?;
    private readonly fetchImpl;
    constructor(options: OllamaOptions);
    /** Auth header for Ollama Cloud requests, when a key is configured. */
    private authHeaders;
    locality(): Promise<{
        local: boolean;
        detail: string;
    }>;
    stream(messages: Message[], tools: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<ChatDelta, void, void>;
}
