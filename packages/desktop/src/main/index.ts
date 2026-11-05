/**
 * navita main process.
 *
 * Owns the window, the native menu, the workspace picker and the two stdio
 * servers navita ships. The renderer only ever talks to this process through
 * the preload bridge, so all filesystem and process work stays here.
 */

import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, shell } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    IPC,
    type AppState,
    type HarnessId,
    type McpStatus,
    type SectionId,
    type ServerStatus,
    type WorkspaceEntry,
} from '../shared/ipc';
import { buildMenuTemplate, type MenuContext, type MenuItemSpec } from './menu';
import { loadDevTools } from './devtools';
import { installEnvironmentResolver, resetEnvironmentCache, resolveBinDir } from './environment';
import { loadEnvironments } from './environments';
import { loadCollections } from './collections';
import { loadExecutionEnvironments } from './executionEnvironments';
import { loadSkills } from './skills';
import { invalidateToolCache, loadTools } from './tools';
import { probeServers, serverEnv, serverSpawnSpec, type SpawnSpec } from './servers';
import { buildSnippet } from './snippet';
import { StateStore, type PersistedState } from './store';
import { isDirectory, pushRecent, toWorkspaceEntry } from './workspaces';

const APP_NAME = 'navita';

let mainWindow: BrowserWindow | null = null;
let store: StateStore;
let persisted: PersistedState;
let workspace: WorkspaceEntry | null = null;
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
        recents: persisted.recents,
        activeSection: persisted.activeSection,
        mcp: mcpStatus,
        lsp: lspStatus,
    };
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
 * Turn a chosen folder into the active workspace and probe its servers.
 * @param candidate - Directory proposed by the picker or a recent entry.
 * @returns State after the servers have been probed.
 */
async function activateWorkspace(candidate: string): Promise<AppState> {
    if (!isDirectory(candidate)) {
        throw new Error(`not a directory: ${candidate}`);
    }
    workspace = toWorkspaceEntry(candidate);
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

    const binDir = await resolveBinDir(workspace.path);
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
            if (actionArg !== undefined) {
                persisted.activeSection = actionArg as SectionId;
                store.save(persisted);
                broadcast();
            }
            return;
        case 'toggle-sidebar':
            mainWindow?.webContents.send(IPC.toggleSidebar);
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
    ipcMain.handle(IPC.getDevTools, () => loadDevTools());
    ipcMain.handle(IPC.getEnvironments, (_event, workspacePath: string | null) =>
        loadEnvironments(workspacePath),
    );
    ipcMain.handle(IPC.getTools, async () => {
        const scripts = serverScripts();
        const cwd = workspace?.path ?? process.cwd();
        const binDir = workspace === null ? null : await resolveBinDir(workspace.path);
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
    ipcMain.handle(IPC.getExecutionEnvironments, () => loadExecutionEnvironments());
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
    installEnvironmentResolver(() => workspace?.path ?? null);
    store = new StateStore(path.join(app.getPath('userData'), 'state.json'));
    persisted = store.load();
    registerIpc();
    refreshMenu();
    createWindow();

    const lastWorkspace = persisted.lastWorkspace;
    if (lastWorkspace !== null && isDirectory(lastWorkspace)) {
        void activateWorkspace(lastWorkspace);
    } else {
        broadcast();
    }

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
