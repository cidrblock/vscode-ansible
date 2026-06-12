/**
 * Shared types for the IPC contract between Electron main and renderer processes.
 * Both sides import these — they must remain free of Node.js and DOM dependencies.
 */

export interface EnvironmentInfo {
    pythonPath: string | null;
    displayName: string | null;
    binDir: string | null;
    workspaceRoot: string | null;
}

export interface DiscoveredEnv {
    pythonPath: string;
    version: string;
    displayName: string;
    source: 'venv' | 'conda' | 'pyenv' | 'system';
    envPath: string;
}

export interface PlaybookConfig {
    extraVars?: Record<string, string>;
    limit?: string;
    tags?: string;
    skipTags?: string;
    verbosity?: number;
    check?: boolean;
    diff?: boolean;
}

export interface ProgressEvent {
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
}

export interface PlaybookInfo {
    path: string;
    name: string;
    relativePath: string;
}

export interface SearchResult {
    collection: string;
    pluginType: string;
    pluginName: string;
}

export interface ProjectEntry {
    path: string;
    name: string;
    lastOpened: number;
}

export interface GalaxyCollectionInfo {
    name: string;
    version: string;
    description?: string;
}

export interface GitHubCollectionInfo {
    name: string;
    full_name?: string;
    description?: string;
    default_branch?: string;
}

export interface EEInfo {
    name: string;
    tag?: string;
    id?: string;
}

export interface EEDetailInfo {
    ansibleVersion: string | null;
    osRelease: string | null;
    imageName: string | null;
    collections: Array<{ name: string; version: string }>;
    pythonPackages: Array<{ name: string; version: string; summary?: string }>;
    systemPackages: Array<{ name: string; version: string }>;
}

export interface CreatorCommand {
    name: string;
    label: string;
    description?: string;
    parameters: CreatorParameter[];
}

export interface CreatorParameter {
    name: string;
    description?: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    choices?: string[];
}

export interface McpToolInfo {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
}

export type ColorScheme = 'light' | 'dark' | 'auto';

export interface NavitaSettings {
    colorScheme: ColorScheme;
    pythonPath: string | null;
    githubOrgs: string[];
    llmProvider: string | null;
    llmModel: string | null;
    mcpAutoStart: boolean;
    mcpTransport: 'stdio' | 'socket' | 'sse';
    mcpPort: number | null;
    mcpSocketPath: string | null;
    mcpExposedTools: string[];
    lspAutoStart: boolean;
    lspBinaryPath: string | null;
    controllerUrl: string | null;
    enableChat: boolean;
    abbenayAutoConnect: boolean;
    abbenayModel: string | null;
}

// ---------------------------------------------------------------------------
// Abbenay AI types
// ---------------------------------------------------------------------------

export type AbbenayConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AbbenayStatus {
    state: AbbenayConnectionState;
    version?: string;
    connectedClients?: number;
    error?: string;
}

export interface AbbenayModelInfo {
    id: string;
    provider: string;
    name: string;
    engine: string;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    name?: string;
}

export interface ChatChunkData {
    requestId: string;
    type: 'text' | 'tool_call' | 'tool_result' | 'usage' | 'error' | 'done';
    text?: string;
    toolName?: string;
    toolArgs?: string;
    toolCallId?: string;
    toolContent?: string;
    toolIsError?: boolean;
    errorCode?: string;
    errorMessage?: string;
    finishReason?: string;
    promptTokens?: number;
    completionTokens?: number;
}

export interface SessionInfo {
    id: string;
    model: string;
    topic: string;
    messageCount: number;
    updatedAt: string;
}

export interface McpConfigSnippet {
    format: 'claude' | 'cursor' | 'generic';
    config: string;
}

export interface ServiceStatus {
    mcp: { running: boolean; toolCount: number; transport: string };
    lsp: { running: boolean; pid: number | null };
}

