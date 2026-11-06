/**
 * navita main process.
 *
 * Owns the window, the native menu, the workspace picker and the two stdio
 * servers navita ships. The renderer only ever talks to this process through
 * the preload bridge, so all filesystem and process work stays here.
 */

import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import { buildCommandArgs, CommandService, CreatorService } from '@ansible/developer-services';
import { setLogFunction } from '@ansible/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    IPC,
    type AppState,
    type HarnessId,
    type EnvironmentSummary,
    type LogsResult,
    type McpStatus,
    type SectionId,
    type ServerStatus,
    type SourceCollectionRef,
    type ThemeId,
    type WorkspaceEntry,
} from '../shared/ipc';
import { buildMenuTemplate, type MenuContext, type MenuItemSpec } from './menu';
import { loadDevTools } from './devtools';
import { gatherDiagnostics } from './diagnostics';
import { installDevTools, upgradeDevTools } from './installer';
import {
    installEnvironmentResolver,
    resetEnvironmentCache,
    resolveBinDir,
    resolveEnvironment,
    summarizeEnvironment,
} from './environment';
import { loadEnvironments } from './environments';
import {
    installCollection,
    loadCollectionPlugins,
    loadCollections,
    loadPluginDoc,
} from './collections';
import { loadSourcePluginDoc, loadSourcePlugins } from './sourceCollections';
import {
    loadExecutionEnvironmentDetails,
    loadExecutionEnvironments,
} from './executionEnvironments';
import { loadPlaybooks } from './playbooks';
import { findSchemaNode, loadCreator } from './creator';
import { loadCollectionSources, refreshCollectionSource } from './collectionSources';
import { mergeSettings } from '../shared/settings';
import { loadSkills } from './skills';
import { invalidateToolCache, loadTools } from './tools';
import { probeServers, serverEnv, serverSpawnSpec, type SpawnSpec } from './servers';
import { buildSnippet } from './snippet';
import { isThemeId, StateStore, type PersistedState } from './store';
import { clearLogs, configureLogs, currentLogs, levelFor, logLines, onLogAppended } from './logs';
import { isDirectory, pushRecent, removeRecent, toWorkspaceEntry } from './workspaces';

const APP_NAME = 'navita';

/** What the Logs page reads before the recorder exists, and after a clear. */
const EMPTY_LOGS: LogsResult = { entries: [], filePath: '', dropped: 0 };

let mainWindow: BrowserWindow | null = null;
let store: StateStore;
let persisted: PersistedState;
let workspace: WorkspaceEntry | null = null;
let environment: EnvironmentSummary | null = null;
let mcpStatus: McpStatus = { state: 'stopped' };
let lspStatus: ServerStatus = { state: 'stopped' };

/**
 * Directory holding main/preload/renderer/servers, wherever the app was unpacked.
 * @returns Directory holding main, preload, renderer and servers.
 */
function distDir(): string {
    const candidates = [
        path.join(app.getAppPath(), 'dist'),
        path.join(process.cwd(), 'dist'),
        path.join(__dirname, '..'),
    ];
    const found = candidates.find((candidate) =>
        fs.existsSync(path.join(candidate, 'main', 'index.js')),
    );
    return found ?? candidates[0];
}

/**
 *
 * @returns Absolute paths to the bundled server entries and skills.
 */
function serverScripts(): { mcp: string; lsp: string; skills: string } {
    const dist = distDir();
    return {
        mcp: path.join(dist, 'servers', 'mcp-server.js'),
        lsp: path.join(dist, 'servers', 'language-server.js'),
        skills: path.join(dist, 'skills'),
    };
}

/**
 * Skills navita ships plus anything the user installed later.
 * @returns Skill directories the MCP server should load.
 */
function skillSources(): string[] {
    const sources = [serverScripts().skills];
    const userSkills = path.join(app.getPath('userData'), 'skills');
    if (fs.existsSync(userSkills)) {
        sources.push(userSkills);
    }
    return sources;
}

/**
 * Build the spawn specs for the two bundled servers.
 * @param workspacePath - Absolute workspace path handed to the server.
 * @param binDir - Python environment prepended to the servers' PATH.
 * @returns Spawn specs for the MCP server and the language server.
 */
