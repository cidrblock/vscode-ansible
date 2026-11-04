/**
 * Contract shared by navita's main process, preload bridge and renderer.
 *
 * Keeping the section list here (rather than in the renderer) means the native
 * menu and the sidebar are generated from one source of truth.
 */

export const IPC = {
    getState: 'navita:get-state',
    stateChanged: 'navita:state-changed',
    openWorkspace: 'navita:open-workspace',
    activateWorkspace: 'navita:activate-workspace',
    closeWorkspace: 'navita:close-workspace',
    showSection: 'navita:show-section',
    toggleSidebar: 'navita:toggle-sidebar',
    rescanWorkspace: 'navita:rescan-workspace',
    copySnippet: 'navita:copy-snippet',
    testConnection: 'navita:test-connection',
} as const;

/** Sidebar sections, in the order they are ported from the extension views. */
export type SectionId =
    | 'dev-tools'
    | 'env-managers'
    | 'ai-tools'
    | 'ai-skills'
    | 'execution-environments'
    | 'installed-collections'
    | 'playbooks'
    | 'creator'
    | 'collection-sources';

export interface Section {
    readonly id: SectionId;
    readonly label: string;
    /** Extension view this section ports, for traceability. */
    readonly sourceView: string;
    readonly status: 'ready' | 'placeholder';
}

export const SECTIONS: readonly Section[] = [
    {
        id: 'dev-tools',
        label: 'Ansible Dev Tools',
        sourceView: 'ansibleDevToolsPackages',
        status: 'placeholder',
    },
    {
        id: 'env-managers',
        label: 'Environment Managers',
        sourceView: 'ansibleDevToolsEnvManagers',
        status: 'placeholder',
    },
    {
        id: 'ai-tools',
        label: 'AI Tools',
        sourceView: 'ansibleMcpTools',
        status: 'placeholder',
    },
    {
        id: 'ai-skills',
        label: 'AI Skills',
        sourceView: 'ansibleSkills',
        status: 'placeholder',
    },
    {
        id: 'execution-environments',
        label: 'Execution Environments',
        sourceView: 'ansibleExecutionEnvironments',
        status: 'placeholder',
    },
    {
        id: 'installed-collections',
        label: 'Installed Collections',
        sourceView: 'ansibleDevToolsCollections',
        status: 'placeholder',
    },
    { id: 'playbooks', label: 'Playbooks', sourceView: 'ansiblePlaybooks', status: 'placeholder' },
    { id: 'creator', label: 'Creator', sourceView: 'ansibleCreator', status: 'placeholder' },
    {
        id: 'collection-sources',
        label: 'Collection Sources',
        sourceView: 'ansibleCollectionSources',
        status: 'placeholder',
    },
];

/** Harnesses a generated MCP snippet can target. */
export type HarnessId = 'cursor' | 'claude-code' | 'codex' | 'vscode';

export interface Harness {
    readonly id: HarnessId;
    readonly label: string;
    /** File a user would paste the snippet into. */
    readonly configPath: string;
}

export const HARNESSES: readonly Harness[] = [
    { id: 'cursor', label: 'Cursor', configPath: '.cursor/mcp.json' },
    { id: 'claude-code', label: 'Claude Code', configPath: '.mcp.json' },
    { id: 'codex', label: 'Codex', configPath: '~/.codex/config.toml' },
    { id: 'vscode', label: 'VS Code / Copilot', configPath: '.vscode/mcp.json' },
];

export interface WorkspaceEntry {
    readonly path: string;
    readonly name: string;
    readonly openedAt: number;
}

export type ServerState = 'stopped' | 'starting' | 'ready' | 'error';

export interface ServerStatus {
    readonly state: ServerState;
    readonly detail?: string;
}

export interface McpStatus extends ServerStatus {
    /** Number of tools reported by a live `tools/list` handshake. */
    readonly toolCount?: number;
}

export interface AppState {
    readonly workspace: WorkspaceEntry | null;
    readonly recents: readonly WorkspaceEntry[];
    readonly activeSection: SectionId;
    readonly mcp: McpStatus;
    readonly lsp: ServerStatus;
}

/** Actions the native menu can trigger, kept serializable for testability. */
export type MenuAction =
    | { readonly id: 'open-workspace' }
    | { readonly id: 'open-recent'; readonly path: string }
    | { readonly id: 'close-workspace' }
    | { readonly id: 'rescan-workspace' }
    | { readonly id: 'reveal-workspace' }
    | { readonly id: 'show-section'; readonly section: SectionId }
    | { readonly id: 'toggle-sidebar' }
    | { readonly id: 'copy-snippet'; readonly harness: HarnessId }
    | { readonly id: 'test-connection' }
    | { readonly id: 'about' }
    | { readonly id: 'reload' }
    | { readonly id: 'devtools' }
    | { readonly id: 'quit' };

/** Surface exposed to the renderer through the preload bridge. */
export interface NavitaBridge {
    getState(): Promise<AppState>;
    openWorkspace(): Promise<AppState>;
    activateWorkspace(workspacePath: string): Promise<AppState>;
    closeWorkspace(): Promise<AppState>;
    showSection(section: SectionId): Promise<AppState>;
    rescanWorkspace(): Promise<AppState>;
    copySnippet(harness: HarnessId): Promise<string>;
    testConnection(): Promise<AppState>;
    onStateChanged(listener: (state: AppState) => void): () => void;
    onToggleSidebar(listener: () => void): () => void;
}
