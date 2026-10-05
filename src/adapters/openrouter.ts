import { z } from 'zod';
import type { ChatDelta, Message, ModelAdapter, ToolCall, ToolDefinition } from '../agent/types.js';
import { uid } from '../agent/types.js';
import { fetchWithRetry } from './retry.js';

const DeltaToolCallSchema = z.object({
  index: z.number().optional(),
  id: z.string().optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});

const StreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullable().optional(),
            reasoning: z.string().nullable().optional(),
            reasoning_content: z.string().nullable().optional(),
            tool_calls: z.array(DeltaToolCallSchema).optional(),
          })
          .optional(),
        finish_reason: z.string().nullable().optional(),
      }),
    )
    .optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  temperature: number;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

interface PendingCall {
  id: string;
  name: string;
  args: string;
}

export class OpenRouterAdapter implements ModelAdapter {
  readonly id: string;
  readonly provider = 'openrouter' as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly temperature: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: OpenRouterOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.id = `openrouter:${options.model}`;
    this.baseUrl = (options.baseUrl ?? 'https://openrouter.ai/api/v1').replace(/\/$/, '');
    this.temperature = options.temperature;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  async locality(): Promise<{ local: boolean; detail: string }> {
    return { local: false, detail: `OpenRouter routes ${this.model} through a remote provider (data leaves this machine)` };
  }

  async *stream(messages: Message[], tools: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<ChatDelta, void, void> {
    const payload: Record<string, unknown> = {
      model: this.model,
      stream: true,
      temperature: this.temperature,
      messages: messages.map((message) => {
        const base: Record<string, unknown> = { role: message.role, content: message.content };
        if (message.toolCalls?.length) {
          base.tool_calls = message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.arguments) },
          }));
        }
        if (message.role === 'tool') base.tool_call_id = message.toolCallId;
        return base;
      }),
    };
    if (tools.length) {
      payload.tools = tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
    }

    const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/heartflowai',
        'X-Title': 'Aurora CLI',
      },
      body: JSON.stringify(payload),
      signal: signal ?? AbortSignal.timeout(180000),
    }, { fetchImpl: this.fetchImpl, signal });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenRouter HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const pending = new Map<number, PendingCall>();

    const flush = (): ToolCall[] =>
      [...pending.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, call]) => {
          let args: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(call.args || '{}');
            if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
          } catch {
            args = {};
          }
          return { id: call.id, name: call.name, arguments: args };
        });

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            const calls = flush();
            if (calls.length) yield { toolCalls: calls };
            yield { done: true };
            return;
          }
          let chunk: z.infer<typeof StreamChunkSchema>;
          try {
            chunk = StreamChunkSchema.parse(JSON.parse(data));
          } catch {
            continue;
          }
          if (chunk.error) throw new Error(chunk.error.message ?? 'OpenRouter stream error');
          for (const choice of chunk.choices ?? []) {
            const delta = choice.delta;
            if (delta?.content) yield { content: delta.content };
            const reasoning = delta?.reasoning ?? delta?.reasoning_content;
            if (reasoning) yield { reasoning };
            for (const call of delta?.tool_calls ?? []) {
              const index = call.index ?? 0;
              const existing = pending.get(index) ?? { id: call.id ?? uid(), name: '', args: '' };
              if (call.id) existing.id = call.id;
              if (call.function?.name) existing.name = call.function.name;
              if (call.function?.arguments) existing.args += call.function.arguments;
              pending.set(index, existing);
            }
          }
        }
      }
      const calls = flush();
      if (calls.length) yield { toolCalls: calls };
      yield { done: true };
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
}
