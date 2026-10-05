import { z } from 'zod';
import { uid } from '../agent/types.js';
import { fetchWithRetry } from './retry.js';
const OllamaToolCallSchema = z.object({
    function: z.object({
        name: z.string(),
        arguments: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    }),
});
const OllamaChunkSchema = z.object({
    message: z
        .object({
        role: z.string().optional(),
        content: z.string().optional(),
        thinking: z.string().optional(),
        reasoning: z.string().optional(),
        tool_calls: z.array(OllamaToolCallSchema).optional(),
    })
        .optional(),
    done: z.boolean().optional(),
    error: z.string().optional(),
});
function parseArgs(raw) {
    if (raw && typeof raw === 'object')
        return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch {
            return {};
        }
    }
    return {};
}
export class OllamaAdapter {
    id;
    provider = 'ollama';
    model;
    base;
    temperature;
    apiKey;
    fetchImpl;
    constructor(options) {
        this.base = options.host.replace(/\/$/, '');
        this.model = options.model;
        this.id = `ollama:${options.model}`;
        this.temperature = options.temperature;
        this.apiKey = options.apiKey || undefined;
        this.fetchImpl = options.fetch ?? globalThis.fetch;
    }
    /** Auth header for Ollama Cloud requests, when a key is configured. */
    authHeaders() {
        return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
    }
    async locality() {
        if (/:cloud$/i.test(this.model)) {
            return { local: false, detail: `Ollama Cloud model ${this.model} (data leaves this machine)` };
        }
        try {
            const res = await this.fetchImpl(`${this.base}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
                body: JSON.stringify({ model: this.model }),
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok)
                return { local: false, detail: `Could not verify ${this.model}; assuming egress` };
            const data = (await res.json());
            if (data.remote_host || data.remote_model) {
                return { local: false, detail: `${this.model} is served remotely via ${data.remote_host ?? 'a remote host'}` };
            }
            return { local: true, detail: `${this.model} runs on the local Ollama daemon` };
        }
        catch {
            return { local: false, detail: `Ollama daemon unreachable at ${this.base}; assuming egress` };
        }
    }
    async *stream(messages, tools, signal) {
        const payload = {
            model: this.model,
            stream: true,
            options: { temperature: this.temperature },
            messages: messages.map((message) => {
                const base = { role: message.role, content: message.content };
                if (message.toolCalls?.length) {
                    base.tool_calls = message.toolCalls.map((call) => ({
                        function: { name: call.name, arguments: call.arguments },
                    }));
                }
                if (message.role === 'tool')
                    base.tool_name = message.toolName;
                return base;
            }),
        };
        if (tools.length) {
            payload.tools = tools.map((tool) => ({
                type: 'function',
                function: { name: tool.name, description: tool.description, parameters: tool.parameters },
            }));
        }
        const res = await fetchWithRetry(`${this.base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
            body: JSON.stringify(payload),
            signal: signal ?? AbortSignal.timeout(180000),
        }, { fetchImpl: this.fetchImpl, signal });
        if (!res.ok || !res.body) {
            throw new Error(`Ollama returned HTTP ${res.status} for ${this.model}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const pending = [];
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    let parsed;
                    try {
                        parsed = OllamaChunkSchema.parse(JSON.parse(trimmed));
                    }
                    catch {
                        continue;
                    }
                    if (parsed.error)
                        throw new Error(parsed.error);
                    const message = parsed.message;
                    if (message?.content)
                        yield { content: message.content };
                    if (message?.thinking)
                        yield { reasoning: message.thinking };
                    else if (message?.reasoning)
                        yield { reasoning: message.reasoning };
                    for (const call of message?.tool_calls ?? []) {
                        pending.push({ id: uid(), name: call.function.name, arguments: parseArgs(call.function.arguments) });
                    }
                    if (parsed.done) {
                        if (pending.length)
                            yield { toolCalls: pending };
                        yield { done: true };
                        return;
                    }
                }
            }
            if (buffer.trim()) {
                try {
                    const parsed = OllamaChunkSchema.parse(JSON.parse(buffer.trim()));
                    if (parsed.message?.content)
                        yield { content: parsed.message.content };
                    if (parsed.message?.thinking)
                        yield { reasoning: parsed.message.thinking };
                    else if (parsed.message?.reasoning)
                        yield { reasoning: parsed.message.reasoning };
                    for (const call of parsed.message?.tool_calls ?? []) {
                        pending.push({ id: uid(), name: call.function.name, arguments: parseArgs(call.function.arguments) });
                    }
                }
                catch {
                    /* ignore trailing partial */
                }
            }
            if (pending.length)
                yield { toolCalls: pending };
            yield { done: true };
        }
        finally {
            await reader.cancel().catch(() => undefined);
        }
    }
}
//# sourceMappingURL=ollama.js.map