function spawnSpecs(
    workspacePath: string,
    binDir: string | null = null,
): { mcp: SpawnSpec; lsp: SpawnSpec } {
    const scripts = serverScripts();
    const env = serverEnv(workspacePath, skillSources(), process.env, binDir);
    return {
        mcp: serverSpawnSpec(process.execPath, scripts.mcp, env),
        lsp: serverSpawnSpec(process.execPath, scripts.lsp, env, ['--stdio']),
    };
}

/**
 *
 * @returns State snapshot for the renderer and the menu.
 */
function currentState(): AppState {
    return {
        workspace,
        environment,
        recents: persisted.recents,
        activeSection: persisted.activeSection,
        mcp: mcpStatus,
        lsp: lspStatus,
        theme: persisted.theme,
        settings: persisted.settings,
        pinnedEnvironment:
            workspace === null ? null : (persisted.selectedEnvironments[workspace.path] ?? null),
        about: {
            version: app.getVersion(),
            installPath: app.getAppPath(),
            statePath: path.join(app.getPath('userData'), 'state.json'),
        },
    };
}

/**
 * Persist a theme choice and push it to the renderer and the menu.
 *
 * Persisting matters beyond restart: the menu's radio group is rebuilt from
 * the stored value, so the check mark survives a reload of the window.
 *
 * @param theme - Theme the user picked in the View menu or the UI.
 * @returns The state snapshot after the change.
 */
function setTheme(theme: ThemeId): AppState {
    persisted.theme = theme;
    store.save(persisted);
    broadcast();
    return currentState();
}

/**
 * Persist a settings patch and push it to the renderer and the menu.
 *
 * Validation lives in `mergeSettings`, so a malformed patch from the renderer
 * or a stale field from an older build cannot corrupt the state file.
 *
 * @param patch - Fields the renderer asked to change.
 * @returns The state snapshot after the change.
 */
function updateSettings(patch: unknown): AppState {
    persisted.settings = mergeSettings(persisted.settings, patch);
    store.save(persisted);
    broadcast();
    return currentState();
}

/** Pending debounce for log updates, so a chatty child cannot flood IPC. */
let logsTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Push the log buffer to the renderer, at most four times a second.
 *
 * The services log in bursts (a collection load prints hundreds of lines), and
 * the page filters locally, so it only needs the newest buffer.
 */
function scheduleLogsBroadcast(): void {
    if (logsTimer !== undefined) {
        return;
    }
    logsTimer = setTimeout(() => {
        logsTimer = undefined;
        const snapshot = currentLogs();
        if (snapshot !== undefined) {
            mainWindow?.webContents.send(IPC.logsChanged, snapshot);
        }
    }, 250);
}

/**
 *
 */
function broadcast(): void {
    mainWindow?.webContents.send(IPC.stateChanged, currentState());
    refreshMenu();
}

/**
 *
 */