export const IPC_CHANNELS = {
    // Collections
    GET_COLLECTIONS: 'navita:get-collections',
    GET_PLUGINS: 'navita:get-plugins',
    GET_PLUGIN_DOC: 'navita:get-plugin-doc',
    SEARCH_PLUGINS: 'navita:search-plugins',
    REFRESH_COLLECTIONS: 'navita:refresh-collections',

    // Collection sources
    SEARCH_GALAXY_COLLECTIONS: 'navita:search-galaxy-collections',
    SEARCH_GITHUB_COLLECTIONS: 'navita:search-github-collections',
    INSTALL_COLLECTION: 'navita:install-collection',

    // Playbook execution
    GET_PLAYBOOKS: 'navita:get-playbooks',
    RUN_PLAYBOOK: 'navita:run-playbook',
    STOP_PLAYBOOK: 'navita:stop-playbook',
    PLAYBOOK_EVENT: 'navita:playbook-event',
    PLAYBOOK_COMPLETE: 'navita:playbook-complete',

    // Environment
    GET_ENVIRONMENT_INFO: 'navita:get-environment-info',
    GET_DEVTOOLS_PACKAGES: 'navita:get-devtools-packages',
    DISCOVER_ENVIRONMENTS: 'navita:discover-environments',
    SELECT_ENVIRONMENT: 'navita:select-environment',

    // Execution environments
    LIST_EXECUTION_ENVIRONMENTS: 'navita:list-execution-environments',
    GET_EE_DETAILS: 'navita:get-ee-details',

    // Creator
    GET_CREATOR_COMMANDS: 'navita:get-creator-commands',
    RUN_CREATOR_COMMAND: 'navita:run-creator-command',

    // MCP
    GET_MCP_TOOLS: 'navita:get-mcp-tools',
    CALL_MCP_TOOL: 'navita:call-mcp-tool',
    GET_MCP_STATUS: 'navita:get-mcp-status',
    RESTART_MCP: 'navita:restart-mcp',
    GET_MCP_CONFIG_SNIPPET: 'navita:get-mcp-config-snippet',

    // LSP
    GET_LSP_STATUS: 'navita:get-lsp-status',
    RESTART_LSP: 'navita:restart-lsp',

    // Combined service status
    GET_SERVICE_STATUS: 'navita:get-service-status',

    // Settings
    GET_SETTINGS: 'navita:get-settings',
    SAVE_SETTINGS: 'navita:save-settings',

    // Workspace / Projects
    GET_WORKSPACE: 'navita:get-workspace',
    GET_RECENT_PROJECTS: 'navita:get-recent-projects',
    ADD_PROJECT: 'navita:add-project',
    SWITCH_PROJECT: 'navita:switch-project',
    REMOVE_PROJECT: 'navita:remove-project',

    // Window controls
    WINDOW_MINIMIZE: 'navita:window-minimize',
    WINDOW_MAXIMIZE: 'navita:window-maximize',
    WINDOW_CLOSE: 'navita:window-close',
    WINDOW_IS_MAXIMIZED: 'navita:window-is-maximized',

    // Abbenay AI
    ABBENAY_CONNECT: 'navita:abbenay-connect',
    ABBENAY_DISCONNECT: 'navita:abbenay-disconnect',
    ABBENAY_STATUS: 'navita:abbenay-status',
    ABBENAY_LIST_MODELS: 'navita:abbenay-list-models',
    ABBENAY_CHAT: 'navita:abbenay-chat',
    ABBENAY_CHAT_CHUNK: 'navita:abbenay-chat-chunk',
    ABBENAY_SESSION_CHAT: 'navita:abbenay-session-chat',
    ABBENAY_CREATE_SESSION: 'navita:abbenay-create-session',
    ABBENAY_LIST_SESSIONS: 'navita:abbenay-list-sessions',
    ABBENAY_DELETE_SESSION: 'navita:abbenay-delete-session',
    ABBENAY_START_WEB_UI: 'navita:abbenay-start-web-ui',
} as const;
