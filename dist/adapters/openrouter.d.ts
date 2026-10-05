import type { ChatDelta, Message, ModelAdapter, ToolDefinition } from '../agent/types.js';
export interface OpenRouterOptions {
    apiKey: string;
    model: string;
    temperature: number;
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
}
export declare class OpenRouterAdapter implements ModelAdapter {
    readonly id: string;
    readonly provider: "openrouter";
    readonly model: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly temperature;
    private readonly fetchImpl;
    constructor(options: OpenRouterOptions);
    locality(): Promise<{
        local: boolean;
        detail: string;
    }>;
    stream(messages: Message[], tools: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<ChatDelta, void, void>;
}
