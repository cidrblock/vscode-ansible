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
    getDevTools: 'navita:get-dev-tools',
    getEnvironments: 'navita:get-environments',
    getTools: 'navita:get-tools',
    getCollections: 'navita:get-collections',
    getExecutionEnvironments: 'navita:get-execution-environments',
    getPlaybooks: 'navita:get-playbooks',
    getCreator: 'navita:get-creator',
    getCollectionSources: 'navita:get-collection-sources',
    getSkills: 'navita:get-skills',
    copyText: 'navita:copy-text',
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

/** Groups the sidebar collapses as a unit. */
export type SectionGroupId = 'environment' | 'ai' | 'content';

export interface SectionGroup {
    readonly id: SectionGroupId;
    readonly label: string;
}

/** Sidebar groups, in display order. */
export const SECTION_GROUPS: readonly SectionGroup[] = [
    { id: 'environment', label: 'Environment' },
    { id: 'ai', label: 'AI' },
    { id: 'content', label: 'Ansible Content' },
];

export interface Section {
    readonly id: SectionId;
    readonly label: string;
    /** Collapsible group this section belongs to. */
    readonly group: SectionGroupId;
    /** Extension view this section ports, for traceability. */
    readonly sourceView: string;
}

export const SECTIONS: readonly Section[] = [
    {
        id: 'dev-tools',
        label: 'Ansible Dev Tools',
        group: 'environment',
        sourceView: 'ansibleDevToolsPackages',
    },
    {
        id: 'env-managers',
        label: 'Environment Managers',
        group: 'environment',
        sourceView: 'ansibleDevToolsEnvManagers',
    },
    {
        id: 'ai-tools',
        label: 'AI Tools',
        group: 'ai',
        sourceView: 'ansibleMcpTools',
    },
    {
        id: 'ai-skills',
        label: 'AI Skills',
        group: 'ai',
        sourceView: 'ansibleSkills',
    },
    {
        id: 'execution-environments',
        label: 'Execution Environments',
        group: 'content',
        sourceView: 'ansibleExecutionEnvironments',
    },
    {
        id: 'installed-collections',
        label: 'Installed Collections',
        group: 'content',
        sourceView: 'ansibleDevToolsCollections',
    },
    {
        id: 'playbooks',
        label: 'Playbooks',
        group: 'content',
        sourceView: 'ansiblePlaybooks',
    },
    {
        id: 'creator',
        label: 'Creator',
        group: 'content',
        sourceView: 'ansibleCreator',
    },
    {
        id: 'collection-sources',
        label: 'Collection Sources',
        group: 'content',
        sourceView: 'ansibleCollectionSources',
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

export interface DevToolEntry {
    readonly name: string;
    readonly version: string;
    readonly location?: string;
}

export interface DevToolsResult {
    readonly state: 'ready' | 'error';
    readonly packages: readonly DevToolEntry[];
    readonly detail?: string;
}

export interface LocalEnvironmentEntry {
    readonly name: string;
    readonly pythonPath: string;
    readonly version?: string;
    readonly active: boolean;
}

export interface EnvironmentGroup {
    readonly id: string;
    readonly label: string;
    readonly environments: readonly LocalEnvironmentEntry[];
}

export interface EnvironmentGroupsResult {
    readonly state: 'ready' | 'error';
    readonly groups: readonly EnvironmentGroup[];
    readonly detail?: string;
}

export interface ToolEntry {
    readonly name: string;
    readonly description?: string;
    readonly prompt: string;
}

export interface ToolGroup {
    readonly id: string;
    readonly label: string;
    readonly tools: readonly ToolEntry[];
}

export interface ToolsResult {
    readonly state: 'ready' | 'error';
    readonly groups: readonly ToolGroup[];
    readonly toolCount: number;
    readonly detail?: string;
}

export interface SkillEntryView {
    readonly id: string;
    readonly name: string;
    readonly module: string;
    readonly source: string;
    readonly description: string;
    readonly prompt: string;
}

export interface SkillGroup {
    readonly id: string;
    readonly label: string;
    readonly skills: readonly SkillEntryView[];
}

export interface SkillsResult {
    readonly state: 'ready' | 'error';
    readonly groups: readonly SkillGroup[];
    readonly detail?: string;
}

export interface CollectionEntry {
    readonly name: string;
    readonly version: string;
    readonly description?: string;
    readonly path?: string;
    readonly pluginCount: number;
}

export interface CollectionsResult {
    readonly state: 'ready' | 'error';
    readonly collections: readonly CollectionEntry[];
    readonly detail?: string;
}

export interface ExecutionEnvironmentEntry {
    readonly fullName: string;
    readonly imageId: string;
    readonly created: string;
}

export interface ExecutionEnvironmentsResult {
    readonly state: 'ready' | 'error';
    readonly environments: readonly ExecutionEnvironmentEntry[];
    readonly detail?: string;
}

/** One play inside a playbook, with the line it starts on. */
export interface PlayEntry {
    readonly name: string;
    readonly hosts: string;
    readonly lineNumber: number;
}

/** A playbook discovered in the workspace. */
export interface PlaybookEntry {
    readonly name: string;
    readonly path: string;
    readonly relativePath: string;
    readonly playCount: number;
    readonly plays: readonly PlayEntry[];
    /** AI summary prompt for this playbook, copied by the row action. */
    readonly prompt: string;
}

export interface PlaybooksResult {
    readonly state: 'ready' | 'error';
    readonly playbooks: readonly PlaybookEntry[];
    readonly detail?: string;
}

/** One ansible-creator command, with a template users complete then paste. */
export interface CreatorCommandEntry {
    /** Full command path, for example `init collection`. */
    readonly path: string;
    /** Top-level command this one belongs to, for grouping. */
    readonly group: string;
    /** Path below the group, for example `collection`. */
    readonly name: string;
    readonly description?: string;
    /** Command line with <placeholders> for the arguments navita cannot know. */
    readonly command: string;
    /** Schema keys the command requires. */
    readonly required: readonly string[];
    readonly optionalCount: number;
}

export interface CreatorResult {
    readonly state: 'ready' | 'error';
    readonly status: 'unknown' | 'not-installed' | 'outdated' | 'ready';
    readonly version?: string;
    readonly commands: readonly CreatorCommandEntry[];
    readonly detail?: string;
}

/** One collection in the Galaxy catalog. */
export interface CollectionSourceEntry {
    /** Fully qualified name, `namespace.name`. */
    readonly name: string;
    readonly version: string;
    readonly downloadCount: number;
    readonly deprecated: boolean;
    /** AI summary prompt for this collection. */
    readonly prompt: string;
}

/** Cached collection count for one GitHub organization. */
export interface GitHubOrgSource {
    readonly org: string;
    readonly count: number;
    readonly lastUpdated?: string;
}

export interface CollectionSourcesResult {
    /** `loading` while the Galaxy catalog is still being fetched. */
    readonly state: 'ready' | 'loading' | 'error';
    /** Collections in the catalog, not just the ones listed. */
    readonly total: number;
    readonly galaxy: readonly CollectionSourceEntry[];
    readonly github: readonly GitHubOrgSource[];
    readonly detail?: string;
}

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
    getDevTools(): Promise<DevToolsResult>;
    getEnvironments(workspacePath: string | null): Promise<EnvironmentGroupsResult>;
    getTools(): Promise<ToolsResult>;
    getSkills(): Promise<SkillsResult>;
    copyText(text: string): Promise<void>;
    getCollections(): Promise<CollectionsResult>;
    getExecutionEnvironments(): Promise<ExecutionEnvironmentsResult>;
    getPlaybooks(workspacePath: string | null): Promise<PlaybooksResult>;
    getCreator(): Promise<CreatorResult>;
    getCollectionSources(): Promise<CollectionSourcesResult>;
    onStateChanged(listener: (state: AppState) => void): () => void;
    onToggleSidebar(listener: () => void): () => void;
}
