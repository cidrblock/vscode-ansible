/**
 * Discovery of Python interpreters that exist on the machine itself.
 *
 * The Python extension APIs only exist inside VS Code, so anything running
 * standalone (navita, the MCP server) had no way to list environments. This
 * module fills that gap with the sources that need no extension: the
 * interpreter on PATH, virtual environments inside the workspace, and the
 * common per-user install locations.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

/** Where an environment came from, used as the group label in the UI. */
export type LocalEnvironmentKind =
    'system' | 'venv' | 'virtualenv' | 'uv' | 'pyenv' | 'pipenv' | 'conda';

export interface LocalEnvironment {
    readonly name: string;
    readonly pythonPath: string;
    readonly binDir: string;
    readonly version?: string;
    readonly kind: LocalEnvironmentKind;
    readonly active: boolean;
}

export interface DiscoveryOptions {
    /** Workspace to scan for `.venv`, `venv` and `env` directories. */
    readonly workspacePath?: string | null;
    /** Environment used to resolve PATH; defaults to the current process. */
    readonly env?: NodeJS.ProcessEnv;
    /** Home directory to scan; defaults to the current user's home. */
    readonly homeDir?: string;
    /** Platform whose interpreter layout applies; defaults to the current one. */
    readonly platform?: NodeJS.Platform;
    /** Upper bound on returned environments. */
    readonly limit?: number;
}

const DEFAULT_LIMIT = 50;
const WORKSPACE_ENV_DIRS = ['.venv', 'venv', 'env'];
const HOME_ENV_DIRS: readonly { readonly pattern: string; readonly kind: LocalEnvironmentKind }[] =
    [
        { pattern: '.local/share/uv/python', kind: 'uv' },
        { pattern: '.pyenv/versions', kind: 'pyenv' },
        { pattern: '.local/share/virtualenvs', kind: 'pipenv' },
        { pattern: '.virtualenvs', kind: 'virtualenv' },
        { pattern: 'miniconda3/envs', kind: 'conda' },
        { pattern: 'anaconda3/envs', kind: 'conda' },
        { pattern: 'miniforge3/envs', kind: 'conda' },
    ];

/**
 * Interpreter file names to try, most preferred first.
 * @param platform - Platform whose interpreter layout applies.
 * @returns Interpreter file names, most preferred first.
 */
const interpreterNames = (platform: NodeJS.Platform): readonly string[] =>
    platform === 'win32' ? ['python.exe', 'python3.exe'] : ['python3', 'python'];

/**
 * Directory holding the interpreter inside an environment.
 * @param platform - Platform whose interpreter layout applies.
 * @returns Directory holding the interpreter.
 */
const scriptDirName = (platform: NodeJS.Platform): string =>
    platform === 'win32' ? 'Scripts' : 'bin';

/**
 * True when the path exists and is a regular file.
 * @param candidate - Path to test.
 * @returns True when the path is a regular file.
 */
const isFile = async (candidate: string): Promise<boolean> => {
    try {
        const stats = await fs.stat(candidate);
        return stats.isFile();
    } catch {
        return false;
    }
};

/**
 * Sub-directories of a path, or an empty list when it cannot be read.
 * @param parent - Directory to list.
 * @returns Sub-directory names, empty when unreadable.
 */
