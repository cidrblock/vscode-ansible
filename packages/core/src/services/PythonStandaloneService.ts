/**
 * Python Standalone Service
 *
 * Discovers local Python environments without IDE extension support.
 * Intended for standalone consumers — Electron apps (Ansible Navita),
 * MCP servers, CLI tools — that don't have access to IDE-provided
 * Python environment discovery (e.g. ms-python.vscode-python-envs).
 *
 * Discovery strategy (in priority order):
 *   1. Project-local venvs  (.venv, venv, .env, env)
 *   2. Conda environments   (conda info --envs --json)
 *   3. Pyenv versions       ($PYENV_ROOT/versions/ or ~/.pyenv/versions/)
 *   4. System Python        (python3 / python on PATH)
 *
 * The service is read-only: it scans the filesystem and probes
 * `python --version`. It does not create, delete, or modify
 * environments. Selection writes through the existing
 * EnvironmentCache so CommandService picks up the change.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';
import { cacheSelectedEnvironment } from './EnvironmentCache';
import { log } from '../utils/logging';

const execAsync = promisify(cp.exec);
const VERSION_TIMEOUT_MS = 2000;

export interface DiscoveredEnvironment {
    pythonPath: string;
    version: string;
    displayName: string;
    source: 'venv' | 'conda' | 'pyenv' | 'system';
    envPath: string;
}

export class PythonStandaloneService {
    private static _instance: PythonStandaloneService | undefined;

    private constructor() {}

    static getInstance(): PythonStandaloneService {
        if (!PythonStandaloneService._instance) {
            PythonStandaloneService._instance = new PythonStandaloneService();
        }
        return PythonStandaloneService._instance;
    }

    /**
     * Scan all sources and return a deduplicated list of Python
     * environments, ordered by priority (local venvs first).
     */
    async discover(workspaceRoot: string): Promise<DiscoveredEnvironment[]> {
        const [venvs, condaEnvs, pyenvVersions, systemPythons] = await Promise.all([
            this.discoverLocalVenvs(workspaceRoot),
            this.discoverCondaEnvs(),
            this.discoverPyenvVersions(),
            this.discoverSystemPython(),
        ]);

        const all = [...venvs, ...condaEnvs, ...pyenvVersions, ...systemPythons];
        return this.deduplicate(all);
    }

    /**
     * Probe a Python interpreter for its version string.
     */
    async getPythonVersion(pythonPath: string): Promise<string | null> {
        try {
            const { stdout } = await execAsync(`"${pythonPath}" --version`, {
                timeout: VERSION_TIMEOUT_MS,
            });
            const match = stdout.trim().match(/Python\s+(\S+)/i);
            return match?.[1] ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Write a discovered environment into the EnvironmentCache so
     * CommandService and other consumers pick it up immediately.
     */
    selectEnvironment(env: DiscoveredEnvironment): void {
        cacheSelectedEnvironment(env.pythonPath, env.displayName);
        log(`PythonStandaloneService: selected ${env.displayName} (${env.pythonPath})`);
    }

    // ------------------------------------------------------------------
    // Discovery strategies
    // ------------------------------------------------------------------

    private async discoverLocalVenvs(workspaceRoot: string): Promise<DiscoveredEnvironment[]> {
        const candidates = ['.venv', 'venv', '.env', 'env'];
        const results: DiscoveredEnvironment[] = [];

        for (const dir of candidates) {
            const envDir = path.join(workspaceRoot, dir);
            const pythonPath = this.findPythonInEnv(envDir);
            if (!pythonPath) continue;

            const version = await this.getPythonVersion(pythonPath);
            if (!version) continue;

            results.push({
                pythonPath,
                version,
                displayName: `${dir} (${version})`,
                source: 'venv',
                envPath: envDir,
            });
        }

        return results;
    }

    private async discoverCondaEnvs(): Promise<DiscoveredEnvironment[]> {
        try {
            const { stdout } = await execAsync('conda info --envs --json', {
                timeout: 5000,
            });
            const data = JSON.parse(stdout) as { envs?: string[] };
            if (!data.envs?.length) return [];

            const results: DiscoveredEnvironment[] = [];
            const probes = data.envs.map(async (envDir) => {
                const pythonPath = this.findPythonInEnv(envDir);
                if (!pythonPath) return;
                const version = await this.getPythonVersion(pythonPath);
                if (!version) return;
                results.push({
                    pythonPath,
                    version,
                    displayName: `conda: ${path.basename(envDir)} (${version})`,
                    source: 'conda',
                    envPath: envDir,
                });
            });
            await Promise.all(probes);
            return results;
        } catch {
            return [];
        }
    }

    private async discoverPyenvVersions(): Promise<DiscoveredEnvironment[]> {
        const pyenvRoot = process.env.PYENV_ROOT ?? path.join(process.env.HOME ?? '', '.pyenv');
        const versionsDir = path.join(pyenvRoot, 'versions');

        if (!fs.existsSync(versionsDir)) return [];

        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(versionsDir, { withFileTypes: true });
        } catch {
            return [];
        }

        const results: DiscoveredEnvironment[] = [];
        const probes = entries
            .filter((e) => e.isDirectory())
            .map(async (entry) => {
                const envDir = path.join(versionsDir, entry.name);
                const pythonPath = this.findPythonInEnv(envDir);
                if (!pythonPath) return;
                const version = await this.getPythonVersion(pythonPath);
                if (!version) return;
                results.push({
                    pythonPath,
                    version,
                    displayName: `pyenv: ${entry.name} (${version})`,
                    source: 'pyenv',
                    envPath: envDir,
                });
            });
        await Promise.all(probes);
        return results;
    }

    private async discoverSystemPython(): Promise<DiscoveredEnvironment[]> {
        const names = process.platform === 'win32'
            ? ['python3', 'python']
            : ['python3', 'python'];
        const results: DiscoveredEnvironment[] = [];

        for (const name of names) {
            const pythonPath = await this.whichExecutable(name);
            if (!pythonPath) continue;
            const version = await this.getPythonVersion(pythonPath);
            if (!version) continue;
            results.push({
                pythonPath,
                version,
                displayName: `system: ${name} (${version})`,
                source: 'system',
                envPath: path.dirname(pythonPath),
            });
        }

        return results;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private findPythonInEnv(envDir: string): string | null {
        const isWindows = process.platform === 'win32';
        const candidates = isWindows
            ? [path.join(envDir, 'Scripts', 'python.exe'), path.join(envDir, 'python.exe')]
            : [path.join(envDir, 'bin', 'python3'), path.join(envDir, 'bin', 'python')];

        for (const p of candidates) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    private async whichExecutable(name: string): Promise<string | null> {
        const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
        try {
            const { stdout } = await execAsync(cmd, { timeout: VERSION_TIMEOUT_MS });
            const result = stdout.trim().split('\n')[0];
            return result || null;
        } catch {
            return null;
        }
    }

    private deduplicate(envs: DiscoveredEnvironment[]): DiscoveredEnvironment[] {
        const seen = new Set<string>();
        const results: DiscoveredEnvironment[] = [];

        for (const env of envs) {
            let resolved: string;
            try {
                resolved = fs.realpathSync(env.pythonPath);
            } catch {
                resolved = env.pythonPath;
            }
            if (seen.has(resolved)) continue;
            seen.add(resolved);
            results.push(env);
        }

        return results;
    }
}
