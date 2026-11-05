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
    type DevToolsResult,
    type CollectionsResult,
    type EnvironmentGroupsResult,
    type ExecutionEnvironmentsResult,
    type PlaybooksResult,
    type CreatorResult,
    type CollectionSourcesResult,
    type SkillsResult,
    type ToolsResult,
    type CreatorFinishedEvent,
    type CreatorStartedEvent,
    type HarnessId,
    type NavitaBridge,
    type SectionId,
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
    getDevTools: () => ipcRenderer.invoke(IPC.getDevTools) as Promise<DevToolsResult>,
    getEnvironments: (workspacePath: string | null) =>
        ipcRenderer.invoke(IPC.getEnvironments, workspacePath) as Promise<EnvironmentGroupsResult>,
    selectEnvironment: (pythonPath: string | null) =>
        ipcRenderer.invoke(IPC.selectEnvironment, pythonPath) as Promise<AppState>,
    getTools: () => ipcRenderer.invoke(IPC.getTools) as Promise<ToolsResult>,
    getSkills: () => ipcRenderer.invoke(IPC.getSkills) as Promise<SkillsResult>,
    copyText: (text: string) => ipcRenderer.invoke(IPC.copyText, text) as Promise<void>,
    getCollections: () => ipcRenderer.invoke(IPC.getCollections) as Promise<CollectionsResult>,
    getExecutionEnvironments: () =>
        ipcRenderer.invoke(IPC.getExecutionEnvironments) as Promise<ExecutionEnvironmentsResult>,
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
    getCollectionSources: () =>
        ipcRenderer.invoke(IPC.getCollectionSources) as Promise<CollectionSourcesResult>,
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
