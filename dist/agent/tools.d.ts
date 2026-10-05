import type { ToolDefinition } from './types.js';
export interface ApprovalRequest {
    kind: 'write' | 'edit' | 'shell' | 'fetch';
    title: string;
    detail: string;
    preview?: string;
}
export interface ToolContext {
    workspace: string;
    signal?: AbortSignal;
    requestApproval(request: ApprovalRequest): Promise<boolean>;
    onActivity?(activity: string): void;
}
export interface Tool {
    definition: ToolDefinition;
    invoke(args: Record<string, unknown>, context: ToolContext): Promise<string>;
}
export declare function allTools(): Tool[];
/** The shell tool alone, for the `!command` passthrough. */
export declare function shellToolFor(): Tool;
export declare function toolDefinitions(tools: Tool[]): ToolDefinition[];
export declare function findTool(tools: Tool[], name: string): Tool | undefined;
