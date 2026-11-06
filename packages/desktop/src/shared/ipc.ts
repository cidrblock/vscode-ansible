/**
 * Contract shared by navita's main process, preload bridge and renderer.
 *
 * Keeping the section list here (rather than in the renderer) means the native
 * menu and the sidebar are generated from one source of truth.
 */

import type { SchemaNode } from '@ansible/common';

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
    selectEnvironment: 'navita:select-environment',
    getTools: 'navita:get-tools',
    getCollections: 'navita:get-collections',
    getCollectionPlugins: 'navita:get-collection-plugins',
    getSourcePlugins: 'navita:get-source-plugins',
    getSourcePluginDoc: 'navita:get-source-plugin-doc',
    getPluginDoc: 'navita:get-plugin-doc',
    getExecutionEnvironments: 'navita:get-execution-environments',
    getExecutionEnvironmentDetails: 'navita:get-execution-environment-details',
    getPlaybooks: 'navita:get-playbooks',
    getCreator: 'navita:get-creator',
    getCollectionSources: 'navita:get-collection-sources',
    refreshCollectionSource: 'navita:refresh-collection-source',
    getSkills: 'navita:get-skills',
    copyText: 'navita:copy-text',
    runCreator: 'navita:run-creator',
    creatorStarted: 'navita:creator-started',
    creatorFinished: 'navita:creator-finished',
    openPath: 'navita:open-path',
    navigateBack: 'navita:navigate-back',
    sectionRequested: 'navita:section-requested',
    installDevTools: 'navita:install-dev-tools',
    setTheme: 'navita:set-theme',
    updateSettings: 'navita:update-settings',
    clearRecents: 'navita:clear-recents',
    getLogs: 'navita:get-logs',
    clearLogs: 'navita:clear-logs',
    logsChanged: 'navita:logs-changed',
    removeRecent: 'navita:remove-recent',
    installCollection: 'navita:install-collection',
    getTerminalInfo: 'navita:get-terminal-info',
    openTerminal: 'navita:open-terminal',
    getDiagnostics: 'navita:get-diagnostics',
    upgradeDevTools: 'navita:upgrade-dev-tools',
} as const;

/** Sidebar sections, in the order they are ported from the extension views. */
export type SectionId =
    | 'overview'
    | 'dev-tools'
    | 'env-managers'
    | 'ai-tools'
    | 'ai-skills'
    | 'execution-environments'
    | 'installed-collections'
    | 'playbooks'
    | 'creator'
    | 'collection-sources'
    | 'harness-setup'
    | 'services'
    | 'settings'
    | 'logs'
    | 'diagnostics';

/** Colour schemes the app can be asked to wear. */
export type ThemeId = 'system' | 'navita-light' | 'navita-dark' | 'rhdh-light' | 'rhdh-dark';

export interface Theme {
    readonly id: ThemeId;
    readonly label: string;
}

/**
 * Themes in menu order.
 *
 * `system` keeps navita's own palette and follows the OS light/dark setting;
 * the explicit entries pin one palette regardless of the desktop preference.
 */
export const THEMES: readonly Theme[] = [
    { id: 'system', label: 'Follow System' },
    { id: 'navita-light', label: 'navita Light' },
    { id: 'navita-dark', label: 'navita Dark' },
    { id: 'rhdh-light', label: 'Red Hat Light' },
    { id: 'rhdh-dark', label: 'Red Hat Dark' },
];

/** Groups the sidebar collapses as a unit. */
export type SectionGroupId = 'home' | 'environment' | 'ai' | 'content';

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

/**
 * Every section, in the order the sidebar and the View menu show them.
 *
 * Alphabetical within each group: the drawers are lists to scan, not a
 * narrative, and `sections.test.ts` keeps them that way.
 */
