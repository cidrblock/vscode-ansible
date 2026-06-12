import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { SectionList } from '../components/SectionList';
import type { SectionDef } from '../components/SectionList';
import type { NavitaSettings, McpToolInfo, ServiceStatus, ColorScheme, AbbenayStatus, AbbenayModelInfo } from '../../shared/types';

// ---------------------------------------------------------------------------
// Settings shared state hook (lifted so category list + form share state)
// ---------------------------------------------------------------------------

export interface SettingsState {
    settings: NavitaSettings | null;
    status: ServiceStatus | null;
    allTools: McpToolInfo[];
    saving: boolean;
    saved: boolean;
    configSnippet: string | null;
    snippetFormat: string;
    abbenayStatus: AbbenayStatus | null;
    abbenayModels: AbbenayModelInfo[];
    update: (patch: Partial<NavitaSettings>) => void;
    handleSave: () => Promise<void>;
    handleRestartMcp: () => Promise<void>;
    handleRestartLsp: () => Promise<void>;
    handleGenerateSnippet: () => Promise<void>;
    handleCopySnippet: () => void;
    setSnippetFormat: (f: string) => void;
    setConfigSnippet: (s: string | null) => void;
    toggleTool: (name: string) => void;
    isToolEnabled: (name: string) => boolean;
    onColorSchemeChange?: (scheme: ColorScheme) => void;
    refreshAbbenayStatus: () => void;
}

export function useSettingsState(
    onColorSchemeChange?: (scheme: ColorScheme) => void,
    onModelChange?: (model: string) => void,
): SettingsState {
    const [settings, setSettings] = useState<NavitaSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [status, setStatus] = useState<ServiceStatus | null>(null);
    const [allTools, setAllTools] = useState<McpToolInfo[]>([]);
    const [configSnippet, setConfigSnippet] = useState<string | null>(null);
    const [snippetFormat, setSnippetFormat] = useState('claude');
    const [abbenayStatus, setAbbenayStatus] = useState<AbbenayStatus | null>(null);
    const [abbenayModels, setAbbenayModels] = useState<AbbenayModelInfo[]>([]);

    useEffect(() => {
        void api.getSettings().then(setSettings);
        void api.getServiceStatus().then(setStatus);
        void api.getMcpTools().then(setAllTools);
        void api.abbenayStatus().then(setAbbenayStatus);
        void api.abbenayListModels().then(setAbbenayModels);
    }, []);

    const refreshAbbenayStatus = () => {
        void api.abbenayStatus().then(setAbbenayStatus);
        void api.abbenayListModels().then(setAbbenayModels);
    };

    const refreshStatus = () => { void api.getServiceStatus().then(setStatus); };

    const update = (patch: Partial<NavitaSettings>) => {
        if (!settings) return;
        setSettings({ ...settings, ...patch });
        setSaved(false);
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        await api.saveSettings(settings);
        setSaving(false);
        setSaved(true);
        onModelChange?.(settings.abbenayModel ?? '');
    };

    const handleRestartMcp = async () => { await api.restartMcp(); refreshStatus(); };
    const handleRestartLsp = async () => { await api.restartLsp(); refreshStatus(); };

    const handleGenerateSnippet = async () => {
        const result = await api.getMcpConfigSnippet(snippetFormat);
        setConfigSnippet(result.config);
    };

    const handleCopySnippet = () => {
        if (configSnippet) void navigator.clipboard.writeText(configSnippet);
    };

    const toggleTool = (toolName: string) => {
        if (!settings) return;
        const current = settings.mcpExposedTools;
        if (current.length === 0) {
            update({ mcpExposedTools: allTools.filter((t) => t.name !== toolName).map((t) => t.name) });
        } else if (current.includes(toolName)) {
            update({ mcpExposedTools: current.filter((n) => n !== toolName) });
        } else {
            update({ mcpExposedTools: [...current, toolName] });
        }
    };

    const isToolEnabled = (toolName: string) => {
        if (!settings) return true;
        return settings.mcpExposedTools.length === 0 || settings.mcpExposedTools.includes(toolName);
    };

    return {
        settings, status, allTools, saving, saved, configSnippet, snippetFormat,
        abbenayStatus, abbenayModels,
        update, handleSave, handleRestartMcp, handleRestartLsp,
        handleGenerateSnippet, handleCopySnippet, setSnippetFormat, setConfigSnippet,
        toggleTool, isToolEnabled, onColorSchemeChange, refreshAbbenayStatus,
    };
}

