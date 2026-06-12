import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';
import type {
    EnvironmentInfo,
    DiscoveredEnv,
    PlaybookConfig,
    PlaybookInfo,
    ProgressEvent,
    SearchResult,
    ProjectEntry,
    GalaxyCollectionInfo,
    GitHubCollectionInfo,
    EEInfo,
    EEDetailInfo,
    CreatorCommand,
    McpToolInfo,
    McpConfigSnippet,
    ServiceStatus,
    NavitaSettings,
    AbbenayStatus,
    AbbenayModelInfo,
    ChatChunkData,
    SessionInfo,
} from '../shared/types';

export interface NavitaAPI {
    // Collections
    getCollections(): Promise<Array<{ name: string; version: string; path: string }>>;
    getPlugins(collection: string, pluginType: string): Promise<Array<{ name: string; description?: string }>>;
    getPluginDoc(pluginName: string, pluginType: string): Promise<Record<string, unknown> | null>;
    searchPlugins(query: string): Promise<SearchResult[]>;
    refreshCollections(): Promise<void>;

    // Collection sources
    searchGalaxyCollections(query: string): Promise<GalaxyCollectionInfo[]>;
    searchGitHubCollections(query: string): Promise<GitHubCollectionInfo[]>;
    installCollection(name: string): Promise<string>;

    // Playbook execution
    getPlaybooks(): Promise<PlaybookInfo[]>;
    runPlaybook(playbookPath: string, config: PlaybookConfig): Promise<void>;
    stopPlaybook(): Promise<void>;
    onPlaybookEvent(callback: (event: ProgressEvent) => void): () => void;
    onPlaybookComplete(callback: () => void): () => void;

    // Environment
    getEnvironmentInfo(): Promise<EnvironmentInfo>;
    getDevToolsPackages(): Promise<Array<{ name: string; version: string }>>;
    discoverEnvironments(): Promise<DiscoveredEnv[]>;
    selectEnvironment(env: DiscoveredEnv): Promise<void>;

    // Execution environments
    listExecutionEnvironments(): Promise<EEInfo[]>;
    getEEDetails(eeName: string): Promise<EEDetailInfo>;

    // Creator
    getCreatorCommands(): Promise<CreatorCommand[]>;
    runCreatorCommand(commandName: string, params: Record<string, string>): Promise<string>;

    // MCP
    getMcpTools(): Promise<McpToolInfo[]>;
    callMcpTool(toolName: string, args: Record<string, unknown>): Promise<string>;
    getMcpStatus(): Promise<{ running: boolean; toolCount: number }>;
    restartMcp(): Promise<void>;
    getMcpConfigSnippet(format: string): Promise<McpConfigSnippet>;

    // LSP
    getLspStatus(): Promise<{ running: boolean }>;
    restartLsp(): Promise<void>;

    // Combined service status
    getServiceStatus(): Promise<ServiceStatus>;

    // Settings
    getSettings(): Promise<NavitaSettings>;
    saveSettings(settings: NavitaSettings): Promise<void>;

    // Projects
    getRecentProjects(): Promise<ProjectEntry[]>;
    addProject(): Promise<ProjectEntry | null>;
    switchProject(projectPath: string): Promise<void>;
    removeProject(projectPath: string): Promise<void>;
    getWorkspace(): Promise<string | null>;

    // Window controls
    windowMinimize(): Promise<void>;
    windowMaximize(): Promise<void>;
    windowClose(): Promise<void>;
    windowIsMaximized(): Promise<boolean>;

    // Abbenay AI
    abbenayConnect(): Promise<{ ok: boolean; error?: string }>;
    abbenayDisconnect(): Promise<{ ok: boolean }>;
    abbenayStatus(): Promise<AbbenayStatus>;
    abbenayListModels(): Promise<AbbenayModelInfo[]>;
    abbenayChat(messages: Array<{ role: string; content: string }>, model?: string): Promise<{ requestId: string; error?: string }>;
    abbenaySessionChat(sessionId: string, messages: Array<{ role: string; content: string }>, model?: string): Promise<{ requestId: string; error?: string }>;
    abbenayCreateSession(model: string, topic?: string): Promise<SessionInfo>;
    abbenayListSessions(): Promise<SessionInfo[]>;
    abbenayDeleteSession(sessionId: string): Promise<{ ok: boolean }>;
    abbenayOpenWebUI(): Promise<{ ok: boolean; url?: string; error?: string }>;
    onChatChunk(callback: (chunk: ChatChunkData) => void): () => void;
}