function refreshMenu(): void {
    const context: MenuContext = {
        appName: APP_NAME,
        isMac: process.platform === 'darwin',
        hasWorkspace: workspace !== null,
        recents: persisted.recents,
        activeSection: persisted.activeSection,
        theme: persisted.theme,
    };
    const template = buildMenuTemplate(context).map(toElectronMenuItem);
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 *
 * @param item - Plain menu entry produced by the template builder.
 * @returns Electron menu item with a click handler bound.
 */
function toElectronMenuItem(item: MenuItemSpec): MenuItemConstructorOptions {
    const result: MenuItemConstructorOptions = {};
    if (item.label !== undefined) {
        result.label = item.label;
    }
    if (item.type !== undefined) {
        result.type = item.type;
    }
    if (item.role !== undefined) {
        result.role = item.role as MenuItemConstructorOptions['role'];
    }
    if (item.accelerator !== undefined) {
        result.accelerator = item.accelerator;
    }
    if (item.enabled !== undefined) {
        result.enabled = item.enabled;
    }
    if (item.checked !== undefined) {
        result.checked = item.checked;
    }
    if (item.submenu !== undefined) {
        result.submenu = item.submenu.map(toElectronMenuItem);
    }
    if (item.action !== undefined) {
        const action = item.action;
        const actionArg = item.actionArg;
        result.click = () => {
            void handleAction(action, actionArg);
        };
    }
    return result;
}

/**
 * Interpreter the user pinned for the open workspace.
 *
 * @returns Absolute interpreter path, or null when the workspace is automatic.
 */
function selectedEnvironment(): string | null {
    return workspace === null ? null : (persisted.selectedEnvironments[workspace.path] ?? null);
}

/**
 * Whether navita has what it needs to be useful in this workspace.
 *
 * Startup lands on the overview when it does not, because every fix for a
 * missing piece lives on that page.
 * @returns True when a workspace, an interpreter and the Ansible tools exist.
 */
async function isReadyForWork(): Promise<boolean> {
    if (workspace === null || environment === null) {
        return false;
    }
    if (mcpStatus.state === 'error' || lspStatus.state === 'error') {
        return false;
    }
    const devTools = await loadDevTools();
    return devTools.state === 'ready' && devTools.packages.length > 0;
}

/**
 * Turn a chosen folder into the active workspace and probe its servers.
 * @param candidate - Directory proposed by the picker or a recent entry.
 * @returns State after the servers have been probed.
 */
async function activateWorkspace(candidate: string): Promise<AppState> {
    if (!isDirectory(candidate)) {
        throw new Error(`not a directory: ${candidate}`);
    }
    workspace = toWorkspaceEntry(candidate);
    // The previous workspace's interpreter must not linger in the status bar
    // while this one is still being probed.
    environment = null;
    // In-process services read the workspace from this variable the same way
    // the servers navita spawns do, so they must see it too.
    process.env.ANSIBLE_ENV_WORKSPACE = workspace.path;
    resetEnvironmentCache();
    invalidateToolCache();
    persisted.recents = pushRecent(persisted.recents, workspace);
    persisted.lastWorkspace = workspace.path;
    store.save(persisted);
    mcpStatus = { state: 'starting' };
    lspStatus = { state: 'starting' };
    mainWindow?.setTitle(`${APP_NAME} — ${workspace.path}`);
    broadcast();

    const resolved = await resolveEnvironment(workspace.path, selectedEnvironment());
    environment = summarizeEnvironment(resolved);
    const binDir = resolved?.binDir ?? null;
    const specs = spawnSpecs(workspace.path, binDir);
    const statuses = await probeServers(specs.mcp, specs.lsp, workspace.path);
    mcpStatus = statuses.mcp;
    lspStatus = statuses.lsp;
    broadcast();
    return currentState();
}

/**
 *
 * @returns State after clearing the workspace.
 */
function closeWorkspace(): AppState {
    workspace = null;
    environment = null;
    persisted.activeSection = 'overview';
    delete process.env.ANSIBLE_ENV_WORKSPACE;
    resetEnvironmentCache();
    persisted.lastWorkspace = null;
    store.save(persisted);
    mcpStatus = { state: 'stopped' };
    lspStatus = { state: 'stopped' };
    mainWindow?.setTitle(APP_NAME);
    broadcast();
    return currentState();
}

/**
 *
 * @returns State after the dialog closes, changed or not.
 */
async function pickWorkspace(): Promise<AppState> {
    const options: Electron.OpenDialogOptions = {
        title: 'Open Workspace',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: 'Open Workspace',
    };
    const result =
        mainWindow === null
            ? await dialog.showOpenDialog(options)
            : await dialog.showOpenDialog(mainWindow, options);
    if (result.canceled || result.filePaths.length === 0) {
        return currentState();
    }
    return activateWorkspace(result.filePaths[0]);
}

/**
 *
 * @param harness - Harness whose configuration format the snippet matches.
 * @returns Snippet text for the clipboard.
 */
function snippetFor(harness: HarnessId): string {
    const scripts = serverScripts();
    return buildSnippet(harness, {
        serverScript: scripts.mcp,
        skillsDir: scripts.skills,
        execPath: process.execPath,
        workspacePath: workspace?.path,
    });
}

/**
 *
 * @param action - Menu action to dispatch.
 * @param actionArg - Optional payload for the action, such as a harness or path.
 * @returns Promise that resolves when the action finishes.
 */
async function handleAction(action: string, actionArg?: string): Promise<void> {
    switch (action) {
        case 'open-workspace':
            await pickWorkspace();
            return;
        case 'open-recent':
            if (actionArg !== undefined) {
                try {
                    await activateWorkspace(actionArg);
                } catch (error) {
                    dialog.showErrorBox('Could not open workspace', String(error));
                }
            }
            return;
        case 'close-workspace':
            closeWorkspace();
            return;
        case 'rescan-workspace':
            if (workspace !== null) {
                await activateWorkspace(workspace.path);
            }
            return;
        case 'reveal-workspace':
            if (workspace !== null) {
                shell.showItemInFolder(workspace.path);
            }
            return;
        case 'show-section':
            // The renderer owns the breadcrumb trail, so it is the one that
            // switches section: entering a section always starts at its root,
            // and the menu must reset depth exactly like the sidebar does.
            if (actionArg !== undefined) {
                mainWindow?.webContents.send(IPC.sectionRequested, actionArg);
            }
            return;
        case 'toggle-sidebar':
            mainWindow?.webContents.send(IPC.toggleSidebar);
            return;
        case 'back':
            mainWindow?.webContents.send(IPC.navigateBack);
            return;
        case 'copy-snippet':
            if (actionArg !== undefined) {
                void clipboard.writeText(snippetFor(actionArg as HarnessId));
            }
            return;
        case 'test-connection':
            if (workspace !== null) {
                await activateWorkspace(workspace.path);
            }
            return;
        case 'set-theme':
            if (actionArg !== undefined && isThemeId(actionArg)) {
                setTheme(actionArg);
            }
            return;
        case 'about':
            void dialog.showMessageBox({
                type: 'info',
                title: `About ${APP_NAME}`,
                message: `${APP_NAME} 0.0.1`,
                detail: 'Ships the Ansible MCP server, language server and skills.',
            });
            return;
        case 'reload':
            mainWindow?.reload();
            return;
        case 'devtools':
            mainWindow?.webContents.toggleDevTools();
            return;
        case 'quit':
            app.quit();
            return;
        default:
            return;
    }
}

/**
 *
 */
function registerIpc(): void {
    ipcMain.handle(IPC.getState, () => currentState());
    ipcMain.handle(IPC.getLogs, () => currentLogs() ?? EMPTY_LOGS);
    ipcMain.handle(IPC.clearLogs, () => clearLogs() ?? EMPTY_LOGS);
    ipcMain.handle(IPC.setTheme, (_event, candidate: string) =>
        isThemeId(candidate) ? setTheme(candidate) : currentState(),
    );
    ipcMain.handle(IPC.updateSettings, (_event, patch: unknown) => updateSettings(patch));
    ipcMain.handle(IPC.clearRecents, () => {
        persisted.recents = [];
        store.save(persisted);
        broadcast();
        return currentState();
    });
    ipcMain.handle(
        IPC.installCollection,
        (_event, name: unknown, version: unknown, lookupName: unknown) =>
            typeof name === 'string' && name.length > 0
                ? installCollection(
                      name,
                      typeof version === 'string' && version ? version : undefined,
                      typeof lookupName === 'string' && lookupName ? lookupName : undefined,
                  )
                : Promise.resolve({
                      state: 'error' as const,
                      detail: 'A collection name is required.',
                  }),
    );
    ipcMain.handle(IPC.removeRecent, (_event, candidate: unknown) => {
        if (typeof candidate === 'string' && candidate.length > 0) {
            persisted.recents = removeRecent(persisted.recents, candidate);
            store.save(persisted);
            broadcast();
        }
        return currentState();
    });
    ipcMain.handle(IPC.openWorkspace, () => pickWorkspace());
    ipcMain.handle(IPC.activateWorkspace, (_event, candidate: string) =>
        activateWorkspace(candidate),
    );
    ipcMain.handle(IPC.closeWorkspace, () => closeWorkspace());
    ipcMain.handle(IPC.showSection, (_event, section: string) => {
        persisted.activeSection = section as SectionId;
        store.save(persisted);
        broadcast();
        return currentState();
    });
    ipcMain.handle(IPC.rescanWorkspace, async () =>
        workspace === null ? currentState() : activateWorkspace(workspace.path),
    );
    ipcMain.handle(IPC.copySnippet, (_event, harness: string) => {
        const snippet = snippetFor(harness as HarnessId);
        void clipboard.writeText(snippet);
        return snippet;
    });
    ipcMain.handle(IPC.getDiagnostics, () => {
        const state = currentState();
        return gatherDiagnostics({
            ...(state.workspace === null ? {} : { workspacePath: state.workspace.path }),
            ...(state.environment === null ? {} : { environment: state.environment }),
            mcp: state.mcp,
            lsp: state.lsp,
        });
    });
    ipcMain.handle(IPC.upgradeDevTools, async () => {
        const resolved = await resolveEnvironment(workspace?.path ?? null, selectedEnvironment());
        if (resolved === undefined) {
            return {
                state: 'error',
                exitCode: 1,
                output: 'No Python environment resolved. Pick one under Python environment first.',
                packageCount: 0,
            };
        }
        return upgradeDevTools(resolved.pythonPath);
    });
    ipcMain.handle(IPC.getDevTools, () => loadDevTools());
    ipcMain.handle(IPC.installDevTools, async () => {
        const resolved = await resolveEnvironment(workspace?.path ?? null, selectedEnvironment());
        if (resolved === undefined) {
            return {
                state: 'error',
                exitCode: 1,
                output: 'No Python environment resolved. Pick one under Python environment first.',
                packageCount: 0,
            };
        }
        return installDevTools(resolved.pythonPath);
    });
    ipcMain.handle(IPC.getEnvironments, (_event, workspacePath: string | null) =>
        loadEnvironments(
            workspacePath,
            workspacePath === null ? null : (persisted.selectedEnvironments[workspacePath] ?? null),
        ),
    );
    ipcMain.handle(IPC.selectEnvironment, async (_event, pythonPath: unknown) => {
        if (workspace === null) {
            return currentState();
        }
        const selections = Object.entries(persisted.selectedEnvironments).filter(
            ([candidate]) => candidate !== workspace?.path,
        );
        persisted.selectedEnvironments = Object.fromEntries(
            typeof pythonPath === 'string' && pythonPath.length > 0
                ? [...selections, [workspace.path, pythonPath]]
                : selections,
        );
        store.save(persisted);
        // The servers were spawned with the old PATH, so switching interpreters
        // means respawning them, not just invalidating a cache.
        return activateWorkspace(workspace.path);
    });
    ipcMain.handle(IPC.getTools, async () => {
        const scripts = serverScripts();
        const cwd = workspace?.path ?? process.cwd();
        const binDir =
            workspace === null ? null : await resolveBinDir(workspace.path, selectedEnvironment());
        return loadTools(
            serverSpawnSpec(
                process.execPath,
                scripts.mcp,
                serverEnv(cwd, skillSources(), process.env, binDir),
            ),
            cwd,
        );
    });
    ipcMain.handle(IPC.getSkills, () => loadSkills(serverScripts().skills));
    ipcMain.handle(IPC.copyText, (_event, text: string) => clipboard.writeText(text));
    ipcMain.handle(IPC.getCollections, () => loadCollections());
    ipcMain.handle(IPC.getCollectionPlugins, (_event, collection: string, pluginType: string) =>
        loadCollectionPlugins(collection, pluginType),
    );
    ipcMain.handle(IPC.getPluginDoc, (_event, fqcn: string, pluginType: string) =>
        loadPluginDoc(fqcn, pluginType),
    );
    ipcMain.handle(IPC.getSourcePlugins, (_event, source: SourceCollectionRef) =>
        loadSourcePlugins(app.getPath('userData'), source),
    );
    ipcMain.handle(
        IPC.getSourcePluginDoc,
        (_event, source: SourceCollectionRef, fqcn: string, pluginType: string) =>
            loadSourcePluginDoc(app.getPath('userData'), source, fqcn, pluginType),
    );
    ipcMain.handle(IPC.getExecutionEnvironments, () => loadExecutionEnvironments());
    ipcMain.handle(IPC.getExecutionEnvironmentDetails, (_event, fullName: string) =>
        loadExecutionEnvironmentDetails(fullName),
    );
    ipcMain.handle(IPC.getPlaybooks, (_event, workspacePath: string | null) =>
        loadPlaybooks(workspacePath),
    );
    ipcMain.handle(IPC.getCreator, () => loadCreator());
    ipcMain.handle(IPC.runCreator, async (event, request: unknown) => {
        const { path: commandPath, values } = (request ?? {}) as {
            path?: unknown;
            values?: unknown;
        };
        if (!Array.isArray(commandPath) || !commandPath.every((part) => typeof part === 'string')) {
            throw new Error('invalid ansible-creator command path');
        }
        const schema = CreatorService.getInstance().getSchema();
        const node = schema === null ? undefined : findSchemaNode(schema, commandPath);
        if (node === undefined) {
            throw new Error(`unknown ansible-creator command: ${commandPath.join(' ')}`);
        }
        const args = buildCommandArgs(
            [...commandPath],
            node,
            (values ?? {}) as Record<string, unknown>,
        );
        event.sender.send(IPC.creatorStarted, { command: `ansible-creator ${args.join(' ')}` });

        const commands = CommandService.getInstance();
        const toolPath = await commands.getToolPath('ansible-creator').catch(() => null);
        if (toolPath === null) {
            event.sender.send(IPC.creatorFinished, {
                exitCode: 1,
                output: 'ansible-creator not found. Install ansible-dev-tools in the Python environment navita uses.',
            });
            return;
        }
        try {
            const result = await commands.runCommandArgs(toolPath, args);
            const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
            event.sender.send(IPC.creatorFinished, { exitCode: result.exitCode, output });
        } catch (error: unknown) {
            event.sender.send(IPC.creatorFinished, {
                exitCode: 1,
                output: error instanceof Error ? error.message : String(error),
            });
        }
    });
    ipcMain.handle(IPC.openPath, async (_event, target: unknown) => {
        if (typeof target === 'string' && target.length > 0) {
            await shell.openPath(target);
        }
    });
    ipcMain.handle(IPC.getCollectionSources, () =>
        loadCollectionSources(app.getPath('userData'), { orgs: persisted.settings.githubOrgs }),
    );
    ipcMain.handle(IPC.refreshCollectionSource, (_event, org: string) =>
        refreshCollectionSource(app.getPath('userData'), org, persisted.settings.githubOrgs),
    );
    ipcMain.handle(IPC.testConnection, async () =>
        workspace === null ? currentState() : activateWorkspace(workspace.path),
    );
}

/**
 *
 */
function createWindow(): void {
    const dist = distDir();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        show: false,
        backgroundColor: '#1e1e1e',
        title: APP_NAME,
        webPreferences: {
            preload: path.join(dist, 'preload', 'index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    const index = path.join(dist, 'renderer', 'index.html');
    void mainWindow.loadFile(index);
}

app.setName(APP_NAME);

void app.whenReady().then(() => {
    installEnvironmentResolver(
        () => workspace?.path ?? null,
        () => selectedEnvironment(),
    );
    configureLogs(path.join(app.getPath('userData'), 'logs', 'navita.log'), [
        process.env.GH_TOKEN ?? '',
        process.env.GIT_TOKEN ?? '',
        process.env.JIRA_API_TOKEN ?? '',
    ]);
    onLogAppended(scheduleLogsBroadcast);
    // The services log through @ansible/common; this is the seam VS Code
    // filled with an OutputChannel.
    setLogFunction((message) => {
        logLines('app', levelFor(message), message);
    });
    store = new StateStore(path.join(app.getPath('userData'), 'state.json'));
    persisted = store.load();
    registerIpc();
    refreshMenu();
    createWindow();

    const lastWorkspace = persisted.lastWorkspace;
    void (async () => {
        if (lastWorkspace !== null && isDirectory(lastWorkspace)) {
            await activateWorkspace(lastWorkspace);
            // Restore the section the user left off in only when the setup can
            // actually do the work; otherwise the overview is the useful page.
            if (await isReadyForWork()) {
                return;
            }
        }
        persisted.activeSection = 'overview';
        store.save(persisted);
        broadcast();
    })();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