export const SECTIONS: readonly Section[] = [
    {
        id: 'overview',
        label: 'Overview',
        group: 'home',
        sourceView: 'navitaOverview',
    },
    {
        id: 'diagnostics',
        label: 'Diagnostics',
        group: 'home',
        sourceView: 'navitaDiagnostics',
    },
    {
        id: 'logs',
        label: 'Logs',
        group: 'home',
        sourceView: 'navitaLogs',
    },
    {
        id: 'dev-tools',
        label: 'Developer tools',
        group: 'environment',
        sourceView: 'ansibleDevToolsPackages',
    },
    {
        id: 'env-managers',
        label: 'Python environment',
        group: 'environment',
        sourceView: 'ansibleDevToolsEnvManagers',
    },
    {
        id: 'harness-setup',
        label: 'Harness Setup',
        group: 'ai',
        sourceView: 'navitaHarnessSetup',
    },
    {
        id: 'services',
        label: 'Services',
        group: 'ai',
        sourceView: 'navitaServices',
    },
    {
        id: 'ai-skills',
        label: 'Skills',
        group: 'ai',
        sourceView: 'ansibleSkills',
    },
    {
        id: 'ai-tools',
        label: 'Tools',
        group: 'ai',
        sourceView: 'ansibleMcpTools',
    },
    {
        id: 'collection-sources',
        label: 'Collection Sources',
        group: 'content',
        sourceView: 'ansibleCollectionSources',
    },
    {
        id: 'creator',
        label: 'Creator',
        group: 'content',
        sourceView: 'ansibleCreator',
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
        id: 'settings',
        label: 'Settings',
        group: 'home',
        sourceView: 'navitaSettings',
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

/** Interpreter navita runs Ansible commands in. */
export interface EnvironmentSummary {
    readonly name: string;
    readonly pythonPath: string;
    readonly version?: string;
}

/**
 * How the playbook run action executes a playbook.
 *
 * `ansible-navigator` runs inside an execution environment, which is what the
 * extension defaults to; `ansible-playbook` uses the active Python environment.
 */
export type PlaybookExecutor = 'ansible-navigator' | 'ansible-playbook';

/** Preferences the Settings pages edit and the main process acts on. */
export interface AppSettings {
    /** GitHub organizations Collection Sources scans. */
    readonly githubOrgs: readonly string[];
    /** Runner the playbook run action uses. */
    readonly playbookExecutor: PlaybookExecutor;
    /** ansible-navigator configuration file; empty means the default. */
    readonly navigatorConfig: string;
    /**
     * How to launch the user's terminal. `{command}` is required and `{dir}` is
     * optional; empty means detect a known terminal on PATH.
     */
    readonly terminal: string;
}

/** Settings a client may change; every field is optional. */
export type SettingsPatch = Partial<AppSettings>;

/** Where this build lives, for the About page. */
export interface AppAbout {
    readonly version: string;
    readonly installPath: string;
    readonly statePath: string;
}

export interface AppState {
    readonly workspace: WorkspaceEntry | null;
    readonly environment: EnvironmentSummary | null;
    readonly recents: readonly WorkspaceEntry[];
    readonly activeSection: SectionId;
    readonly mcp: McpStatus;
    readonly lsp: ServerStatus;
    readonly theme: ThemeId;
    readonly settings: AppSettings;
    /** Interpreter pinned for the open workspace, if the user pinned one. */
    readonly pinnedEnvironment: string | null;
    readonly about: AppAbout;
}

/** Actions the native menu can trigger, kept serializable for testability. */
export type MenuAction =
    | { readonly id: 'open-workspace' }
    | { readonly id: 'open-recent'; readonly path: string }
    | { readonly id: 'close-workspace' }
    | { readonly id: 'rescan-workspace' }
    | { readonly id: 'reveal-workspace' }
    | { readonly id: 'open-terminal' }
    | { readonly id: 'show-section'; readonly section: SectionId }
    | { readonly id: 'toggle-sidebar' }
    | { readonly id: 'back' }
    | { readonly id: 'copy-snippet'; readonly harness: HarnessId }
    | { readonly id: 'test-connection' }
    | { readonly id: 'set-theme'; readonly theme: ThemeId }
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

/** Outcome of installing ansible-dev-tools into the current interpreter. */
export interface DevToolsInstallResult {
    readonly state: 'ready' | 'error';
    readonly exitCode: number;
    /** Combined installer output; empty when the tool wrote nothing. */
    readonly output: string;
    /** Packages `adt` reported after the attempt. */
    readonly packageCount: number;
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
    /** Interpreter the user pinned for this workspace, or null for automatic. */
    readonly selection?: string | null;
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

/** One plugin type in a collection, with how many plugins it holds. */
export interface CollectionPluginType {
    /** Type as ansible-doc names it: `module`, `filter`, `lookup`, … */
    readonly type: string;
    readonly count: number;
}

export interface CollectionEntry {
    readonly name: string;
    readonly version: string;
    readonly description?: string;
    readonly path?: string;
    readonly pluginCount: number;
    /** Plugin types the collection ships, ordered by name. */
    readonly pluginTypes: readonly CollectionPluginType[];
}

/** Which process a log line came from. */
export type LogSource = 'app' | 'mcp' | 'lsp' | 'command';

/** Severity, inferred from the line for output navita does not control. */
export type LogLevel = 'info' | 'warn' | 'error';

/** One captured line. */
export interface LogEntry {
    readonly id: number;
    /** ISO timestamp, so the renderer can format it however it likes. */
    readonly time: string;
    readonly source: LogSource;
    readonly level: LogLevel;
    readonly message: string;
}

/** Everything the Logs page shows. */
export interface LogsResult {
    readonly entries: readonly LogEntry[];
    /** Rotating file the same lines are appended to. */
    readonly filePath: string;
    /** Lines dropped from the in-memory buffer since it last wrapped. */
    readonly dropped: number;
}

/** Python environment facts the Diagnostics page reports. */
export interface DiagnosticsPython {
    readonly envName?: string;
    readonly version?: string;
    readonly path?: string;
}

/** One tool row from `adt --version`. */
export interface DiagnosticsToolEntry {
    readonly name: string;
    readonly version: string;
}

/** Status of a bundled service, in the vocabulary the shared view renders. */
export interface DiagnosticsServiceEntry {
    readonly name: string;
    readonly status: 'running' | 'stopped' | 'configured' | 'not configured';
}

/** A terminal navita knows how to drive, and whether it is installed. */
export interface TerminalCandidate {
    readonly bin: string;
    /** Template with `{dir}` and `{command}` placeholders. */
    readonly template: string;
    readonly detected: boolean;
}

/** What the Terminal settings page needs to describe the current choice. */
export interface TerminalInfo {
    /** Stored setting; empty means automatic detection. */
    readonly setting: string;
    /** Template that will be used, or null when nothing usable was found. */
    readonly template: string | null;
    readonly candidates: readonly TerminalCandidate[];
}

/** Outcome of asking navita to open a terminal. */
export interface TerminalOpenResult {
    readonly state: 'ready' | 'error';
    /** Command line handed to the shell; shown so a failure is reproducible. */
    readonly command: string;
    readonly detail?: string;
}

/**
 * Everything the Diagnostics page shows.
 *
 * Structurally identical to `DiagnosticsData` in `@ansible/ui`, which the main
 * process cannot resolve; the renderer hands this payload straight to the view.
 */
export interface DiagnosticsPayload {
    readonly workspacePath?: string;
    readonly python: DiagnosticsPython;
    readonly ansible: { readonly version?: string };
    readonly services: readonly DiagnosticsServiceEntry[];
    readonly tools: readonly DiagnosticsToolEntry[];
}

/** Source labels, in the order the filter offers them. */
export const LOG_SOURCES: readonly { readonly id: LogSource; readonly label: string }[] = [
    { id: 'app', label: 'App' },
    { id: 'mcp', label: 'MCP server' },
    { id: 'lsp', label: 'Language server' },
    { id: 'command', label: 'Commands' },
];

/** Outcome of installing one collection into the active environment. */
export interface CollectionInstallResult {
    readonly state: 'ready' | 'error';
    /** Command output, or the reason the install failed. */
    readonly detail?: string;
    /** Version the environment reports once the install has finished. */
    readonly installedVersion?: string;
}

export interface CollectionsResult {
    readonly state: 'ready' | 'error';
    readonly collections: readonly CollectionEntry[];
    readonly detail?: string;
}

/** One plugin inside a collection. */
export interface PluginEntry {
    /** Short name, as `copy`. */
    readonly name: string;
    /** Fully qualified name, as `ansible.builtin.copy`. */
    readonly fullName: string;
    readonly shortDescription: string;
    /** AI explanation prompt for this plugin. */
    readonly prompt: string;
}

export interface CollectionPluginsResult {
    readonly state: 'ready' | 'error';
    readonly plugins: readonly PluginEntry[];
    readonly detail?: string;
}

/** A collection as a source knows it, which is what the documentation caches take. */
export interface SourceCollectionRef {
    /** Where the collection was found. */
    readonly kind: 'galaxy' | 'scm';
    readonly namespace: string;
    readonly name: string;
    readonly version: string;
    /** Repository full name, as `org/repo`; used when kind is `scm`. */
    readonly repository?: string;
}

/** One plugin type in a source collection, with its plugins. */
export interface SourcePluginType {
    readonly type: string;
    readonly plugins: readonly PluginEntry[];
}

export interface SourcePluginsResult {
    readonly state: 'ready' | 'error';
    readonly types: readonly SourcePluginType[];
    readonly detail?: string;
}

/**
 * Documentation for one plugin.
 *
 * `data` is the `PluginData` payload from `@ansible/ui` — the shared doc view
 * consumes it directly. It is typed `unknown` here because this contract is
 * also compiled by the main process, which does not resolve that package.
 */
export interface PluginDocResult {
    readonly state: 'ready' | 'error';
    readonly data?: unknown;
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

/** A package inside an image, as the introspection script reports it. */
export interface PackageEntry {
    readonly name: string;
    readonly version: string;
}

/**
 * A Python distribution.
 *
 * The introspection script reads the whole `pip` metadata file, so these fields
 * are already in the payload; they are optional because only Python entries
 * carry them.
 */
export interface PythonPackageEntry extends PackageEntry {
    readonly summary?: string;
    readonly 'home-page'?: string;
    readonly author?: string;
    readonly 'author-email'?: string;
    readonly license?: string;
    readonly location?: string;
    readonly requires?: readonly string[];
    readonly 'required-by'?: readonly string[];
}

/**
 * A system (rpm) package.
 *
 * `version` is the full version-release string. The remaining fields mirror the
 * rpm query and arrive only when the package reports them.
 */
export interface SystemPackageEntry extends PackageEntry {
    readonly architecture?: string;
    readonly summary?: string;
    readonly description?: string;
    readonly license?: string;
    readonly size?: string;
    readonly vendor?: string;
    readonly packager?: string;
    readonly url?: string;
    readonly group?: string;
}

/** Everything navita shows for one execution environment. */
export interface ExecutionEnvironmentDetails {
    readonly fullName: string;
    readonly imageId?: string;
    readonly created?: string;
    readonly info: {
        readonly ansible?: string;
        readonly os?: string;
        readonly image?: string;
    };
    readonly collections: readonly PackageEntry[];
    readonly pythonPackages: readonly PythonPackageEntry[];
    readonly systemPackages: readonly SystemPackageEntry[];
}

export interface ExecutionEnvironmentDetailsResult {
    readonly state: 'ready' | 'error';
    readonly details?: ExecutionEnvironmentDetails;
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
    /** Raw `ansible-creator schema` tree, used to render the dynamic form. */
    readonly schema?: SchemaNode | null;
    readonly detail?: string;
}

/** Sent when a creator command starts, so the form can show what is running. */
export interface CreatorStartedEvent {
    readonly command: string;
}

/** Sent when a creator command exits, with its combined output. */
export interface CreatorFinishedEvent {
    readonly exitCode: number;
    readonly output: string;
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

/** One collection discovered in a GitHub organization. */
export interface GitHubCollectionEntry {
    /** Fully qualified name, as `namespace.name`. */
    readonly name: string;
    readonly version: string;
    readonly description: string;
    readonly repository: string;
    readonly htmlUrl: string;
    /** `git+https://…` spec `ade install` accepts for this collection. */
    readonly installUrl: string;
    /** AI summary prompt for this collection. */
    readonly prompt: string;
}

/** Cached collections for one GitHub organization. */
export interface GitHubOrgSource {
    readonly org: string;
    readonly count: number;
    readonly lastUpdated?: string;
    /** Collections in the cache; empty until the org has been scanned once. */
    readonly collections: readonly GitHubCollectionEntry[];
    /** True while a scan is running, so the view can poll instead of guessing. */
    readonly refreshing: boolean;
    /** Why the last scan failed, when it did. */
    readonly error?: string;
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
    setTheme(theme: ThemeId): Promise<AppState>;
    updateSettings(patch: SettingsPatch): Promise<AppState>;
    clearRecents(): Promise<AppState>;
    removeRecent(workspacePath: string): Promise<AppState>;
    /**
     * Install a collection spec.
     * @param spec - FQCN, `fqcn:version`, or `git+https://…` repository URL.
     * @param version - Catalog version, when the row named one.
     * @param lookupName - FQCN to report the version for when spec is a URL.
     */
    installCollection(
        spec: string,
        version?: string,
        lookupName?: string,
    ): Promise<CollectionInstallResult>;
    getTerminalInfo(): Promise<TerminalInfo>;
    openTerminal(): Promise<TerminalOpenResult>;
    getDiagnostics(): Promise<DiagnosticsPayload>;
    upgradeDevTools(): Promise<DevToolsInstallResult>;
    getLogs(): Promise<LogsResult>;
    clearLogs(): Promise<LogsResult>;
    onLogsChanged(listener: (logs: LogsResult) => void): () => void;
    getDevTools(): Promise<DevToolsResult>;
    installDevTools(): Promise<DevToolsInstallResult>;
    getEnvironments(workspacePath: string | null): Promise<EnvironmentGroupsResult>;
    selectEnvironment(pythonPath: string | null): Promise<AppState>;
    getTools(): Promise<ToolsResult>;
    getSkills(): Promise<SkillsResult>;
    copyText(text: string): Promise<void>;
    getCollections(): Promise<CollectionsResult>;
    getCollectionPlugins(collection: string, pluginType: string): Promise<CollectionPluginsResult>;
    getSourcePlugins(source: SourceCollectionRef): Promise<SourcePluginsResult>;
    getSourcePluginDoc(
        source: SourceCollectionRef,
        fqcn: string,
        pluginType: string,
    ): Promise<PluginDocResult>;
    getPluginDoc(fqcn: string, pluginType: string): Promise<PluginDocResult>;
    getExecutionEnvironments(): Promise<ExecutionEnvironmentsResult>;
    getExecutionEnvironmentDetails(fullName: string): Promise<ExecutionEnvironmentDetailsResult>;
    getPlaybooks(workspacePath: string | null): Promise<PlaybooksResult>;
    getCreator(): Promise<CreatorResult>;
    runCreator(path: readonly string[], values: Record<string, unknown>): Promise<void>;
    onCreatorStarted(listener: (event: CreatorStartedEvent) => void): () => void;
    onCreatorFinished(listener: (event: CreatorFinishedEvent) => void): () => void;
    openPath(target: string): Promise<void>;
    onNavigateBack(listener: () => void): () => void;
    onSectionRequested(listener: (section: SectionId) => void): () => void;
    getCollectionSources(): Promise<CollectionSourcesResult>;
    refreshCollectionSource(org: string): Promise<CollectionSourcesResult>;
    onStateChanged(listener: (state: AppState) => void): () => void;
    onToggleSidebar(listener: () => void): () => void;
}
