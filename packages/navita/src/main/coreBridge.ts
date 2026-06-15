/**
 * Core Bridge — wires @ansible/core singletons in the Electron main process
 * and registers IPC handlers that expose services to the renderer.
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
    setLogFunction,
    getCommandService,
    getCachedBinDir,
    getCachedEnvironment,
    PythonStandaloneService,
    CollectionsService,
    DevToolsService,
    ExecutionEnvService,
    CreatorService,
    GalaxyCollectionCache,
    GitHubCollectionCache,
} from '@ansible/core';
import type {
    CollectionInfo,
    PluginInfo,
    PluginData,
    DevToolPackage,
    SchemaNode,
} from '@ansible/core';
import { IPC_CHANNELS } from '../shared/types';
import type {
    EnvironmentInfo,
    DiscoveredEnv,
    PlaybookConfig,
    PlaybookInfo,
    SearchResult,
    ProgressEvent,
    ProjectEntry,
    GalaxyCollectionInfo,
    GitHubCollectionInfo,
    EEInfo,
    EEDetailInfo,
    CreatorCommand,
    CreatorParameter,
    NavitaSettings,
} from '../shared/types';
import { PlaybookRunner } from './playbookRunner';
import { loadSettings, saveSettings as persistSettings } from './settingsStore';
import { initializeMcpHost, getMcpTools, callMcpTool, getMcpStatus, restartMcpHost, generateMcpConfigSnippet } from './mcpHost';
import { startLsp, stopLsp, getLspStatus, restartLsp } from './lspHost';

let playbookRunner: PlaybookRunner | null = null;
let mainWindowRef: BrowserWindow | null = null;

function log(message: string): void {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${message}`);
}

export function initializeCoreBridge(mainWindow: BrowserWindow): void {
    mainWindowRef = mainWindow;

    setLogFunction(log);

    const commandService = getCommandService();
    let binDirLogged = false;
    commandService.setBinDirResolver(async () => {
        const binDir = getCachedBinDir();
        if (binDir) {
            if (!binDirLogged) {
                log(`coreBridge: resolved binDir from cache: ${binDir}`);
                binDirLogged = true;
            }
            return binDir;
        }
        log('coreBridge: no cached binDir found');
        return null;
    });

    registerCollectionHandlers();
    registerCollectionSourceHandlers();
    registerPlaybookHandlers();
    registerEnvironmentHandlers();
    registerExecutionEnvHandlers();
    registerCreatorHandlers();
    registerMcpHandlers();
    registerLspHandlers();
    registerSettingsHandlers();
    registerProjectHandlers();
    registerWindowHandlers();

    void initializeServices();
}

export function disposeCoreBridge(): void {
    if (playbookRunner) {
        playbookRunner.stop();
        playbookRunner = null;
    }
    stopLsp();
    mainWindowRef = null;
}

async function initializeServices(): Promise<void> {
    try {
        const collections = CollectionsService.getInstance();
        await collections.refresh();
        log(`coreBridge: loaded ${String(collections.listCollectionNames().length)} collections`);
    } catch (err) {
        log(`coreBridge: collections init failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const settings = loadSettings();
    if (settings.mcpAutoStart) {
        void initializeMcpHost();
    }

    startLsp();
}

// --- Collection IPC Handlers ---

function registerCollectionHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_COLLECTIONS, (): CollectionInfo[] => {
        const collections = CollectionsService.getInstance();
        const names = collections.listCollectionNames();
        return names.map((name) => {
            const data = collections.getCollection(name);
            return data?.info ?? { name, version: 'unknown', authors: [], description: '' };
        });
    });

    ipcMain.handle(IPC_CHANNELS.GET_PLUGINS, (_event, collection: string, pluginType: string): PluginInfo[] => {
        return CollectionsService.getInstance().getPlugins(collection, pluginType);
    });

    ipcMain.handle(IPC_CHANNELS.GET_PLUGIN_DOC, async (_event, pluginName: string, pluginType: string): Promise<PluginData | null> => {
        return CollectionsService.getInstance().getPluginDocumentation(pluginName, pluginType);
    });

    ipcMain.handle(IPC_CHANNELS.SEARCH_PLUGINS, (_event, query: string): SearchResult[] => {
        const results = CollectionsService.getInstance().searchPlugins(query);
        return results.map((r) => ({
            collection: r.collection,
            pluginType: r.pluginType,
            pluginName: r.plugin.name,
        }));
    });

    ipcMain.handle(IPC_CHANNELS.REFRESH_COLLECTIONS, async (): Promise<void> => {
        await CollectionsService.getInstance().forceRefresh();
    });
}

// --- Collection Source IPC Handlers ---

function registerCollectionSourceHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.SEARCH_GALAXY_COLLECTIONS, (_event, query: string): GalaxyCollectionInfo[] => {
        try {
            const cache = GalaxyCollectionCache.getInstance();
            const results = cache.search(query);
            return results.slice(0, 50).map((c) => ({
                name: `${c.namespace}.${c.name}`,
                version: c.version ?? '',
            }));
        } catch (err) {
            log(`coreBridge: Galaxy search failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.SEARCH_GITHUB_COLLECTIONS, (_event, query: string): GitHubCollectionInfo[] => {
        try {
            const cache = GitHubCollectionCache.getInstance();
            const results = cache.search(query);
            return results.slice(0, 50).map((c) => ({
                name: `${c.namespace}.${c.name}`,
                description: c.description,
            }));
        } catch (err) {
            log(`coreBridge: GitHub search failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.INSTALL_COLLECTION, async (_event, name: string): Promise<string> => {
        try {
            const cmdService = getCommandService();
            const result = await cmdService.runTool('ade', ['install', name]);
            return result.stdout || 'Installed successfully.';
        } catch (err) {
            throw new Error(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
}

// --- Playbook IPC Handlers ---

function registerPlaybookHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_PLAYBOOKS, async (): Promise<PlaybookInfo[]> => {
        const workspaceRoot = getCommandService().getWorkspaceRoot();
        if (!workspaceRoot) return [];
        const playbooks: PlaybookInfo[] = [];
        await findPlaybooks(workspaceRoot, workspaceRoot, playbooks);
        return playbooks;
    });

    ipcMain.handle(IPC_CHANNELS.RUN_PLAYBOOK, async (_event, playbookPath: string, config: PlaybookConfig): Promise<void> => {
        if (playbookRunner) playbookRunner.stop();
        const workspaceRoot = getCommandService().getWorkspaceRoot();
        if (!workspaceRoot) throw new Error('No workspace root configured');

        playbookRunner = new PlaybookRunner({
            playbookPath,
            workspaceRoot,
            callbackPluginsPath: findCallbackPluginsPath(),
            config,
            onEvent: (event: ProgressEvent) => { mainWindowRef?.webContents.send(IPC_CHANNELS.PLAYBOOK_EVENT, event); },
            onComplete: () => { mainWindowRef?.webContents.send(IPC_CHANNELS.PLAYBOOK_COMPLETE); },
            log,
        });
        await playbookRunner.start();
    });

    ipcMain.handle(IPC_CHANNELS.STOP_PLAYBOOK, (): void => {
        if (playbookRunner) { playbookRunner.stop(); playbookRunner = null; }
    });
}

// --- Environment IPC Handlers ---

function registerEnvironmentHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_ENVIRONMENT_INFO, (): EnvironmentInfo => {
        const cached = getCachedEnvironment();
        return {
            pythonPath: cached?.pythonPath ?? null,
            displayName: cached?.displayName ?? null,
            binDir: cached?.binDir ?? null,
            workspaceRoot: getCommandService().getWorkspaceRoot(),
        };
    });

    ipcMain.handle(IPC_CHANNELS.GET_DEVTOOLS_PACKAGES, async (): Promise<DevToolPackage[]> => {
        const devTools = DevToolsService.getInstance();
        if (!devTools.isLoaded()) await devTools.refresh();
        return devTools.getPackages();
    });

    ipcMain.handle(IPC_CHANNELS.DISCOVER_ENVIRONMENTS, async (): Promise<DiscoveredEnv[]> => {
        const workspaceRoot = getCommandService().getWorkspaceRoot();
        if (!workspaceRoot) return [];
        try {
            const service = PythonStandaloneService.getInstance();
            return await service.discover(workspaceRoot);
        } catch (err) {
            log(`coreBridge: env discovery failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.SELECT_ENVIRONMENT, (_event, env: DiscoveredEnv): void => {
        const service = PythonStandaloneService.getInstance();
        service.selectEnvironment(env);
    });
}

// --- Execution Environment IPC Handlers ---

function registerExecutionEnvHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.LIST_EXECUTION_ENVIRONMENTS, async (): Promise<EEInfo[]> => {
        try {
            const eeService = ExecutionEnvService.getInstance();
            const ees = await eeService.loadExecutionEnvironments();
            return ees.map((ee) => {
                const colonIdx = ee.full_name.lastIndexOf(':');
                const tag = colonIdx > 0 ? ee.full_name.slice(colonIdx + 1) : undefined;
                return {
                    name: ee.full_name,
                    tag: tag && tag !== ee.full_name ? tag : undefined,
                    id: ee.image_id,
                };
            });
        } catch (err) {
            log(`coreBridge: EE list failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.GET_EE_DETAILS, async (_event, eeName: string): Promise<EEDetailInfo> => {
        try {
            const eeService = ExecutionEnvService.getInstance();
            const [info, collections, pythonPkgs, systemPkgs] = await Promise.all([
                eeService.getInfo(eeName),
                eeService.getCollections(eeName),
                eeService.getPythonPackages(eeName),
                eeService.getSystemPackages(eeName),
            ]);
            return {
                ansibleVersion: info.ansible ?? null,
                osRelease: info.os ?? null,
                imageName: info.image ?? null,
                collections,
                pythonPackages: pythonPkgs,
                systemPackages: systemPkgs,
            };
        } catch (err) {
            log(`coreBridge: EE inspect failed: ${err instanceof Error ? err.message : String(err)}`);
            return { ansibleVersion: null, osRelease: null, imageName: null, collections: [], pythonPackages: [], systemPackages: [] };
        }
    });
}

// --- Creator IPC Handlers ---

function registerCreatorHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_CREATOR_COMMANDS, async (): Promise<CreatorCommand[]> => {
        try {
            const creator = CreatorService.getInstance();
            const schema = await creator.loadSchema();
            if (!schema) return [];
            return flattenCreatorSchema(schema);
        } catch (err) {
            log(`coreBridge: Creator schema failed: ${err instanceof Error ? err.message : String(err)}`);
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.RUN_CREATOR_COMMAND, async (_event, commandName: string, params: Record<string, string>): Promise<string> => {
        try {
            const creator = CreatorService.getInstance();
            const cmdPath = commandName.split('.');
            const positionalArgs = creator.getPositionalArgs(cmdPath);
            const result = await creator.runCommand(cmdPath, { ...params, overwrite: true }, positionalArgs);
            return String(result ?? 'Completed successfully.');
        } catch (err) {
            throw new Error(`Creator failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
}

function flattenCreatorSchema(schema: SchemaNode, parentPath: string[] = []): CreatorCommand[] {
    const commands: CreatorCommand[] = [];
    if (schema.subcommands) {
        for (const [name, sub] of Object.entries(schema.subcommands)) {
            const currentPath = [...parentPath, name];
            if (sub.subcommands && Object.keys(sub.subcommands).length > 0) {
                commands.push(...flattenCreatorSchema(sub, currentPath));
            } else {
                const params: CreatorParameter[] = [];
                if (sub.parameters?.properties) {
                    for (const [pName, pSchema] of Object.entries(sub.parameters.properties)) {
                        params.push({
                            name: pName,
                            description: pSchema.description,
                            type: pSchema.type ?? 'string',
                            required: sub.parameters.required?.includes(pName) ?? false,
                            defaultValue: pSchema.default != null ? String(pSchema.default) : undefined,
                            choices: pSchema.enum,
                        });
                    }
                }
                commands.push({
                    name: currentPath.join('.'),
                    label: currentPath.join(' '),
                    description: sub.description,
                    parameters: params,
                });
            }
        }
    }
    return commands;
}

// --- MCP IPC Handlers ---

function registerMcpHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_MCP_TOOLS, () => getMcpTools());
    ipcMain.handle(IPC_CHANNELS.CALL_MCP_TOOL, async (_event, toolName: string, args: Record<string, unknown>) => callMcpTool(toolName, args));
    ipcMain.handle(IPC_CHANNELS.GET_MCP_STATUS, () => getMcpStatus());
    ipcMain.handle(IPC_CHANNELS.RESTART_MCP, async () => restartMcpHost());
    ipcMain.handle(IPC_CHANNELS.GET_MCP_CONFIG_SNIPPET, (_event, format: string) => generateMcpConfigSnippet(format));
}

// --- LSP IPC Handlers ---

function registerLspHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_LSP_STATUS, () => getLspStatus());
    ipcMain.handle(IPC_CHANNELS.RESTART_LSP, () => restartLsp());
    ipcMain.handle(IPC_CHANNELS.GET_SERVICE_STATUS, () => ({
        mcp: { ...getMcpStatus(), transport: loadSettings().mcpTransport },
        lsp: getLspStatus(),
    }));
}

// --- Settings IPC Handlers ---

function registerSettingsHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, (): NavitaSettings => loadSettings());
    ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, settings: NavitaSettings): void => {
        persistSettings(settings);
    });
}

// --- Project IPC Handlers ---

const PROJECTS_FILE = path.join(os.homedir(), '.config', 'ansible-navita', 'projects.json');

function loadProjects(): ProjectEntry[] {
    try {
        return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8')) as ProjectEntry[];
    } catch {
        return [];
    }
}

function saveProjects(projects: ProjectEntry[]): void {
    const dir = path.dirname(PROJECTS_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

function registerProjectHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.GET_RECENT_PROJECTS, (): ProjectEntry[] => {
        return loadProjects().sort((a, b) => b.lastOpened - a.lastOpened);
    });

    ipcMain.handle(IPC_CHANNELS.ADD_PROJECT, async (): Promise<ProjectEntry | null> => {
        const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Open Ansible Project' });
        if (result.canceled || result.filePaths.length === 0) return null;
        const projectPath = result.filePaths[0];
        const entry: ProjectEntry = { path: projectPath, name: path.basename(projectPath), lastOpened: Date.now() };
        const projects = loadProjects().filter((p) => p.path !== projectPath);
        projects.unshift(entry);
        saveProjects(projects);
        process.env.ANSIBLE_ENV_WORKSPACE = projectPath;
        await initializeServices();
        return entry;
    });

    ipcMain.handle(IPC_CHANNELS.SWITCH_PROJECT, async (_event, projectPath: string): Promise<void> => {
        const projects = loadProjects();
        const idx = projects.findIndex((p) => p.path === projectPath);
        if (idx >= 0) { projects[idx].lastOpened = Date.now(); }
        else { projects.unshift({ path: projectPath, name: path.basename(projectPath), lastOpened: Date.now() }); }
        saveProjects(projects);
        process.env.ANSIBLE_ENV_WORKSPACE = projectPath;
        await initializeServices();
    });

    ipcMain.handle(IPC_CHANNELS.REMOVE_PROJECT, (_event, projectPath: string): void => {
        saveProjects(loadProjects().filter((p) => p.path !== projectPath));
    });

    ipcMain.handle(IPC_CHANNELS.GET_WORKSPACE, (): string | null => getCommandService().getWorkspaceRoot());
}

// --- Window Control IPC Handlers ---

function registerWindowHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => { mainWindowRef?.minimize(); });
    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
        if (mainWindowRef?.isMaximized()) mainWindowRef.unmaximize();
        else mainWindowRef?.maximize();
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => { mainWindowRef?.close(); });
    ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, (): boolean => mainWindowRef?.isMaximized() ?? false);
}

// --- Helpers ---

async function findPlaybooks(dir: string, rootDir: string, results: PlaybookInfo[]): Promise<void> {
    const skipDirs = new Set(['node_modules', '.git', '.venv', '__pycache__', '.tox', 'roles']);
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name)) await findPlaybooks(fullPath, rootDir, results);
        } else if (entry.isFile() && /\.(yml|yaml)$/.test(entry.name) && isLikelyPlaybook(entry.name)) {
            results.push({ path: fullPath, name: entry.name, relativePath: path.relative(rootDir, fullPath) });
        }
    }
}

function isLikelyPlaybook(filename: string): boolean {
    return [/^site\./, /^main\./, /playbook/i, /^deploy/i, /^provision/i, /^setup/i, /^install/i, /^configure/i].some((p) => p.test(filename));
}

function findCallbackPluginsPath(): string {
    const candidates = [
        path.join(__dirname, '..', '..', '..', '..', 'resources', 'callback_plugins'),
        path.join(__dirname, '..', 'resources', 'callback_plugins'),
        path.join(process.cwd(), 'resources', 'callback_plugins'),
    ];
    for (const c of candidates) { if (fs.existsSync(c)) return c; }
    return candidates[0];
}
