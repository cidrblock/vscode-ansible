/**
 * Preload bridge: the only surface the renderer gets.
 *
 * Everything is an explicit method so the renderer never touches ipcRenderer
 * directly and node integration can stay off.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import {
    IPC,
    type AppState,
    type CollectionInstallResult,
    type DevToolsInstallResult,
    type DevToolsResult,
    type CollectionPluginsResult,
    type CollectionsResult,
    type PluginDocResult,
    type SourceCollectionRef,
    type SourcePluginsResult,
    type EnvironmentGroupsResult,
    type ExecutionEnvironmentDetailsResult,
    type ExecutionEnvironmentsResult,
    type PlaybooksResult,
    type CreatorResult,
    type CollectionSourcesResult,
    type DiagnosticsPayload,
    type TerminalInfo,
    type TerminalOpenResult,
    type LogsResult,
    type SkillsResult,
    type ToolsResult,
    type CreatorFinishedEvent,
    type CreatorStartedEvent,
    type HarnessId,
    type NavitaBridge,
    type SectionId,
    type ThemeId,
} from '../shared/ipc';

const bridge: NavitaBridge = {
    getState: () => ipcRenderer.invoke(IPC.getState) as Promise<AppState>,
    openWorkspace: () => ipcRenderer.invoke(IPC.openWorkspace) as Promise<AppState>,
    activateWorkspace: (workspacePath: string) =>
        ipcRenderer.invoke(IPC.activateWorkspace, workspacePath) as Promise<AppState>,
    closeWorkspace: () => ipcRenderer.invoke(IPC.closeWorkspace) as Promise<AppState>,
    showSection: (section: SectionId) =>
        ipcRenderer.invoke(IPC.showSection, section) as Promise<AppState>,
    rescanWorkspace: () => ipcRenderer.invoke(IPC.rescanWorkspace) as Promise<AppState>,
    copySnippet: (harness: HarnessId) =>
        ipcRenderer.invoke(IPC.copySnippet, harness) as Promise<string>,
    testConnection: () => ipcRenderer.invoke(IPC.testConnection) as Promise<AppState>,
    setTheme: (theme: ThemeId) => ipcRenderer.invoke(IPC.setTheme, theme) as Promise<AppState>,
    updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch) as Promise<AppState>,
    clearRecents: () => ipcRenderer.invoke(IPC.clearRecents) as Promise<AppState>,
    removeRecent: (workspacePath: string) =>
        ipcRenderer.invoke(IPC.removeRecent, workspacePath) as Promise<AppState>,
    installCollection: (spec: string, version?: string, lookupName?: string) =>
        ipcRenderer.invoke(
            IPC.installCollection,
            spec,
            version,
            lookupName,
        ) as Promise<CollectionInstallResult>,
    getDevTools: () => ipcRenderer.invoke(IPC.getDevTools) as Promise<DevToolsResult>,
    installDevTools: () =>
        ipcRenderer.invoke(IPC.installDevTools) as Promise<DevToolsInstallResult>,
    getEnvironments: (workspacePath: string | null) =>
        ipcRenderer.invoke(IPC.getEnvironments, workspacePath) as Promise<EnvironmentGroupsResult>,
    selectEnvironment: (pythonPath: string | null) =>
        ipcRenderer.invoke(IPC.selectEnvironment, pythonPath) as Promise<AppState>,
    getTools: () => ipcRenderer.invoke(IPC.getTools) as Promise<ToolsResult>,
    getSkills: () => ipcRenderer.invoke(IPC.getSkills) as Promise<SkillsResult>,
    copyText: (text: string) => ipcRenderer.invoke(IPC.copyText, text) as Promise<void>,
    getCollections: () => ipcRenderer.invoke(IPC.getCollections) as Promise<CollectionsResult>,
    getCollectionPlugins: (collection: string, pluginType: string) =>
        ipcRenderer.invoke(
            IPC.getCollectionPlugins,
            collection,
            pluginType,
        ) as Promise<CollectionPluginsResult>,
    getPluginDoc: (fqcn: string, pluginType: string) =>
        ipcRenderer.invoke(IPC.getPluginDoc, fqcn, pluginType) as Promise<PluginDocResult>,
    getSourcePlugins: (source: SourceCollectionRef) =>
        ipcRenderer.invoke(IPC.getSourcePlugins, source) as Promise<SourcePluginsResult>,
    getSourcePluginDoc: (source: SourceCollectionRef, fqcn: string, pluginType: string) =>
        ipcRenderer.invoke(
            IPC.getSourcePluginDoc,
            source,
            fqcn,
            pluginType,
        ) as Promise<PluginDocResult>,
    getExecutionEnvironments: () =>
        ipcRenderer.invoke(IPC.getExecutionEnvironments) as Promise<ExecutionEnvironmentsResult>,
    getExecutionEnvironmentDetails: (fullName: string) =>
        ipcRenderer.invoke(
            IPC.getExecutionEnvironmentDetails,
            fullName,
        ) as Promise<ExecutionEnvironmentDetailsResult>,
    getPlaybooks: (workspacePath: string | null) =>
        ipcRenderer.invoke(IPC.getPlaybooks, workspacePath) as Promise<PlaybooksResult>,
    getCreator: () => ipcRenderer.invoke(IPC.getCreator) as Promise<CreatorResult>,
    runCreator: (path: readonly string[], values: Record<string, unknown>) =>
        ipcRenderer.invoke(IPC.runCreator, { path, values }) as Promise<void>,
    onCreatorStarted: (listener: (event: CreatorStartedEvent) => void) => {
        const handler = (_event: IpcRendererEvent, payload: CreatorStartedEvent): void => {
            listener(payload);
        };
        ipcRenderer.on(IPC.creatorStarted, handler);
        return () => {
            ipcRenderer.removeListener(IPC.creatorStarted, handler);
        };
    },
    onCreatorFinished: (listener: (event: CreatorFinishedEvent) => void) => {
        const handler = (_event: IpcRendererEvent, payload: CreatorFinishedEvent): void => {
            listener(payload);
        };
        ipcRenderer.on(IPC.creatorFinished, handler);
        return () => {
            ipcRenderer.removeListener(IPC.creatorFinished, handler);
        };
    },
    openPath: (target: string) => ipcRenderer.invoke(IPC.openPath, target) as Promise<void>,
    onNavigateBack: (listener: () => void) => {
        const handler = (): void => {
            listener();
        };
        ipcRenderer.on(IPC.navigateBack, handler);
        return () => {
            ipcRenderer.removeListener(IPC.navigateBack, handler);
        };
    },
    onSectionRequested: (listener: (section: SectionId) => void) => {
        const handler = (_event: IpcRendererEvent, section: SectionId): void => {
            listener(section);
        };
        ipcRenderer.on(IPC.sectionRequested, handler);
        return () => {
            ipcRenderer.removeListener(IPC.sectionRequested, handler);
        };
    },
    getTerminalInfo: () => ipcRenderer.invoke(IPC.getTerminalInfo) as Promise<TerminalInfo>,
    openTerminal: () => ipcRenderer.invoke(IPC.openTerminal) as Promise<TerminalOpenResult>,
    getDiagnostics: () => ipcRenderer.invoke(IPC.getDiagnostics) as Promise<DiagnosticsPayload>,
    upgradeDevTools: () =>
        ipcRenderer.invoke(IPC.upgradeDevTools) as Promise<DevToolsInstallResult>,
    getLogs: () => ipcRenderer.invoke(IPC.getLogs) as Promise<LogsResult>,
    clearLogs: () => ipcRenderer.invoke(IPC.clearLogs) as Promise<LogsResult>,
    onLogsChanged: (listener: (logs: LogsResult) => void) => {
        const handler = (_event: IpcRendererEvent, logs: LogsResult): void => {
            listener(logs);
        };
        ipcRenderer.on(IPC.logsChanged, handler);
        return () => {
            ipcRenderer.removeListener(IPC.logsChanged, handler);
        };
    },
    getCollectionSources: () =>
        ipcRenderer.invoke(IPC.getCollectionSources) as Promise<CollectionSourcesResult>,
    refreshCollectionSource: (org: string) =>
        ipcRenderer.invoke(IPC.refreshCollectionSource, org) as Promise<CollectionSourcesResult>,
    onStateChanged: (listener: (state: AppState) => void) => {
        const handler = (_event: IpcRendererEvent, state: AppState): void => {
            listener(state);
        };
        ipcRenderer.on(IPC.stateChanged, handler);
        return () => {
            ipcRenderer.removeListener(IPC.stateChanged, handler);
        };
    },
    onToggleSidebar: (listener: () => void) => {
        const handler = (): void => {
            listener();
        };
        ipcRenderer.on(IPC.toggleSidebar, handler);
        return () => {
            ipcRenderer.removeListener(IPC.toggleSidebar, handler);
        };
    },
};

contextBridge.exposeInMainWorld('navita', bridge);