const listDirectories = async (parent: string): Promise<string[]> => {
    try {
        const entries = await fs.readdir(parent, { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
        return [];
    }
};

/**
 * Read the interpreter version a virtual environment recorded for itself.
 * @param environmentDir - Environment directory to inspect.
 * @returns Recorded version, or undefined when unknown.
 */
const readVenvVersion = async (environmentDir: string): Promise<string | undefined> => {
    try {
        const text = await fs.readFile(path.join(environmentDir, 'pyvenv.cfg'), 'utf8');
        for (const line of text.split('\n')) {
            const match = /^(?:version|version_info)\s*=\s*(\S+)/.exec(line.trim());
            if (match?.[1] !== undefined) {
                return match[1];
            }
        }
    } catch {
        // Not a virtual environment, or unreadable: version stays unknown.
    }
    return undefined;
};

/**
 * Version embedded in a directory name such as `cpython-3.12.3-linux`.
 * @param name - Directory name used as the display label.
 * @returns Version found in the name, or undefined.
 */
const versionFromName = (name: string): string | undefined => /\d+\.\d+(?:\.\d+)?/.exec(name)?.[0];

/**
 * Locate the interpreter inside an environment directory.
 * @param environmentDir - Environment directory to inspect.
 * @param platform - Platform whose interpreter layout applies.
 * @returns Path to the interpreter, or undefined when absent.
 */
const interpreterIn = async (
    environmentDir: string,
    platform: NodeJS.Platform,
): Promise<string | undefined> => {
    const binDir = path.join(environmentDir, scriptDirName(platform));
    for (const name of interpreterNames(platform)) {
        const candidate = path.join(binDir, name);
        if (await isFile(candidate)) {
            return candidate;
        }
    }
    return undefined;
};

/**
 * Build an entry for an environment directory, or undefined when it has no interpreter.
 * @param environmentDir - Environment directory to inspect.
 * @param kind - Manager kind the layout belongs to.
 * @param platform - Platform whose interpreter layout applies.
 * @param name - Directory name used as the display label.
 * @returns Entry for the environment, or undefined when it has no interpreter.
 */
const environmentFromDir = async (
    environmentDir: string,
    kind: LocalEnvironmentKind,
    platform: NodeJS.Platform,
    name: string,
): Promise<LocalEnvironment | undefined> => {
    const pythonPath = await interpreterIn(environmentDir, platform);
    if (pythonPath === undefined) {
        return undefined;
    }
    const version = (await readVenvVersion(environmentDir)) ?? versionFromName(name);
    return {
        name,
        pythonPath,
        binDir: path.dirname(pythonPath),
        kind,
        active: false,
        ...(version === undefined ? {} : { version }),
    };
};

/**
 * Resolve the first interpreter found on PATH.
 * @param env - Environment variables used to resolve PATH.
 * @param platform - Platform whose interpreter layout applies.
 * @returns Path to the first interpreter, or undefined.
 */
const resolveOnPath = async (
    env: NodeJS.ProcessEnv,
    platform: NodeJS.Platform,
): Promise<string | undefined> => {
    const searchPath = env.PATH ?? env.Path ?? '';
    for (const directory of searchPath.split(path.delimiter)) {
        if (directory.length === 0) {
            continue;
        }
        for (const name of interpreterNames(platform)) {
            const candidate = path.join(directory, name);
            if (await isFile(candidate)) {
                return candidate;
            }
        }
    }
    return undefined;
};

/**
 * Entries from one of the per-user install layouts, newest name first.
 * @param homeDir - Home directory to scan.
 * @param pattern - Path relative to the home directory holding environments.
 * @param kind - Manager kind the layout belongs to.
 * @param platform - Platform whose interpreter layout applies.
 * @param limit - Maximum number of entries to return.
 * @returns Environments found in this layout.
 */
const collectHomeLayout = async (
    homeDir: string,
    pattern: string,
    kind: LocalEnvironmentKind,
    platform: NodeJS.Platform,
    limit: number,
): Promise<LocalEnvironment[]> => {
    const parent = path.join(homeDir, pattern);
    const names = (await listDirectories(parent)).sort().slice(0, limit);
    const entries = await Promise.all(
        names.map(async (name) => {
            const environmentDir = path.join(parent, name);
            return environmentFromDir(environmentDir, kind, platform, `${kind} ${name}`);
        }),
    );
    return entries.filter((entry): entry is LocalEnvironment => entry !== undefined);
};

/**
 * Discover Python environments without any VS Code extension.
 * @param options - Workspace, PATH, home directory and platform to scan.
 * @returns Environments with the active interpreter first; never throws.
 */
export async function discoverLocalEnvironments(
    options: DiscoveryOptions = {},
): Promise<LocalEnvironment[]> {
    const platform = options.platform ?? process.platform;
    const env = options.env ?? process.env;
    const homeDir = options.homeDir ?? os.homedir();
    const limit = options.limit ?? DEFAULT_LIMIT;

    const found: LocalEnvironment[] = [];
    const seen = new Set<string>();
    const add = (entry: LocalEnvironment | undefined): void => {
        if (entry === undefined || seen.has(entry.pythonPath)) {
            return;
        }
        seen.add(entry.pythonPath);
        found.push(entry);
    };

    const onPath = await resolveOnPath(env, platform);
    if (onPath !== undefined) {
        // An activated virtual environment puts its own interpreter on PATH, so
        // check for pyvenv.cfg before calling the interpreter a system one.
        const environmentDir = path.dirname(path.dirname(onPath));
        const venvVersion = await readVenvVersion(environmentDir);
        const isVenv = venvVersion !== undefined;
        const venvName = `${path.basename(path.dirname(environmentDir))}/${path.basename(environmentDir)}`;
        add({
            name: isVenv ? venvName : 'Python (system)',
            pythonPath: onPath,
            binDir: path.dirname(onPath),
            kind: isVenv ? 'venv' : 'system',
            active: true,
            ...(venvVersion === undefined ? {} : { version: venvVersion }),
        });
    }

    if (options.workspacePath !== undefined && options.workspacePath !== null) {
        for (const directoryName of WORKSPACE_ENV_DIRS) {
            const environmentDir = path.join(options.workspacePath, directoryName);
            add(
                await environmentFromDir(
                    environmentDir,
                    'venv',
                    platform,
                    `${path.basename(options.workspacePath)}/${directoryName}`,
                ),
            );
        }
    }

    for (const layout of HOME_ENV_DIRS) {
        for (const entry of await collectHomeLayout(
            homeDir,
            layout.pattern,
            layout.kind,
            platform,
            limit,
        )) {
            add(entry);
        }
        if (found.length >= limit) {
            break;
        }
    }

    const ordered = [...found].sort((left, right) => {
        if (left.active !== right.active) {
            return left.active ? -1 : 1;
        }
        if (left.kind !== right.kind) {
            return left.kind.localeCompare(right.kind);
        }
        return left.name.localeCompare(right.name);
    });
    return ordered.slice(0, limit);
}
