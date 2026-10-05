import { allTools } from './tools.js';
export const MODES = {
    build: {
        id: 'build',
        label: 'Build',
        blurb: 'Read, write, edit, and run commands',
        tools: ['fs_read', 'fs_list', 'fs_write', 'fs_edit', 'shell_exec', 'http_fetch'],
        mutates: true,
    },
    plan: {
        id: 'plan',
        label: 'Plan',
        blurb: 'Read-only: think and propose, no changes',
        tools: ['fs_read', 'fs_list'],
        mutates: false,
    },
};
export function modeTools(mode, tools = allTools()) {
    const allowed = new Set(MODES[mode].tools);
    return tools.filter((tool) => allowed.has(tool.definition.name));
}
/** Extra system-prompt guidance for the mode. */
export function modePrompt(mode) {
    if (mode === 'plan') {
        return `You are in PLAN mode. You can read and list files but you cannot write, edit, or run commands.
Investigate the workspace thoroughly with fs_read and fs_list, then produce a clear, ordered plan the user can approve.
Do not claim to have made changes. Present your plan as steps, and note the exact files you would touch.`;
    }
    return `You are in BUILD mode. You may read, write, and edit files and run commands, each with the user's approval.
Make the changes, verify them, and summarize what you did.`;
}
export function cycleMode(mode) {
    return mode === 'build' ? 'plan' : 'build';
}
//# sourceMappingURL=modes.js.map