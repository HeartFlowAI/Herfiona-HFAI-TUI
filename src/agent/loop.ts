import type { ChatDelta, Message, ModelAdapter, ToolCall } from './types.js';
import { uid } from './types.js';
import { estimateTokens } from './usage.js';import { allTools, findTool, toolDefinitions, type ApprovalRequest, type Tool, type ToolContext } from './tools.js';

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
  toolCalls: { name: string; ok: boolean }[];
  turns: number;
  stopped: 'done' | 'max-turns' | 'aborted';
  outputTokens: number;
}

export class Agent {
  readonly messages: Message[] = [];
  private readonly tools: Tool[];
  private totalOutputTokens = 0;
  private totalTurns = 0;
  /** Signal for the turn currently in flight (set by send()). */
  private signal?: AbortSignal;

  constructor(private readonly options: AgentOptions) {
    this.tools = options.tools ?? allTools();
    this.messages.push({ id: uid(), role: 'system', content: options.systemPrompt });
  }

  /** Estimated tokens currently held in the conversation. */
  contextTokens(): number {
    return this.messages.reduce((sum, message) => sum + estimateTokens(message.content) + 8, 0);
  }

  get usage(): { outputTokens: number; turns: number } {
    return { outputTokens: this.totalOutputTokens, turns: this.totalTurns };
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ id: uid(), role: 'assistant', content });
  }

  /** Replace the system prompt (e.g. after loading AGENTS.md or a new persona). */
  setSystemPrompt(content: string): void {
    const first = this.messages[0];
    if (first && first.role === 'system') first.content = content;
    else this.messages.unshift({ id: uid(), role: 'system', content });
  }

  /** Drop the trailing user/assistant/tool block, returning how many were removed. */
  dropLastTurn(): number {
    let removed = 0;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const role = this.messages[i]!.role;
      if (role === 'system') break;
      this.messages.splice(i, 1);
      removed++;
      if (role === 'user') break;
    }
    return removed;
  }

  async send(input: string, signal?: AbortSignal): Promise<TurnResult> {
    this.signal = signal ?? this.options.signal;
    this.messages.push({ id: uid(), role: 'user', content: input });
    const toolLog: { name: string; ok: boolean }[] = [];
    let fullText = '';
    let turns = 0;
    let stopped: TurnResult['stopped'] = 'max-turns';

    try {
      for (let turn = 0; turn < this.options.maxTurns; turn++) {
        if (this.signal?.aborted) {
          stopped = 'aborted';
          break;
        }
        turns++;
        const { content, toolCalls } = await this.runModel();
        fullText += content;
        this.totalOutputTokens += estimateTokens(content);
        this.totalTurns++;
        const assistant: Message = { id: uid(), role: 'assistant', content };
        if (toolCalls.length) assistant.toolCalls = toolCalls;
        this.messages.push(assistant);

        if (!toolCalls.length) {
          stopped = 'done';
          break;
        }

        for (const call of toolCalls) {
          if (this.signal?.aborted) break;
          const result = await this.runTool(call);
          toolLog.push({ name: call.name, ok: !result.startsWith('Error') && !result.startsWith('Declined') });
          this.messages.push({
            id: uid(),
            role: 'tool',
            content: result,
            toolCallId: call.id,
            toolName: call.name,
          });
        }
      }
    } catch (error) {
      if (this.signal?.aborted) return { text: fullText, toolCalls: toolLog, turns, stopped: 'aborted', outputTokens: estimateTokens(fullText) };
      throw error;
    } finally {
      this.signal = undefined;
    }
    return { text: fullText, toolCalls: toolLog, turns, stopped, outputTokens: estimateTokens(fullText) };
  }

  private async runModel(): Promise<{ content: string; toolCalls: ToolCall[] }> {
    this.options.callbacks.onAssistantStart?.();
    let content = '';
    let toolCalls: ToolCall[] = [];
    try {
      for await (const delta of this.options.adapter.stream(this.messages, toolDefinitions(this.tools), this.signal) as AsyncGenerator<ChatDelta>) {
        if (delta.content) {
          content += delta.content;
          this.options.callbacks.onText?.(delta.content);
        }
        if (delta.reasoning) {
          this.options.callbacks.onReasoning?.(delta.reasoning);
        }
        if (delta.toolCalls?.length) {
          toolCalls = delta.toolCalls;
        }
      }
    } finally {
      this.options.callbacks.onAssistantEnd?.();
    }
    return { content, toolCalls };
  }

  private async runTool(call: ToolCall): Promise<string> {
    const tool = findTool(this.tools, call.name);
    this.options.callbacks.onToolStart?.(call.name, call.arguments);
    if (!tool) {
      const message = `Error: unknown tool ${call.name}.`;
      this.options.callbacks.onToolEnd?.(call.name, message);
      return message;
    }
    const context: ToolContext = {
      workspace: this.options.workspace,
      signal: this.options.signal,
      onActivity: this.options.callbacks.onActivity,
      requestApproval: this.options.autoApprove ? async () => true : this.options.callbacks.requestApproval,
    };
    let result: string;
    try {
      result = await tool.invoke(call.arguments, context);
    } catch (error) {
      result = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.options.callbacks.onToolEnd?.(call.name, result);
    return result;
  }
}

export function buildSystemPrompt(persona: string, workspace: string, locality: string, modePrompt?: string, rules?: string): string {
  return `${persona}${modePrompt ? `\n\n${modePrompt}` : ''}${rules ? `\n\n${rules}` : ''}

Workspace: ${workspace}
Model: ${locality}

Tools available: fs_read, fs_list, fs_write, fs_edit, shell_exec, http_fetch.
Use fs_read and fs_list to inspect the workspace before making changes. Writing files, editing files, running commands, and fetching URLs all require the user's explicit approval — describe what you want to do calmly and then call the tool once.`;
}
