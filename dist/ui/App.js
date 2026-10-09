import { createElement as h, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectStrategy } from '../companion/strategy.js';
import { Agent, buildSystemPrompt } from '../agent/loop.js';
import { allTools } from '../agent/tools.js';
import { cycleMode, modePrompt, modeTools, MODES } from '../agent/modes.js';
import { newSessionId, saveSession, titleFromInput, listSessions, loadSession, deleteSession, relativeTime } from '../agent/session.js';
import { createAdapter, testProvider } from '../adapters/index.js';
import { listModelsByProvider } from '../agent/models.js';
import { listWorkspaceFiles, isTextFile } from '../agent/files.js';
import { saveConfig, ollamaKey, openRouterKey, maskKey, providerStatus } from '../config.js';
import { greeting, personaPrompt } from '../persona.js';
import { MOODS } from '../art/index.js';
import { moodForState, spinnerFrame } from '../art/moods.js';
import { entryLines } from './format.js';
import { detectLsps } from '../agent/lsp.js';
import { loadProjectRules } from '../agent/rules.js';
import { isInside as inside } from '../agent/workspace.js';
import { contextBar, contextWindow, estimateTokens, formatTokens } from '../agent/usage.js';
import { useTerminalSize } from './dimensions.js';
import { C, setTheme, themeNames } from './chrome.js';
import { rainBlock } from './rain.js';
import { gitStatus } from '../agent/git.js';
import { PaletteView, filterPalette } from './palette.js';
const SIDEBAR_MIN = 44;
const CHAT_MIN = 48;
const SIDEBAR_MAX = 52;
const TEMPERATURES = ['0', '0.2', '0.4', '0.6', '0.7', '0.8', '1', '1.2'];
const PERSONA_NOTES = {
    playful: 'teasing, warm, quick',
    warm: 'gentle, supportive',
    focused: 'efficient, minimal',
};
export default function App({ config, adapter, locality, truecolor }) {
    const { exit } = useApp();
    const { columns, rows } = useTerminalSize();
    const [committed, setCommitted] = useState([{ id: 'greet', role: 'system', content: greeting() }]);
    const [live, setLive] = useState('');
    const [liveReasoning, setLiveReasoning] = useState('');
    const [showThinking, setShowThinking] = useState(config.showThinking);
    const [phase, setPhase] = useState('idle');
    const [inspection, setInspection] = useState(null);
    const [inspectionOffset, setInspectionOffset] = useState(0);
    const inspectionGeneration = useRef(0);
    const [activity, setActivity] = useState('');
    const [pending, setPending] = useState(null);
    const [input, setInputState] = useState('');
    const inputRef = useRef('');
    const [tick, setTick] = useState(0);
    // Live settings + adapter (swappable from the command palette).
    const [settings, setSettings] = useState(config);
    const settingsRef = useRef(config);
    const [adapterState, setAdapterState] = useState(adapter);
    const [localityText, setLocalityText] = useState(locality);
    const [modelOptions, setModelOptions] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);
    const [palette, setPalette] = useState(null);
    const [modal, setModal] = useState(null);
    const [fileEntries, setFileEntries] = useState([]);
    const [sessionEntries, setSessionEntries] = useState([]);
    const [scroll, setScroll] = useState(0);
    const [sessionId] = useState(() => newSessionId());
    const [createdAt] = useState(() => new Date().toISOString());
    const [usage, setUsage] = useState({ input: 0, output: 0, turns: 0 });
    const [lsps, setLsps] = useState(() => detectLsps(config.workspace));
    const [rulesText, setRulesText] = useState(() => loadProjectRules(config.workspace).text);
    const [contextUsed, setContextUsed] = useState(0);
    const [mode, setMode] = useState('build');
    const agentRef = useRef(null);
    const historyRef = useRef([]);
    const abortRef = useRef(null);
    const [git, setGit] = useState(() => gitStatus(config.workspace));
    const model = settings.model;
    const provider = settings.provider;
    const contextMax = useMemo(() => contextWindow(model, provider), [model, provider]);
    const contextPercent = contextMax > 0 ? Math.min(100, (contextUsed / contextMax) * 100) : 0;
    const setInput = useCallback((value) => {
        const next = typeof value === 'function' ? value(inputRef.current) : value;
        inputRef.current = next;
        setInputState(next);
    }, []);
    useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 110);
        return () => clearInterval(timer);
    }, []);
    // Apply the saved theme once on mount.
    useEffect(() => {
        setTheme(config.theme);
    }, [config.theme]);
    const commit = useCallback((entry) => {
        const withId = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
        historyRef.current = [...historyRef.current, withId];
        setCommitted((current) => [...current, withId]);
        setScroll(0);
    }, []);
    const requestApproval = useCallback((request) => {
        setPhase('approval');
        return new Promise((resolve) => setPending({ request, resolve }));
    }, []);
    const getAgent = useCallback(() => {
        if (agentRef.current)
            return agentRef.current;
        const current = settingsRef.current;
        const agent = new Agent({
            adapter: adapterState,
            workspace: current.workspace,
            systemPrompt: buildSystemPrompt(personaPrompt(current.persona), current.workspace, localityText, modePrompt(mode), rulesText),
            maxTurns: current.maxTurns,
            autoApprove: current.autoApprove,
            tools: modeTools(mode, allTools()),
            callbacks: {
                onText: (delta) => {
                    setPhase('streaming');
                    setLive((value) => value + delta);
                },
                onReasoning: (delta) => setLiveReasoning((value) => value + delta),
                onAssistantStart: () => {
                    setLive('');
                    setLiveReasoning('');
                },
                onAssistantEnd: () => setLive((text) => {
                    if (text.trim())
                        commit({ role: 'assistant', content: text });
                    return '';
                }),
                onToolStart: (name) => {
                    setPhase('tool');
                    setActivity(name);
                },
                onToolEnd: (name, result) => {
                    setActivity('');
                    const lines = result.split('\n');
                    const first = lines[0] ?? '';
                    // A diff follows the summary line for write/edit tools.
                    const diff = lines.slice(1).some((l) => l.startsWith('+') || l.startsWith('-'))
                        ? lines.slice(1).join('\n')
                        : undefined;
                    commit({ role: 'tool', content: first, toolName: name, toolOk: !/^Error|^Declined/.test(result), diff });
                },
                onActivity: (value) => setActivity(value),
                requestApproval,
            },
        });
        agentRef.current = agent;
        return agent;
    }, [adapterState, localityText, mode, rulesText, commit, requestApproval]);
    const persist = useCallback(() => {
        saveSession({
            id: sessionId,
            title: titleFromInput(historyRef.current.find((entry) => entry.role === 'user')?.content ?? 'new conversation'),
            createdAt,
            updatedAt: new Date().toISOString(),
            workspace: settingsRef.current.workspace,
            model: settingsRef.current.model,
            messages: getAgent().messages,
        });
    }, [sessionId, createdAt, getAgent]);
    /** Merge a settings patch, persist it, and (by default) rebuild the adapter. */
    const applySettings = useCallback(async (patch, recreate = true) => {
        const previous = settingsRef.current;
        const next = { ...previous, ...patch };
        settingsRef.current = next;
        setSettings(next);
        if (patch.workspace !== undefined) {
            setLsps(detectLsps(next.workspace));
            setRulesText(loadProjectRules(next.workspace).text);
            setGit(gitStatus(next.workspace));
        }
        if (patch.theme !== undefined)
            setTheme(next.theme);
        if (!recreate) {
            saveConfig(next);
            agentRef.current = null;
            return;
        }
        // Stop any in-flight turn before swapping the adapter.
        abortRef.current?.abort();
        try {
            const rebuilt = await createAdapter(next);
            saveConfig(next);
            setAdapterState(rebuilt);
            agentRef.current = null;
            const loc = await rebuilt.locality();
            setLocalityText(loc.detail);
            commit({ role: 'system', content: `now using ${next.model} (${next.provider}) — ${loc.detail}` });
        }
        catch (error) {
            // Roll back so a bad provider/model can't leave the session broken.
            settingsRef.current = previous;
            setSettings(previous);
            commit({ role: 'error', content: `${error instanceof Error ? error.message : String(error)} (kept ${previous.model} on ${previous.provider})` });
        }
    }, [commit]);
    /** Read @referenced files and append their contents as context. */
    const expandFileRefs = useCallback((text) => {
        const refs = [...text.matchAll(/@([\w./-]+\.[\w]+)/g)].map((m) => m[1]).filter(Boolean);
        if (refs.length === 0)
            return text;
        const blocks = [];
        for (const ref of [...new Set(refs)].slice(0, 8)) {
            try {
                const full = resolve(settingsRef.current.workspace, ref);
                if (!inside(settingsRef.current.workspace, full) || !isTextFile(ref))
                    continue;
                const content = readFileSync(full, 'utf8');
                blocks.push(`# file: ${ref}\n${content.slice(0, 40_000)}`);
            }
            catch {
                /* skip unreadable */
            }
        }
        return blocks.length ? `${text}\n\n--- referenced files ---\n${blocks.join('\n\n')}` : text;
    }, []);
    const run = useCallback(async (text) => {
        const trimmed = text.trim();
        if (!trimmed)
            return;
        commit({ role: 'user', content: trimmed });
        setPhase('thinking');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const agent = getAgent();
            const result = await agent.send(expandFileRefs(trimmed), controller.signal);
            setUsage((current) => ({ input: current.input + estimateTokens(trimmed), output: agent.usage.outputTokens, turns: agent.usage.turns }));
            setContextUsed(agent.contextTokens());
            if (result.stopped === 'aborted')
                commit({ role: 'system', content: 'stopped.' });
            setGit(gitStatus(settingsRef.current.workspace));
            setPhase('idle');
            setActivity('');
        }
        catch (error) {
            if (controller.signal.aborted) {
                setPhase('idle');
            }
            else {
                setPhase('error');
                commit({ role: 'error', content: error instanceof Error ? error.message : String(error) });
            }
        }
        finally {
            abortRef.current = null;
            setLiveReasoning('');
            persist();
        }
    }, [commit, getAgent, persist, expandFileRefs]);
    const clearConversation = useCallback(() => {
        agentRef.current = null;
        historyRef.current = [];
        setCommitted([{ id: `${Date.now()}`, role: 'system', content: greeting(1) }]);
        setLive('');
        setScroll(0);
        setUsage({ input: 0, output: 0, turns: 0 });
        setContextUsed(0);
        setPhase('idle');
    }, []);
    const toggleMode = useCallback(() => {
        setMode((current) => {
            const next = cycleMode(current);
            agentRef.current = null;
            commit({ role: 'system', content: `agent mode: ${MODES[next].label.toLowerCase()} — ${MODES[next].blurb.toLowerCase()}` });
            return next;
        });
    }, [commit]);
    const redoStackRef = useRef([]);
    /** Remove the last user/assistant/tool exchange from history and the agent. */
    const undoLastTurn = useCallback(() => {
        const history = historyRef.current;
        let cut = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === 'user') {
                cut = i;
                break;
            }
        }
        if (cut === -1) {
            commit({ role: 'system', content: 'nothing to undo.' });
            return;
        }
        const removed = history.slice(cut);
        const agent = agentRef.current;
        if (agent)
            agent.dropLastTurn();
        redoStackRef.current.push(removed);
        historyRef.current = history.slice(0, cut);
        setCommitted(historyRef.current);
        setScroll(0);
        if (agent)
            setContextUsed(agent.contextTokens());
        commit({ role: 'system', content: `undid ${removed.length} entr${removed.length === 1 ? 'y' : 'ies'}.` });
        persist();
    }, [commit, persist]);
    const redoLastTurn = useCallback(() => {
        const removed = redoStackRef.current.pop();
        if (!removed) {
            commit({ role: 'system', content: 'nothing to redo.' });
            return;
        }
        historyRef.current = [...historyRef.current, ...removed];
        setCommitted(historyRef.current);
        setScroll(0);
        commit({ role: 'system', content: 'redo re-runs the turn — resend your message to regenerate.' });
    }, [commit]);
    /** Ask the model to summarize the conversation, then replace older history. */
    const compactContext = useCallback(async () => {
        const agent = getAgent();
        if (agent.messages.length < 4) {
            commit({ role: 'system', content: 'not enough context to compact yet.' });
            return;
        }
        commit({ role: 'system', content: 'compacting context...' });
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const summary = [];
            for await (const delta of adapterState.stream([
                { id: 'c1', role: 'system', content: 'summarize the conversation so far for a coding agent. keep decisions, file names, and open tasks. be concise.' },
                ...agent.messages.filter((m) => m.role !== 'system').map((m) => ({ id: m.id, role: 'user', content: `${m.role}: ${m.content}` })),
            ], [], controller.signal)) {
                if (delta.content)
                    summary.push(delta.content);
            }
            const text = summary.join('').trim();
            if (!text) {
                commit({ role: 'system', content: 'compaction produced no summary.' });
                return;
            }
            // Rebuild the agent with the summary as a system note and a short tail.
            agentRef.current = null;
            const fresh = getAgent();
            fresh.messages.splice(0, fresh.messages.length, { id: 'summary', role: 'system', content: `conversation summary:\n${text}` });
            historyRef.current = [{ id: `sum-${Date.now()}`, role: 'system', content: 'context compacted into a summary.' }, ...historyRef.current.slice(-2)];
            setCommitted(historyRef.current);
            setContextUsed(fresh.contextTokens());
            commit({ role: 'system', content: `compacted to ~${formatTokens(fresh.contextTokens())} tokens.` });
        }
        catch (error) {
            commit({ role: 'error', content: error instanceof Error ? error.message : String(error) });
        }
        finally {
            abortRef.current = null;
        }
    }, [getAgent, adapterState, commit]);
    const reloadRules = useCallback(() => {
        const { text, files } = loadProjectRules(settingsRef.current.workspace);
        setRulesText(text);
        agentRef.current = null;
        commit({ role: 'system', content: files.length ? `loaded ${files.length} rule file(s): ${files.map((f) => f.split('/').pop()).join(', ')}` : 'no AGENTS.md found.' });
    }, [commit]);
    const resumeSession = useCallback((id) => {
        const saved = loadSession(id);
        if (!saved) {
            commit({ role: 'error', content: `could not load session ${id}.` });
            return;
        }
        agentRef.current = null;
        const agent = getAgent();
        // Replace the fresh conversation with the saved messages, minus the system prompt.
        const restored = saved.messages.filter((m) => m.role !== 'system');
        agent.messages.splice(1, agent.messages.length, ...restored);
        historyRef.current = restored.map((m) => ({
            id: m.id,
            role: m.role === 'tool' ? 'tool' : m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
            toolName: m.toolName,
        }));
        setCommitted(historyRef.current);
        setContextUsed(agent.contextTokens());
        setScroll(0);
        setPhase('idle');
        commit({ role: 'system', content: `resumed "${saved.title}" (${restored.length} messages).` });
    }, [getAgent, commit]);
    /** Run a shell command through the approval flow, like `!ls`. */
    const runShell = useCallback(async (command) => {
        commit({ role: 'user', content: `!${command}` });
        setPhase('tool');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const { shellToolFor } = await import('../agent/tools.js');
            const tool = shellToolFor();
            const result = await tool.invoke({ command }, {
                workspace: settingsRef.current.workspace,
                signal: controller.signal,
                requestApproval,
                onActivity: setActivity,
            });
            const ok = !/^Error|^Declined/.test(result);
            commit({ role: 'tool', content: result.split('\n')[0] ?? '', toolName: `!${command.split(' ')[0]}`, toolOk: ok });
            // Show the full output as a system block so nothing is lost.
            if (result.split('\n').length > 1)
                commit({ role: 'system', content: result.slice(0, 4000) });
        }
        catch (error) {
            commit({ role: 'error', content: error instanceof Error ? error.message : String(error) });
        }
        finally {
            abortRef.current = null;
            setPhase('idle');
        }
    }, [commit, requestApproval]);
    const attachFile = useCallback((path) => {
        setInput((current) => current.replace(/@[\w./-]*$/, `@${path} `));
    }, [setInput]);
    /** Persist an API key, then rebuild the adapter and re-test the connection. */
    const saveKey = useCallback(async (field, value) => {
        const next = { ...settingsRef.current, [field]: value };
        settingsRef.current = next;
        setSettings(next);
        saveConfig(next);
        const label = field === 'ollamaApiKey' ? 'ollama' : 'openrouter';
        commit({ role: 'system', content: value ? `saved ${label} key (${maskKey(value)}). testing...` : `cleared ${label} key.` });
        const result = await testProvider(next, label);
        commit({
            role: result.ok ? 'system' : 'error',
            content: `${label}: ${result.ok ? '\u2713' : '\u2717'} ${result.detail}${result.modelCount !== undefined ? ` (${result.modelCount} models)` : ''}`,
        });
        // If the key belongs to the active provider, rebuild the adapter.
        if ((field === 'openRouterApiKey' && next.provider === 'openrouter') || (field === 'ollamaApiKey' && next.provider === 'ollama')) {
            await applySettings({ [field]: value });
        }
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit]);
    const openKeyModal = useCallback((field) => {
        const existing = field === 'ollamaApiKey' ? ollamaKey(settingsRef.current) : openRouterKey(settingsRef.current);
        setModal({
            field,
            title: field === 'ollamaApiKey' ? 'set ollama api key' : 'set openrouter api key',
            hint: field === 'ollamaApiKey' ? 'for ollama cloud models · ollama.com/settings/keys' : 'openrouter.ai/keys',
            value: '',
            mask: true,
        });
        if (existing) {
            // Show that a key exists without revealing it.
        }
    }, []);
    const runCommand = useCallback((raw) => {
        const [command, ...rest] = raw.slice(1).split(/\s+/);
        const arg = rest.join(' ').trim();
        switch (command) {
            case 'strategy': {
                if (phase !== 'idle')
                    return true;
                const rawPath = raw.slice('/strategy'.length).trim(), path = rawPath.startsWith('"') && rawPath.endsWith('"') ? rawPath.slice(1, -1) : rawPath;
                const generation = ++inspectionGeneration.current;
                setInspectionOffset(0);
                setInspection(['Reading selected local rule package…', 'Escape closes this view.']);
                if (!path) {
                    setInspection(['Usage: /strategy "path to exported rule package.json"', 'Inspection stays outside chat, saved sessions and model context.']);
                    return true;
                }
                void inspectStrategy(resolve(settingsRef.current.workspace, path)).then(lines => { if (generation === inspectionGeneration.current)
                    setInspection(lines); }).catch(error => { if (generation === inspectionGeneration.current)
                    setInspection(['Package inspection failed.', error instanceof Error ? error.message : 'Invalid package.']); });
                return true;
            }
            case 'model':
                if (arg)
                    void applySettings({ model: arg });
                else
                    openPalette('model');
                return true;
            case 'provider':
                if (arg === 'ollama' || arg === 'openrouter')
                    void applySettings({ provider: arg });
                else
                    openPalette('provider');
                return true;
            case 'mode':
                if (arg === 'build' || arg === 'plan') {
                    setMode(arg);
                    agentRef.current = null;
                    commit({ role: 'system', content: `agent mode: ${arg}` });
                }
                else
                    toggleMode();
                return true;
            case 'persona':
                if (arg && arg in PERSONA_NOTES)
                    void applySettings({ persona: arg }, false);
                else
                    openPalette('persona');
                return true;
            case 'temperature':
            case 'temp':
                if (arg && !Number.isNaN(Number(arg)))
                    void applySettings({ temperature: Number(arg) }, false);
                else
                    openPalette('temperature');
                return true;
            case 'connect':
            case 'setup':
                openKeyModal('ollamaApiKey');
                return true;
            case 'key':
                if (arg === 'ollama')
                    openKeyModal('ollamaApiKey');
                else if (arg === 'openrouter')
                    openKeyModal('openRouterApiKey');
                else
                    openKeyModal('ollamaApiKey');
                return true;
            case 'test':
                void (async () => {
                    const result = await testProvider(settingsRef.current, settingsRef.current.provider);
                    commit({
                        role: result.ok ? 'system' : 'error',
                        content: `${settingsRef.current.provider}: ${result.ok ? '\u2713' : '\u2717'} ${result.detail}${result.modelCount !== undefined ? ` (${result.modelCount} models)` : ''}`,
                    });
                })();
                return true;
            case 'theme':
                if (arg && themeNames().includes(arg))
                    void applySettings({ theme: arg }, false);
                else
                    openPalette('theme');
                return true;
            case 'workspace':
                if (arg)
                    void applySettings({ workspace: arg });
                else
                    openPalette('workspace');
                return true;
            case 'sessions':
            case 'resume':
                void refreshSessions();
                openPalette('session');
                return true;
            case 'undo':
                undoLastTurn();
                return true;
            case 'redo':
                redoLastTurn();
                return true;
            case 'compact':
            case 'summarize':
                void compactContext();
                return true;
            case 'thinking':
                setShowThinking((value) => {
                    void applySettings({ showThinking: !value }, false);
                    return !value;
                });
                return true;
            case 'rules':
                reloadRules();
                return true;
            case 'help':
                commit({ role: 'system', content: HELP_TEXT });
                return true;
            case 'clear':
            case 'new':
                clearConversation();
                return true;
            case 'exit':
            case 'quit':
                persist();
                exit();
                return true;
            default:
                return false;
        }
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applySettings, clearConversation, commit, exit, persist, toggleMode, phase]);
    const loadModels = useCallback(async (nextProvider) => {
        setModelsLoading(true);
        try {
            const options = await listModelsByProvider(nextProvider, settingsRef.current);
            setModelOptions(options);
        }
        catch {
            setModelOptions([]);
        }
        finally {
            setModelsLoading(false);
        }
    }, []);
    const refreshSessions = useCallback(async () => {
        setSessionEntries(listSessions());
    }, []);
    const refreshFiles = useCallback(async () => {
        const files = listWorkspaceFiles(settingsRef.current.workspace);
        setFileEntries(files.map((f) => f.path));
    }, []);
    function openPalette(kind) {
        setPalette({ kind, query: kind === 'file' ? currentAtQuery() : '', index: 0 });
        if (kind === 'model')
            void loadModels(settingsRef.current.provider);
        if (kind === 'session')
            void refreshSessions();
        if (kind === 'file')
            void refreshFiles();
    }
    function currentAtQuery() {
        const match = /@([\w./-]*)$/.exec(inputRef.current);
        return match ? (match[1] ?? '') : '';
    }
    // --- Palette item construction ----------------------------------------
    const paletteItems = useMemo(() => {
        if (!palette)
            return [];
        switch (palette.kind) {
            case 'command':
                return [
                    { id: 'cmd:connect', label: 'set up providers', hint: 'ollama + openrouter keys', group: 'connect' },
                    { id: 'cmd:set-ollama-key', label: 'set ollama api key', hint: ollamaKey(settings) ? maskKey(ollamaKey(settings)) : 'not set', group: 'connect' },
                    { id: 'cmd:set-openrouter-key', label: 'set openrouter api key', hint: openRouterKey(settings) ? maskKey(openRouterKey(settings)) : 'not set', group: 'connect' },
                    { id: 'cmd:test', label: 'test connection', hint: 'check the active provider', group: 'connect' },
                    { id: 'cmd:model', label: 'switch model', hint: 'change the active model', group: 'model' },
                    { id: 'cmd:provider', label: 'switch provider', hint: `currently ${provider}`, group: 'model' },
                    { id: 'cmd:persona', label: 'change persona', hint: PERSONA_NOTES[settings.persona], group: 'style' },
                    { id: 'cmd:temperature', label: 'change temperature', hint: String(settings.temperature), group: 'style' },
                    { id: 'cmd:theme', label: 'change theme', hint: settings.theme, group: 'style' },
                    { id: 'cmd:thinking', label: settings.showThinking ? 'hide thinking' : 'show thinking', hint: 'reasoning blocks', group: 'style' },
                    { id: 'cmd:mode', label: 'toggle agent mode', hint: mode === 'build' ? 'build → plan' : 'plan → build', group: 'agent' },
                    { id: 'cmd:auto-approve', label: settings.autoApprove ? 'disable auto-approve' : 'enable auto-approve', hint: settings.autoApprove ? 'currently on' : 'currently off', group: 'agent' },
                    { id: 'cmd:sessions', label: 'resume session', hint: 'load a previous conversation', group: 'session' },
                    { id: 'cmd:undo', label: 'undo last turn', hint: 'remove the last exchange', group: 'session' },
                    { id: 'cmd:redo', label: 'redo', hint: 'restore the undone turn', group: 'session' },
                    { id: 'cmd:compact', label: 'compact context', hint: 'summarize to free space', group: 'session' },
                    { id: 'cmd:rules', label: 'reload project rules', hint: 'AGENTS.md', group: 'session' },
                    { id: 'cmd:workspace', label: 'change workspace', hint: settings.workspace, group: 'session' },
                    { id: 'cmd:clear', label: 'new conversation', hint: 'reset this session', group: 'session' },
                    { id: 'cmd:help', label: 'help', hint: 'show commands and keys', group: 'session' },
                    { id: 'cmd:exit', label: 'exit', hint: 'quit aurora', group: 'session' },
                ];
            case 'model':
                return modelOptions.map((option) => ({
                    id: `model:${option.id}`,
                    label: option.label,
                    hint: option.id,
                    detail: option.id === model ? 'current' : option.note,
                    group: option.provider,
                }));
            case 'provider':
                return [
                    { id: 'provider:ollama', label: 'ollama', hint: 'local + ollama cloud', detail: provider === 'ollama' ? 'current' : '' },
                    { id: 'provider:openrouter', label: 'openrouter', hint: 'hosted models (needs a key)', detail: provider === 'openrouter' ? 'current' : '' },
                ];
            case 'persona':
                return Object.keys(PERSONA_NOTES).map((id) => ({
                    id: `persona:${id}`,
                    label: id,
                    hint: PERSONA_NOTES[id],
                    detail: settings.persona === id ? 'current' : '',
                }));
            case 'temperature':
                return TEMPERATURES.map((value) => ({
                    id: `temperature:${value}`,
                    label: value,
                    hint: Number(value) <= 0.3 ? 'precise' : Number(value) >= 1 ? 'wild' : 'balanced',
                    detail: String(settings.temperature) === value ? 'current' : '',
                }));
            case 'workspace':
                return [{ id: 'workspace:free', label: palette.query || '(type a path)', hint: 'enter to set', group: 'workspace' }];
            case 'session':
                if (sessionEntries.length === 0) {
                    return [{ id: 'session:none', label: 'no saved sessions', hint: 'start chatting to create one', disabled: true }];
                }
                return sessionEntries.map((session) => ({
                    id: `session:${session.id}`,
                    label: session.title.toLowerCase(),
                    hint: `${session.messageCount ?? 0} msgs · ${session.model}`,
                    detail: relativeTime(session.updatedAt),
                    group: 'saved',
                }));
            case 'file':
                return fileEntries.map((path) => ({ id: `file:${path}`, label: path, group: 'files' }));
            case 'theme':
                return themeNames().map((name) => ({
                    id: `theme:${name}`,
                    label: name,
                    hint: 'color palette',
                    detail: settings.theme === name ? 'current' : '',
                }));
            default:
                return [];
        }
    }, [palette, modelOptions, provider, settings, mode, model, sessionEntries, fileEntries]);
    const filtered = useMemo(() => filterPalette(paletteItems, palette?.kind === 'workspace' ? '' : palette?.query ?? ''), [paletteItems, palette]);
    const submitPalette = useCallback((item) => {
        if (!palette)
            return;
        const kind = palette.kind;
        if (kind === 'workspace') {
            const path = palette.query.trim();
            if (!path)
                return;
            void applySettings({ workspace: path });
            setPalette(null);
            return;
        }
        if (kind === 'file') {
            if (!item)
                return;
            const path = item.id.startsWith('file:') ? item.id.slice(5) : item.label;
            attachFile(path);
            setPalette(null);
            return;
        }
        if (kind === 'session') {
            if (!item || item.disabled)
                return;
            const id = item.id.startsWith('session:') ? item.id.slice(8) : '';
            if (id)
                resumeSession(id);
            setPalette(null);
            return;
        }
        if (!item)
            return;
        const sep = item.id.indexOf(':');
        const type = sep === -1 ? item.id : item.id.slice(0, sep);
        const value = sep === -1 ? '' : item.id.slice(sep + 1);
        if (type === 'cmd') {
            switch (value) {
                case 'connect':
                    setPalette(null);
                    openKeyModal('ollamaApiKey');
                    return;
                case 'set-ollama-key':
                    setPalette(null);
                    openKeyModal('ollamaApiKey');
                    return;
                case 'set-openrouter-key':
                    setPalette(null);
                    openKeyModal('openRouterApiKey');
                    return;
                case 'test':
                    void (async () => {
                        const result = await testProvider(settingsRef.current, settingsRef.current.provider);
                        commit({
                            role: result.ok ? 'system' : 'error',
                            content: `${settingsRef.current.provider}: ${result.ok ? '\u2713' : '\u2717'} ${result.detail}${result.modelCount !== undefined ? ` (${result.modelCount} models)` : ''}`,
                        });
                    })();
                    break;
                case 'model':
                    openPalette('model');
                    return;
                case 'provider':
                    openPalette('provider');
                    return;
                case 'persona':
                    openPalette('persona');
                    return;
                case 'temperature':
                    openPalette('temperature');
                    return;
                case 'workspace':
                    openPalette('workspace');
                    return;
                case 'thinking':
                    setShowThinking((value) => {
                        void applySettings({ showThinking: !value }, false);
                        return !value;
                    });
                    break;
                case 'theme':
                    openPalette('theme');
                    return;
                case 'sessions':
                    void refreshSessions();
                    openPalette('session');
                    return;
                case 'undo':
                    undoLastTurn();
                    break;
                case 'redo':
                    redoLastTurn();
                    break;
                case 'compact':
                    void compactContext();
                    break;
                case 'rules':
                    reloadRules();
                    break;
                case 'mode':
                    toggleMode();
                    break;
                case 'auto-approve':
                    void applySettings({ autoApprove: !settings.autoApprove }, false);
                    break;
                case 'clear':
                    clearConversation();
                    break;
                case 'help':
                    commit({ role: 'system', content: HELP_TEXT });
                    break;
                case 'exit':
                    persist();
                    exit();
                    break;
            }
            setPalette(null);
            return;
        }
        switch (type) {
            case 'model':
                void applySettings({ model: value ?? '' });
                break;
            case 'provider':
                void applySettings({ provider: (value ?? 'ollama') });
                break;
            case 'persona':
                void applySettings({ persona: (value ?? 'playful') }, false);
                break;
            case 'temperature':
                void applySettings({ temperature: Number(value) }, false);
                break;
            case 'theme':
                void applySettings({ theme: value ?? 'pink' }, false);
                break;
            default:
                break;
        }
        setPalette(null);
    }, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [palette, settings, applySettings, toggleMode, clearConversation, commit, persist, exit]);
    const submit = useCallback((text) => {
        if (text.startsWith('/')) {
            if (!runCommand(text))
                commit({ role: 'system', content: `unknown command: ${text}` });
            return;
        }
        if (text.startsWith('!') && text.length > 1) {
            void runShell(text.slice(1).trim());
            return;
        }
        void run(text);
    }, [runCommand, run, runShell, commit]);
    useInput((value, key) => {
        if (inspection) {
            if (key.escape) {
                ++inspectionGeneration.current;
                setInspection(null);
            }
            else if (key.downArrow || key.pageDown || value === 'n')
                setInspectionOffset(offset => offset + Math.max(1, rows - 4));
            else if (key.upArrow || key.pageUp || value === 'p')
                setInspectionOffset(offset => Math.max(0, offset - Math.max(1, rows - 4)));
            return;
        }
        // --- Text modal (API keys) captures input while open -----------------
        if (modal) {
            if (key.escape) {
                setModal(null);
                return;
            }
            if (key.return) {
                const field = modal.field;
                const text = modal.value;
                setModal(null);
                if (field === 'workspace') {
                    if (text.trim())
                        void applySettings({ workspace: text.trim() });
                }
                else {
                    void saveKey(field, text.trim());
                }
                return;
            }
            if (key.backspace || key.delete) {
                setModal((m) => (m ? { ...m, value: m.value.slice(0, -1) } : m));
                return;
            }
            if (key.ctrl && (value === 'u' || value === 'U')) {
                setModal((m) => (m ? { ...m, value: '' } : m));
                return;
            }
            if (value && !key.ctrl && !key.meta && !value.includes('\n') && !value.includes('\r')) {
                setModal((m) => (m ? { ...m, value: m.value + value } : m));
            }
            return;
        }
        // --- Palette captures all input while open ---------------------------
        if (palette) {
            if (key.escape) {
                setPalette(null);
                return;
            }
            if (key.upArrow) {
                setPalette((p) => (p ? { ...p, index: Math.max(0, p.index - 1) } : p));
                return;
            }
            if (key.downArrow) {
                setPalette((p) => (p ? { ...p, index: Math.min(filtered.length - 1, p.index + 1) } : p));
                return;
            }
            if (key.return) {
                submitPalette(filtered[palette.index]);
                return;
            }
            if (key.backspace || key.delete) {
                setPalette((p) => (p ? { ...p, query: p.query.slice(0, -1), index: 0 } : p));
                return;
            }
            if (key.tab)
                return;
            if (value && !key.ctrl && !key.meta) {
                setPalette((p) => (p ? { ...p, query: p.query + value, index: 0 } : p));
            }
            return;
        }
        if (pending) {
            if (value.toLowerCase() === 'y') {
                pending.resolve(true);
                setPending(null);
                setPhase('thinking');
            }
            else if (value.toLowerCase() === 'n' || key.escape) {
                pending.resolve(false);
                setPending(null);
                setPhase('thinking');
            }
            return;
        }
        if (key.ctrl && value === 'p') {
            openPalette('command');
            return;
        }
        if (key.ctrl && value === 'c') {
            if (abortRef.current) {
                abortRef.current.abort();
                commit({ role: 'system', content: 'stopped.' });
                setPhase('idle');
            }
            else {
                persist();
                exit();
            }
            return;
        }
        if (key.return) {
            const text = inputRef.current;
            setInput('');
            submit(text);
            return;
        }
        if (key.backspace || key.delete) {
            setInput((current) => current.slice(0, -1));
            return;
        }
        if (key.upArrow) {
            setScroll((s) => s + 1);
            return;
        }
        if (key.downArrow) {
            setScroll((s) => Math.max(0, s - 1));
            return;
        }
        if (key.tab) {
            toggleMode();
            return;
        }
        if (key.leftArrow || key.rightArrow)
            return;
        if (!value || key.ctrl || key.meta)
            return;
        if (value.includes('\n') || value.includes('\r')) {
            const lines = (inputRef.current + value).split(/\r?\n/);
            const first = lines.shift() ?? '';
            setInput(lines.join('\n').replace(/\n+$/, ''));
            if (first.trim())
                submit(first);
            return;
        }
        // Typing `@` opens the file picker; subsequent typing filters it.
        if (value === '@') {
            setInput((current) => `${current}@`);
            setFileEntries(listWorkspaceFiles(settingsRef.current.workspace).map((f) => f.path));
            setPalette({ kind: 'file', query: '', index: 0 });
            return;
        }
        setInput((current) => current + value);
    });
    const mood = moodForState(phase);
    const sidebarWidth = columns >= CHAT_MIN + SIDEBAR_MIN + 6 ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(columns * 0.3))) : 0;
    const wide = sidebarWidth > 0;
    const chatWidth = columns - sidebarWidth - (wide ? 1 : 0);
    const composerRows = modal
        ? 7
        : pending
            ? Math.min(11, 3 + (pending.request.preview?.split('\n').length ?? 0))
            : 3;
    const headerRows = 1;
    const footerRows = 1;
    const statusRows = 2;
    const middle = Math.max(4, rows - headerRows - composerRows - statusRows - footerRows);
    const flat = useMemo(() => {
        const out = [];
        const max = chatWidth - 4;
        for (const entry of committed)
            out.push(...entryLines(entry, max));
        if (showThinking && liveReasoning.trim()) {
            out.push(...entryLines({ id: 'live-thinking', role: 'thinking', content: liveReasoning }, max));
        }
        if (live.trim())
            out.push(...entryLines({ id: 'live', role: 'assistant', content: live }, max));
        return out;
    }, [committed, live, liveReasoning, showThinking, chatWidth]);
    const maxScroll = Math.max(0, flat.length - middle);
    const clampedScroll = Math.min(scroll, maxScroll);
    const start = Math.max(0, flat.length - middle - clampedScroll);
    const viewport = flat.slice(start, start + middle);
    while (viewport.length < middle)
        viewport.push(h(Text, { key: `pad-${viewport.length}` }, ' '));
    const status = statusText(phase, activity, tick);
    const title = titleFromInput(historyRef.current.find((entry) => entry.role === 'user')?.content ?? 'new session');
    const paletteTitle = palette?.kind === 'command'
        ? 'commands'
        : palette?.kind === 'model'
            ? modelsLoading
                ? 'models (loading...)'
                : `models — ${provider}`
            : palette?.kind === 'provider'
                ? 'provider'
                : palette?.kind === 'persona'
                    ? 'persona'
                    : palette?.kind === 'temperature'
                        ? 'temperature'
                        : palette?.kind === 'session'
                            ? 'resume session'
                            : palette?.kind === 'file'
                                ? 'attach file'
                                : palette?.kind === 'theme'
                                    ? 'theme'
                                    : 'workspace';
    if (inspection) {
        const width = Math.max(12, columns - 4), lines = inspection.flatMap(line => line.split('\n').flatMap(part => part.match(new RegExp(`.{1,${width}}`, 'gu')) ?? [''])), count = Math.max(1, rows - 4), offset = Math.min(inspectionOffset, Math.max(0, lines.length - count));
        return h(Box, { flexDirection: 'column', width: columns, height: rows }, h(Text, { bold: true }, 'Strategy package · local inspection'), h(Text, null, '↑/↓ or p/n scroll · Escape close · no model sharing'), ...lines.slice(offset, offset + count).map((line, index) => h(Text, { key: index, wrap: 'truncate' }, line)), h(Text, null, `${offset + 1}–${Math.min(lines.length, offset + count)} / ${lines.length}`));
    }
    return h(Box, { flexDirection: 'column', width: columns, height: rows }, h(Header, { title, contextUsed, contextPercent, columns }), h(Box, { flexDirection: 'row', flexGrow: 1 }, h(Box, { flexDirection: 'column', width: chatWidth, paddingRight: wide ? 1 : 0 }, palette
        ? h(Box, { flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, h(PaletteView, {
            title: paletteTitle,
            query: palette.kind === 'workspace' ? palette.query : palette.query,
            items: filtered,
            index: palette.index,
            columns: chatWidth,
            maxRows: middle,
            emptyText: palette.kind === 'model' && modelsLoading ? 'loading models...' : 'no matches',
        }))
        : h(Box, { flexDirection: 'column' }, ...viewport)), wide
        ? h(Sidebar, {
            mood,
            maxRows: middle,
            maxWidth: sidebarWidth,
            tick,
            phase,
            model,
            provider,
            contextUsed,
            contextMax,
            contextPercent,
            usage,
            lsps,
        })
        : null), h(AgentLine, { mode, model, tick, phase }), modal
        ? h(KeyModal, { modal, columns })
        : pending
            ? h(ApprovalBar, { request: pending.request, columns, mode })
            : h(InputBox, { input, phase, columns, paletteOpen: palette !== null }), h(StatusLine, { mode, model, provider, columns }), h(Footer, { status, scroll: clampedScroll, lsps, locality: localityText, git, columns }));
}
/** A bordered single-line text input for API keys and paths. */
function KeyModal({ modal, columns }) {
    const shown = modal.mask ? '\u2022'.repeat(modal.value.length) : modal.value;
    const existing = modal.field === 'ollamaApiKey' ? ollamaKey() : openRouterKey();
    return h(Box, { flexDirection: 'column', width: columns }, h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: C.pink, paddingX: 1 }, h(Text, { color: C.hot, bold: true }, modal.title), h(Text, { color: C.dim }, modal.hint), h(Text, {}, h(Text, { color: C.heart, bold: true }, '\u276f '), h(Text, { color: C.ink }, shown), h(Text, { color: C.pink }, '\u2588')), h(Text, { color: C.muted }, existing ? `current: ${maskKey(existing)}  (enter a new one to replace)` : 'no key set yet'), h(Text, { color: C.dim }, 'enter save   esc cancel   ctrl+u clear')));
}
const HELP_TEXT = 'commands  /model  /provider  /persona  /temperature  /theme  /workspace  /mode  /sessions  /undo  /redo  /compact  /thinking  /rules  /clear  /exit\nkeys  enter send  ·  ctrl+p commands  ·  tab agent  ·  @file attach  ·  !cmd shell  ·  up/down scroll  ·  y/n approve  ·  ctrl+c stop or quit';
function Header({ title, contextUsed, contextPercent, columns, }) {
    const ctxColor = contextPercent > 85 ? C.err : contextPercent > 60 ? C.warn : C.dim;
    return h(Box, { flexDirection: 'row', justifyContent: 'space-between', width: columns, paddingX: 1 }, h(Box, {}, h(Text, { color: C.heart }, '\u2665 '), h(Text, { color: C.ink, bold: true }, clip(title.toLowerCase(), columns - 40))), h(Box, {}, h(Text, { color: C.dim }, `~${formatTokens(contextUsed)} `), h(Text, { color: ctxColor }, `${contextPercent.toFixed(0)}%`)));
}
function AgentLine({ mode, model, tick, phase }) {
    const busy = phase === 'thinking' || phase === 'streaming' || phase === 'tool';
    return h(Box, { paddingX: 1 }, h(Text, { color: mode === 'build' ? C.pink : C.warn }, '\u2661 '), h(Text, { color: C.pink, bold: true }, MODES[mode].label.toLowerCase()), h(Text, { color: C.dim }, ' \u00b7 '), h(Text, { color: C.muted }, model), busy ? h(Text, { color: C.hot }, `  ${spinnerFrame(tick)}`) : null);
}
function StatusLine({ mode, model, provider, columns }) {
    return h(Box, { flexDirection: 'row', width: columns, paddingX: 1 }, h(Text, { color: mode === 'build' ? C.pink : C.warn, bold: true }, MODES[mode].label.toLowerCase()), h(Text, { color: C.dim }, '  \u2661  '), h(Text, { color: C.blush }, model), h(Text, { color: C.dim }, '  on '), h(Text, { color: provider === 'openrouter' ? C.warn : C.muted }, provider));
}
function Footer({ status, scroll, lsps, locality, git, columns, }) {
    const lspSummary = lsps.length ? `${lsps.filter((l) => l.installed).length}/${lsps.length} lsp` : 'no lsp';
    return h(Box, { flexDirection: 'row', justifyContent: 'space-between', width: columns, paddingX: 1 }, h(Box, {}, h(Text, { color: C.heart }, '\u2665\u2661\u2665\u2661\u2665\u2661\u2665 '), h(Text, { color: C.muted }, 'esc '), h(Text, { color: C.dim }, 'stop  '), h(Text, { color: C.muted }, 'tab '), h(Text, { color: C.dim }, 'agents  '), h(Text, { color: C.muted }, 'ctrl+p '), h(Text, { color: C.dim }, 'commands'), scroll > 0 ? h(Text, { color: C.pink }, `  +${scroll}`) : null), h(Box, {}, git
        ? h(Text, {}, h(Text, { color: C.violet }, '\u2387 '), h(Text, { color: C.muted }, clip(git.branch, 20)), git.dirty ? h(Text, { color: C.warn }, '*') : null, git.ahead || git.behind ? h(Text, { color: C.dim }, ` \u2191${git.ahead}\u2193${git.behind}`) : null, h(Text, { color: C.dim }, '  '))
        : null, h(Text, { color: C.dim }, `${lspSummary}  `), h(Text, { color: C.muted }, clip(locality, 24), '  '), h(Text, { color: C.pink }, status)));
}
function Sidebar(props) {
    const { mood, maxRows, maxWidth, tick, phase, model, provider, contextUsed, contextMax, contextPercent, usage, lsps } = props;
    const meta = MOODS[mood];
    const inner = Math.max(12, maxWidth - 4);
    const busy = phase === 'thinking' || phase === 'streaming' || phase === 'tool';
    const rows = [];
    const push = (node) => rows.push(node);
    push(h(Box, { key: 'top', flexDirection: 'row', justifyContent: 'space-between' }, h(Text, { color: C.heart, bold: true }, '\u2665 aurora'), h(Text, { color: C.dim }, 'v0.1')));
    push(h(Box, { key: 'face', justifyContent: 'center' }, h(Text, { color: C.pink, bold: true }, meta.face)));
    push(h(Box, { key: 'label', justifyContent: 'center' }, h(Text, { color: C.hot }, `${meta.glyph} ${meta.label} ${meta.glyph}`)));
    push(h(Text, { key: 'rule1', color: C.line }, '\u2500'.repeat(inner)));
    const fixedRows = 17 + Math.max(1, Math.min(lsps.length, 3));
    const rainRows = Math.max(3, Math.min(maxRows - fixedRows, 10));
    const rainWidth = Math.max(8, inner - 2);
    const rain = rainBlock(rainWidth, rainRows, Math.floor(tick / 2));
    push(h(Box, { key: 'rain', flexDirection: 'column', alignItems: 'center' }, ...rain.map((line, index) => h(Text, { key: `r${index}` }, ...line.map((cell, ci) => h(Text, { key: ci, color: cell.color }, cell.char))))));
    push(h(Text, { key: 'rule2', color: C.line }, '\u2500'.repeat(inner)));
    const barColor = contextPercent > 85 ? C.err : contextPercent > 60 ? C.warn : C.pink;
    push(h(Box, { key: 'ctx-h', justifyContent: 'space-between' }, h(Text, { color: C.hot, bold: true }, 'context'), h(Text, { color: C.dim }, `${formatTokens(contextUsed)} / ${formatTokens(contextMax)}`)));
    push(h(Box, { key: 'ctx-bar' }, h(Text, { color: barColor }, contextBar(contextPercent, Math.max(6, inner - 6))), h(Text, { color: C.dim }, ` ${contextPercent.toFixed(0)}%`)));
    push(statRow('input', formatTokens(usage.input)));
    push(statRow('output', formatTokens(usage.output)));
    push(statRow('turns', String(usage.turns)));
    push(h(Text, { key: 'rule3', color: C.line }, '\u2500'.repeat(inner)));
    push(h(Box, { key: 'conn' }, h(Text, { color: C.dim }, 'model   '), h(Text, { color: C.blush }, clip(model, inner - 8))));
    push(h(Box, { key: 'prov' }, h(Text, { color: C.dim }, 'provider'), h(Text, { color: provider === 'openrouter' ? C.warn : C.muted }, ` ${provider}`)));
    push(h(Box, { key: 'state' }, h(Text, { color: C.dim }, 'state   '), busy ? h(Text, { color: C.pink }, `${spinnerFrame(tick)} ${meta.label}`) : h(Text, { color: C.user }, '\u2661 ready')));
    if (lsps.length) {
        push(h(Box, { key: 'lsp' }, h(Text, { color: C.dim }, 'lsp     '), h(Text, { color: C.muted }, lsps.slice(0, 3).map((l) => l.name).join(' '))));
    }
    const visible = rows.slice(0, Math.max(0, maxRows - 2));
    return h(Box, { flexDirection: 'column', width: maxWidth, borderStyle: 'round', borderColor: C.deep, paddingX: 1 }, ...visible);
}
function statRow(label, value) {
    return h(Box, { key: `stat-${label}`, justifyContent: 'space-between' }, h(Text, { color: C.dim }, `  ${label}`), h(Text, { color: C.muted }, value));
}
function clip(text, max) {
    if (max <= 1)
        return '';
    return text.length > max ? `${text.slice(0, max - 1)}\u2026` : text;
}
function InputBox({ input, phase, columns, paletteOpen }) {
    const busy = phase === 'thinking' || phase === 'streaming' || phase === 'tool';
    return h(Box, { flexDirection: 'row', width: columns, borderStyle: 'round', borderColor: paletteOpen ? C.pink : busy ? C.violet : C.deep, paddingX: 1, height: 3 }, h(Box, { flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, h(Text, {}, h(Text, { color: paletteOpen ? C.dim : busy ? C.violet : C.heart, bold: true }, '\u2661 '), paletteOpen ? h(Text, { color: C.dim }, 'palette open — esc to close') : h(Text, { color: C.ink }, input), paletteOpen ? null : h(Text, { color: busy ? C.violet : C.pink }, '\u2588'))));
}
function ApprovalBar({ request, columns, mode }) {
    void mode;
    const preview = request.preview ? request.preview.split('\n').slice(0, 8) : [];
    const rows = [
        h(Text, { key: 'k', color: C.dim }, 'your call'),
        h(Text, { key: 't', color: C.ink, bold: true }, request.title),
        h(Text, { key: 'd', color: C.muted }, request.detail),
        ...preview.map((line, index) => h(Text, { key: `p${index}`, color: C.code }, line)),
        h(Box, { key: 'a' }, h(Text, { color: C.accent, bold: true }, 'y '), h(Text, { color: C.muted }, 'approve once   '), h(Text, { color: C.err, bold: true }, 'n '), h(Text, { color: C.muted }, 'decline')),
    ];
    return h(Box, { flexDirection: 'column', width: columns, borderStyle: 'round', borderColor: C.pink, paddingX: 1 }, ...rows);
}
function statusText(phase, activity, tick) {
    switch (phase) {
        case 'thinking':
            return `${spinnerFrame(tick)} thinking...`;
        case 'streaming':
            return `${spinnerFrame(tick)} writing...`;
        case 'tool':
            return `${spinnerFrame(tick)} ${activity || 'working'}`;
        case 'approval':
            return 'waiting for you \u2661';
        case 'error':
            return 'oops, a little hiccup';
        default:
            return 'here for you \u2661';
    }
}
//# sourceMappingURL=App.js.map