const navitaAPI: NavitaAPI = {
    // Collections
    getCollections: () => ipcRenderer.invoke(IPC_CHANNELS.GET_COLLECTIONS),
    getPlugins: (collection, pluginType) => ipcRenderer.invoke(IPC_CHANNELS.GET_PLUGINS, collection, pluginType),
    getPluginDoc: (pluginName, pluginType) => ipcRenderer.invoke(IPC_CHANNELS.GET_PLUGIN_DOC, pluginName, pluginType),
    searchPlugins: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_PLUGINS, query),
    refreshCollections: () => ipcRenderer.invoke(IPC_CHANNELS.REFRESH_COLLECTIONS),

    // Collection sources
    searchGalaxyCollections: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_GALAXY_COLLECTIONS, query),
    searchGitHubCollections: (query) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_GITHUB_COLLECTIONS, query),
    installCollection: (name) => ipcRenderer.invoke(IPC_CHANNELS.INSTALL_COLLECTION, name),

    // Playbook execution
    getPlaybooks: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PLAYBOOKS),
    runPlaybook: (playbookPath, config) => ipcRenderer.invoke(IPC_CHANNELS.RUN_PLAYBOOK, playbookPath, config),
    stopPlaybook: () => ipcRenderer.invoke(IPC_CHANNELS.STOP_PLAYBOOK),
    onPlaybookEvent: (callback) => {
        const listener = (_event: Electron.IpcRendererEvent, data: ProgressEvent) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.PLAYBOOK_EVENT, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.PLAYBOOK_EVENT, listener); };
    },
    onPlaybookComplete: (callback) => {
        const listener = () => callback();
        ipcRenderer.on(IPC_CHANNELS.PLAYBOOK_COMPLETE, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.PLAYBOOK_COMPLETE, listener); };
    },

    // Environment
    getEnvironmentInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ENVIRONMENT_INFO),
    getDevToolsPackages: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DEVTOOLS_PACKAGES),
    discoverEnvironments: () => ipcRenderer.invoke(IPC_CHANNELS.DISCOVER_ENVIRONMENTS),
    selectEnvironment: (env) => ipcRenderer.invoke(IPC_CHANNELS.SELECT_ENVIRONMENT, env),

    // Execution environments
    listExecutionEnvironments: () => ipcRenderer.invoke(IPC_CHANNELS.LIST_EXECUTION_ENVIRONMENTS),
    getEEDetails: (eeName) => ipcRenderer.invoke(IPC_CHANNELS.GET_EE_DETAILS, eeName),

    // Creator
    getCreatorCommands: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CREATOR_COMMANDS),
    runCreatorCommand: (commandName, params) => ipcRenderer.invoke(IPC_CHANNELS.RUN_CREATOR_COMMAND, commandName, params),

    // MCP
    getMcpTools: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MCP_TOOLS),
    callMcpTool: (toolName, args) => ipcRenderer.invoke(IPC_CHANNELS.CALL_MCP_TOOL, toolName, args),
    getMcpStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_MCP_STATUS),
    restartMcp: () => ipcRenderer.invoke(IPC_CHANNELS.RESTART_MCP),
    getMcpConfigSnippet: (format) => ipcRenderer.invoke(IPC_CHANNELS.GET_MCP_CONFIG_SNIPPET, format),

    // LSP
    getLspStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_LSP_STATUS),
    restartLsp: () => ipcRenderer.invoke(IPC_CHANNELS.RESTART_LSP),

    // Combined service status
    getServiceStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SERVICE_STATUS),

    // Settings
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
    saveSettings: (settings) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

    // Projects
    getRecentProjects: () => ipcRenderer.invoke(IPC_CHANNELS.GET_RECENT_PROJECTS),
    addProject: () => ipcRenderer.invoke(IPC_CHANNELS.ADD_PROJECT),
    switchProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.SWITCH_PROJECT, projectPath),
    removeProject: (projectPath) => ipcRenderer.invoke(IPC_CHANNELS.REMOVE_PROJECT, projectPath),
    getWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.GET_WORKSPACE),

    // Window controls
    windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    windowIsMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),

    // Abbenay AI
    abbenayConnect: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_CONNECT),
    abbenayDisconnect: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_DISCONNECT),
    abbenayStatus: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_STATUS),
    abbenayListModels: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_LIST_MODELS),
    abbenayChat: (messages, model) => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_CHAT, messages, model),
    abbenaySessionChat: (sessionId, messages, model) => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_SESSION_CHAT, sessionId, messages, model),
    abbenayCreateSession: (model, topic) => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_CREATE_SESSION, model, topic),
    abbenayListSessions: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_LIST_SESSIONS),
    abbenayDeleteSession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_DELETE_SESSION, sessionId),
    abbenayOpenWebUI: () => ipcRenderer.invoke(IPC_CHANNELS.ABBENAY_START_WEB_UI),
    onChatChunk: (callback) => {
        const listener = (_event: Electron.IpcRendererEvent, data: ChatChunkData) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, listener);
        return () => { ipcRenderer.removeListener(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, listener); };
    },
};

contextBridge.exposeInMainWorld('navitaAPI', navitaAPI);