// ---------------------------------------------------------------------------
// Category list (Column 2)
// ---------------------------------------------------------------------------

const SETTINGS_CATEGORIES: SectionDef[] = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'ai', label: 'AI / Abbenay' },
    { id: 'python', label: 'Python' },
    { id: 'sources', label: 'Collection Sources' },
    { id: 'llm', label: 'LLM / AI (Legacy)' },
    { id: 'mcp', label: 'MCP Server' },
    { id: 'lsp', label: 'Language Server' },
    { id: 'platform', label: 'Platform' },
];

interface SettingsCategoryListProps {
    selected: string | null;
    onSelect: (id: string) => void;
    state: SettingsState;
}

export function SettingsCategoryList({ selected, onSelect, state }: SettingsCategoryListProps): React.JSX.Element {
    const categories = SETTINGS_CATEGORIES.map((c) => {
        if (c.id === 'mcp' && state.status) {
            return { ...c, badge: state.status.mcp.running ? 'running' : 'off' };
        }
        if (c.id === 'lsp' && state.status) {
            return { ...c, badge: state.status.lsp.running ? 'running' : 'off' };
        }
        if (c.id === 'ai' && state.abbenayStatus) {
            return { ...c, badge: state.abbenayStatus.state === 'connected' ? 'connected' : state.abbenayStatus.state };
        }
        return c;
    });

    return <SectionList sections={categories} activeId={selected} onSelect={onSelect} />;
}

// ---------------------------------------------------------------------------
// Category form (Column 3)
// ---------------------------------------------------------------------------

interface SettingsCategoryFormProps {
    categoryId: string;
    state: SettingsState;
}

export function SettingsCategoryForm({ categoryId, state }: SettingsCategoryFormProps): React.JSX.Element {
    const { settings, saving, saved, handleSave } = state;

    if (!settings) return <div style={styles.muted}>Loading...</div>;

    return (
        <div style={styles.container}>
            {renderCategory(categoryId, state)}
            <div style={styles.actions}>
                <button style={styles.saveBtn} onClick={() => void handleSave()} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
                {saved && <span style={styles.savedMsg}>Saved</span>}
            </div>
        </div>
    );
}

