import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { describeEnvironment, discoverLocalEnvironments } from '../../src/LocalEnvironments';

const cleanup: string[] = [];

/**
 * Create a temporary directory that is removed after the test.
 * @param prefix - Label folded into the directory name.
 * @returns Absolute path to the new directory.
 */
function tempDir(prefix: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), `navita-${prefix}-`));
    cleanup.push(directory);
    return directory;
}

/**
 * Create a fake interpreter inside an environment directory.
 * @param environmentDir - Environment root to populate.
 * @param version - Version to record in pyvenv.cfg, when supplied.
 * @returns Path to the interpreter that was created.
 */
function makeEnvironment(environmentDir: string, version?: string): string {
    const binDir = path.join(environmentDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    const pythonPath = path.join(binDir, 'python3');
    fs.writeFileSync(pythonPath, '');
    if (version !== undefined) {
        fs.writeFileSync(path.join(environmentDir, 'pyvenv.cfg'), `version = ${version}\n`);
    }
    return pythonPath;
}

afterEach(() => {
    let directory = cleanup.pop();
    while (directory !== undefined) {
        fs.rmSync(directory, { recursive: true, force: true });
        directory = cleanup.pop();
    }
});

describe('discoverLocalEnvironments', () => {
    it('reports the PATH interpreter as the active system environment', async () => {
        const bin = tempDir('path');
        fs.writeFileSync(path.join(bin, 'python3'), '');
        const homeDir = tempDir('home');

        const environments = await discoverLocalEnvironments({
            env: { PATH: bin },
            homeDir,
            platform: 'linux',
        });

        expect(environments).toHaveLength(1);
        expect(environments[0]?.kind).toBe('system');
        expect(environments[0]?.active).toBe(true);
        expect(environments[0]?.pythonPath).toBe(path.join(bin, 'python3'));
        expect(environments[0]?.binDir).toBe(bin);
    });

    it('labels an activated virtual environment as venv rather than system', async () => {
        const parent = tempDir('parent');
        const envDir = path.join(parent, 'project', '.venv');
        const pythonPath = makeEnvironment(envDir, '3.13.0');

        const environments = await discoverLocalEnvironments({
            env: { PATH: path.dirname(pythonPath) },
            homeDir: tempDir('home'),
            platform: 'linux',
        });

        expect(environments).toHaveLength(1);
        expect(environments[0]?.kind).toBe('venv');
        expect(environments[0]?.version).toBe('3.13.0');
        expect(environments[0]?.name).toBe('project/.venv');
    });

    it('finds .venv and venv in the workspace and reads their version', async () => {
        const workspace = tempDir('ws');
        const dotVenv = makeEnvironment(path.join(workspace, '.venv'), '3.12.3');
        const plainVenv = makeEnvironment(path.join(workspace, 'venv'), '3.11.9');

        const environments = await discoverLocalEnvironments({
            workspacePath: workspace,
            env: { PATH: '' },
            homeDir: tempDir('home'),
            platform: 'linux',
        });

        expect(environments.map((entry) => entry.pythonPath)).toEqual([dotVenv, plainVenv]);
        expect(environments.map((entry) => entry.kind)).toEqual(['venv', 'venv']);
        expect(environments.map((entry) => entry.version)).toEqual(['3.12.3', '3.11.9']);
        expect(environments.every((entry) => !entry.active)).toBe(true);
    });

    it('scans uv, pyenv and conda layouts under the home directory', async () => {
        const homeDir = tempDir('home');
        const uvDir = path.join(homeDir, '.local', 'share', 'uv', 'python', 'cpython-3.13.1-linux');
        makeEnvironment(uvDir);
        makeEnvironment(path.join(homeDir, '.pyenv', 'versions', '3.10.14'));
        makeEnvironment(path.join(homeDir, 'miniconda3', 'envs', 'analysis'));

        const environments = await discoverLocalEnvironments({
            env: { PATH: '' },
            homeDir,
            platform: 'linux',
        });

        const kinds = environments.map((entry) => entry.kind);
        expect(kinds).toContain('uv');
        expect(kinds).toContain('pyenv');
        expect(kinds).toContain('conda');
        expect(environments.find((entry) => entry.kind === 'uv')?.version).toBe('3.13.1');
        expect(environments.find((entry) => entry.kind === 'conda')?.name).toBe('conda analysis');
    });

    it('deduplicates an environment reachable through PATH and the workspace', async () => {
        const workspace = tempDir('ws');
        const pythonPath = makeEnvironment(path.join(workspace, '.venv'));

        const environments = await discoverLocalEnvironments({
            workspacePath: workspace,
            env: { PATH: path.dirname(pythonPath) },
            homeDir: tempDir('home'),
            platform: 'linux',
        });

        expect(environments).toHaveLength(1);
        expect(environments[0]?.active).toBe(true);
    });

    it('ignores directories without an interpreter and respects the limit', async () => {
        const homeDir = tempDir('home');
        fs.mkdirSync(path.join(homeDir, '.pyenv', 'versions', 'empty'), { recursive: true });
        makeEnvironment(path.join(homeDir, '.pyenv', 'versions', '3.9.18'));
        makeEnvironment(path.join(homeDir, '.pyenv', 'versions', '3.10.14'));

        const environments = await discoverLocalEnvironments({
            env: { PATH: '' },
            homeDir,
            platform: 'linux',
            limit: 1,
        });

        expect(environments).toHaveLength(1);
        expect(environments[0]?.name).toBe('pyenv 3.10.14');
    });

    it('returns an empty list when nothing exists and never throws', async () => {
        const environments = await discoverLocalEnvironments({
            env: { PATH: '' },
            homeDir: tempDir('home'),
            platform: 'linux',
        });

        expect(environments).toEqual([]);
    });
});

describe('describeEnvironment', () => {
    it('describes a virtual environment from its interpreter path', async () => {
        const pythonPath = makeEnvironment(path.join(tempDir('project'), '.venv'), '3.12.4');

        const environment = await describeEnvironment(pythonPath);

        expect(environment).toMatchObject({
            kind: 'venv',
            version: '3.12.4',
            pythonPath,
            binDir: path.dirname(pythonPath),
            active: false,
        });
    });

    it('labels a venv outside the scanned layouts by its parent directory', async () => {
        const parent = tempDir('elsewhere');
        const pythonPath = makeEnvironment(path.join(parent, 'custom-env'), '3.11.9');

        const environment = await describeEnvironment(pythonPath);

        expect(environment?.name).toBe(`${path.basename(parent)}/custom-env`);
        expect(environment?.kind).toBe('venv');
    });

    it('recognises a uv-managed interpreter', async () => {
        const home = tempDir('uvhome');
        const pythonPath = makeEnvironment(
            path.join(home, '.local', 'share', 'uv', 'python', 'cpython-3.13.1'),
        );

        const environment = await describeEnvironment(pythonPath);

        expect(environment?.kind).toBe('uv');
        expect(environment?.version).toBe('3.13.1');
    });

    it('returns undefined when the path is not an interpreter', async () => {
        expect(await describeEnvironment(path.join(tempDir('missing'), 'python3'))).toBeUndefined();
    });
});