function renderCategory(id: string, state: SettingsState): React.ReactNode {
    const { settings, update } = state;
    if (!settings) return null;

    switch (id) {
        case 'ai':
            return renderAiCategory(state);

        case 'appearance':
            return (
                <fieldset style={styles.group}>
                    <legend style={styles.legend}>Appearance</legend>
                    <label style={styles.label}>Color scheme</label>
                    <div style={styles.schemeRow}>
                        {(['light', 'dark', 'auto'] as const).map((scheme) => (
                            <button
                                key={scheme}
                                style={{ ...styles.schemeBtn, ...(settings.colorScheme === scheme ? styles.schemeBtnActive : {}) }}
                                onClick={() => { update({ colorScheme: scheme }); state.onColorSchemeChange?.(scheme); }}
                            >
                                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
                            </button>
                        ))}
                    </div>
                    <p style={styles.helpText}>
                        {settings.colorScheme === 'auto'
                            ? 'Follows your operating system preference.'
                            : `Always use the ${settings.colorScheme} theme.`}
                    </p>
                </fieldset>
            );

        case 'python':
            return (
                <fieldset style={styles.group}>
                    <legend style={styles.legend}>Python Environment</legend>
                    <label style={styles.label}>Python path</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={settings.pythonPath ?? ''}
                        onChange={(e) => update({ pythonPath: e.target.value || null })}
                        placeholder="Auto-detect from project"
                    />
                </fieldset>
            );

        case 'sources':
            return (
                <fieldset style={styles.group}>
                    <legend style={styles.legend}>Collection Sources</legend>
                    <label style={styles.label}>GitHub organizations (comma-separated)</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={settings.githubOrgs.join(', ')}
                        onChange={(e) => update({ githubOrgs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                        placeholder="redhat-cop, ansible-collections"
                    />
                </fieldset>
            );

        case 'llm':
            return (
                <fieldset style={styles.group}>
                    <legend style={styles.legend}>LLM / AI Provider</legend>
                    <label style={styles.label}>Provider</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={settings.llmProvider ?? ''}
                        onChange={(e) => update({ llmProvider: e.target.value || null })}
                        placeholder="copilot, ollama, open-llm"
                    />
                    <label style={styles.label}>Model</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={settings.llmModel ?? ''}
                        onChange={(e) => update({ llmModel: e.target.value || null })}
                        placeholder="Auto-select"
                    />
                </fieldset>
            );

        case 'mcp':
            return renderMcpCategory(state);

        case 'lsp':
            return renderLspCategory(state);

        case 'platform':
            return (
                <fieldset style={styles.group}>
                    <legend style={styles.legend}>Platform</legend>
                    <label style={styles.label}>AAP Controller URL</label>
                    <input
                        style={styles.input}
                        type="text"
                        value={settings.controllerUrl ?? ''}
                        onChange={(e) => update({ controllerUrl: e.target.value || null })}
                        placeholder="https://controller.example.com"
                    />
                </fieldset>
            );

        default:
            return null;
    }
}

function renderAiCategory(state: SettingsState): React.ReactNode {
    const { settings, update, abbenayStatus, abbenayModels, refreshAbbenayStatus } = state;
    if (!settings) return null;

    const handleConnect = async () => {
        await api.abbenayConnect();
        refreshAbbenayStatus();
    };

    const handleDisconnect = async () => {
        await api.abbenayDisconnect();
        refreshAbbenayStatus();
    };

    const handleOpenWebUI = async () => {
        const result = await api.abbenayOpenWebUI();
        if (!result.ok) {
            console.error('Failed to open Abbenay Web UI:', result.error);
        }
    };

    return (
        <fieldset style={styles.group}>
            <legend style={styles.legend}>
                AI / Abbenay
                <span style={(styles.statusBadge as (r: boolean) => React.CSSProperties)(abbenayStatus?.state === 'connected')}>
                    {abbenayStatus?.state === 'connected'
                        ? `Connected${abbenayStatus.version ? ` (${abbenayStatus.version})` : ''}`
                        : abbenayStatus?.state ?? 'unknown'}
                </span>
            </legend>

            <label style={styles.checkLabel}>
                <input
                    type="checkbox"
                    checked={settings.abbenayAutoConnect}
                    onChange={(e) => update({ abbenayAutoConnect: e.target.checked })}
                />
                Auto-connect on startup
            </label>

            <label style={styles.checkLabel}>
                <input
                    type="checkbox"
                    checked={settings.enableChat}
                    onChange={(e) => update({ enableChat: e.target.checked })}
                />
                Enable interactive chat panel
            </label>

            <label style={styles.label}>Preferred model</label>
            <select
                style={styles.input}
                value={settings.abbenayModel ?? ''}
                onChange={(e) => update({ abbenayModel: e.target.value || null })}
            >
                <option value="">Auto-select</option>
                {abbenayModels.map((m) => (
                    <option key={m.id} value={m.id}>
                        {m.name || m.id} ({m.provider})
                    </option>
                ))}
            </select>

            <p style={styles.helpText}>
                Abbenay provides AI capabilities for automated analysis and interactive chat.
                It connects to a local daemon that handles model routing and tool execution.
            </p>

            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' as const }}>
                {abbenayStatus?.state !== 'connected' ? (
                    <button style={styles.actionBtn} onClick={() => void handleConnect()}>
                        Connect
                    </button>
                ) : (
                    <button style={styles.actionBtn} onClick={() => void handleDisconnect()}>
                        Disconnect
                    </button>
                )}
                <button style={styles.actionBtn} onClick={refreshAbbenayStatus}>
                    Refresh
                </button>
                {abbenayStatus?.state === 'connected' && (
                    <button style={styles.actionBtn} onClick={() => void handleOpenWebUI()}>
                        Open Web UI
                    </button>
                )}
            </div>

            {abbenayStatus?.error && (
                <div style={{ ...styles.helpText, color: 'var(--navita-error, #e55)' }}>
                    {abbenayStatus.error}
                </div>
            )}

            {abbenayStatus?.state === 'connected' && abbenayStatus.connectedClients !== undefined && (
                <div style={styles.subSection}>
                    <div style={styles.subLabel}>
                        Daemon info
                        <span style={styles.hint}>{abbenayStatus.connectedClients} connected client(s)</span>
                    </div>
                </div>
            )}
        </fieldset>
    );
}

function renderMcpCategory(state: SettingsState): React.ReactNode {
    const { settings, status, allTools, update, handleRestartMcp, configSnippet, snippetFormat, handleGenerateSnippet, handleCopySnippet, setSnippetFormat, setConfigSnippet, toggleTool, isToolEnabled } = state;
    if (!settings) return null;

    return (
        <fieldset style={styles.group}>
            <legend style={styles.legend}>
                MCP Server
                <span style={(styles.statusBadge as (r: boolean) => React.CSSProperties)(status?.mcp.running ?? false)}>
                    {status?.mcp.running ? `Running (${status.mcp.toolCount} tools)` : 'Stopped'}
                </span>
            </legend>

            <label style={styles.checkLabel}>
                <input type="checkbox" checked={settings.mcpAutoStart} onChange={(e) => update({ mcpAutoStart: e.target.checked })} />
                Auto-start on launch
            </label>

            <label style={styles.label}>Transport</label>
            <select style={styles.input} value={settings.mcpTransport} onChange={(e) => update({ mcpTransport: e.target.value as NavitaSettings['mcpTransport'] })}>
                <option value="stdio">stdio (for Claude Code, Cursor, etc.)</option>
                <option value="socket">Unix domain socket</option>
                <option value="sse">SSE over HTTP</option>
            </select>

            {settings.mcpTransport === 'socket' && (
                <>
                    <label style={styles.label}>Socket path</label>
                    <input style={styles.input} type="text" value={settings.mcpSocketPath ?? ''} onChange={(e) => update({ mcpSocketPath: e.target.value || null })} placeholder="/tmp/ansible-navita-mcp.sock" />
                </>
            )}

            {settings.mcpTransport === 'sse' && (
                <>
                    <label style={styles.label}>Port</label>
                    <input style={styles.input} type="number" value={settings.mcpPort ?? ''} onChange={(e) => update({ mcpPort: e.target.value ? Number(e.target.value) : null })} placeholder="3100" />
                </>
            )}

            <button style={styles.actionBtn} onClick={() => void handleRestartMcp()}>Restart MCP Server</button>

            <div style={styles.subSection}>
                <div style={styles.subLabel}>
                    Exposed tools
                    <span style={styles.hint}>
                        {settings.mcpExposedTools.length === 0
                            ? `All ${allTools.length} tools exposed`
                            : `${settings.mcpExposedTools.length} of ${allTools.length} tools exposed`}
                    </span>
                </div>
                <div style={styles.toolList}>
                    {allTools.map((tool) => (
                        <label key={tool.name} style={styles.toolRow}>
                            <input type="checkbox" checked={isToolEnabled(tool.name)} onChange={() => toggleTool(tool.name)} />
                            <span style={styles.toolName}>{tool.name}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div style={styles.subSection}>
                <div style={styles.subLabel}>Agent configuration snippet</div>
                <div style={styles.snippetRow}>
                    <select style={styles.snippetSelect} value={snippetFormat} onChange={(e) => { setSnippetFormat(e.target.value); setConfigSnippet(null); }}>
                        <option value="claude">Claude Code</option>
                        <option value="cursor">Cursor</option>
                        <option value="generic">Generic MCP</option>
                    </select>
                    <button style={styles.actionBtn} onClick={() => void handleGenerateSnippet()}>Generate</button>
                </div>
                {configSnippet && (
                    <div style={styles.snippetContainer}>
                        <pre style={styles.snippet}>{configSnippet}</pre>
                        <button style={styles.copyBtn} onClick={handleCopySnippet}>Copy</button>
                    </div>
                )}
            </div>
        </fieldset>
    );
}

function renderLspCategory(state: SettingsState): React.ReactNode {
    const { settings, status, update, handleRestartLsp } = state;
    if (!settings) return null;

    return (
        <fieldset style={styles.group}>
            <legend style={styles.legend}>
                Language Server
                <span style={(styles.statusBadge as (r: boolean) => React.CSSProperties)(status?.lsp.running ?? false)}>
                    {status?.lsp.running ? `Running (pid ${status.lsp.pid ?? '?'})` : 'Stopped'}
                </span>
            </legend>

            <label style={styles.checkLabel}>
                <input type="checkbox" checked={settings.lspAutoStart} onChange={(e) => update({ lspAutoStart: e.target.checked })} />
                Auto-start on launch
            </label>

            <label style={styles.label}>Binary path (override)</label>
            <input style={styles.input} type="text" value={settings.lspBinaryPath ?? ''} onChange={(e) => update({ lspBinaryPath: e.target.value || null })} placeholder="Auto-detect from monorepo" />

            <button style={styles.actionBtn} onClick={() => void handleRestartLsp()}>Restart Language Server</button>

            <p style={styles.helpText}>
                The Ansible language server provides diagnostics, completion, and hover
                documentation. It communicates via LSP over stdio and is available to
                editors and AI agents that support the protocol.
            </p>
        </fieldset>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties | ((...args: unknown[]) => React.CSSProperties)> = {
    container: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 32px', height: '100%', overflowY: 'auto' as const },
    group: { display: 'flex', flexDirection: 'column', gap: '6px', border: 'none', padding: 0, margin: 0 },
    legend: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--navita-font-size-sm)', fontWeight: 600, color: 'var(--navita-text-primary)', marginBottom: '4px' },
    label: { fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-secondary)', marginTop: '4px' },
    input: {
        padding: '6px 10px', background: 'var(--navita-bg-tertiary)', border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-primary)', outline: 'none',
    },
    checkLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-secondary)', cursor: 'pointer' },
    statusBadge: ((running: boolean) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 8px',
        borderRadius: '10px', fontSize: 'var(--navita-font-size-xs)', fontWeight: 400,
        background: running ? 'var(--navita-success-subtle)' : 'var(--navita-bg-tertiary)',
        color: running ? 'var(--navita-success)' : 'var(--navita-text-tertiary)',
    })) as unknown as React.CSSProperties,
    subSection: { marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
    subLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--navita-font-size-xs)', fontWeight: 500, color: 'var(--navita-text-secondary)' },
    hint: { fontWeight: 400, color: 'var(--navita-text-tertiary)' },
    toolList: {
        display: 'flex', flexDirection: 'column', gap: '1px', maxHeight: '200px', overflowY: 'auto' as const,
        padding: '4px 0', background: 'var(--navita-bg-tertiary)', borderRadius: 'var(--navita-radius-sm)',
    },
    toolRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-secondary)', cursor: 'pointer' },
    toolName: { fontFamily: 'var(--navita-font-mono)', fontSize: '11px' },
    snippetRow: { display: 'flex', gap: '6px', alignItems: 'center' },
    snippetSelect: {
        padding: '5px 8px', background: 'var(--navita-bg-tertiary)', border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-primary)',
    },
    snippetContainer: { position: 'relative' as const, marginTop: '4px' },
    snippet: {
        padding: '10px', background: 'var(--navita-bg-primary)', border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-sm)', fontSize: '11px', fontFamily: 'var(--navita-font-mono)',
        color: 'var(--navita-text-secondary)', whiteSpace: 'pre-wrap' as const, maxHeight: '200px',
        overflowY: 'auto' as const, userSelect: 'text',
    },
    copyBtn: {
        position: 'absolute' as const, top: '6px', right: '6px',
        padding: '2px 8px', background: 'var(--navita-bg-hover)', borderRadius: 'var(--navita-radius-sm)',
        fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-secondary)',
    },
    actionBtn: {
        alignSelf: 'flex-start', padding: '5px 12px', background: 'var(--navita-bg-hover)',
        borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-secondary)', marginTop: '4px',
    },
    helpText: { fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)', lineHeight: 1.5, marginTop: '4px' },
    actions: { display: 'flex', alignItems: 'center', gap: '10px' },
    saveBtn: {
        padding: '7px 20px', background: 'var(--navita-text-primary)', color: 'var(--navita-text-inverse)',
        borderRadius: 'var(--navita-radius-sm)', fontWeight: 500, fontSize: 'var(--navita-font-size-sm)',
    },
    savedMsg: { fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-success)' },
    schemeRow: { display: 'flex', gap: '4px' },
    schemeBtn: {
        padding: '5px 16px', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-sm)',
        background: 'var(--navita-bg-tertiary)', color: 'var(--navita-text-secondary)',
        border: '1px solid var(--navita-border)',
    },
    schemeBtnActive: {
        background: 'var(--navita-text-primary)', color: 'var(--navita-text-inverse)',
        borderColor: 'var(--navita-text-primary)',
    },
    muted: { color: 'var(--navita-text-tertiary)', fontSize: 'var(--navita-font-size-sm)', padding: '24px' },
};
