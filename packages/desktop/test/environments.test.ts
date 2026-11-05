import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { groupEnvironments, loadEnvironments } from '../src/main/environments';

describe('groupEnvironments', () => {
    it('groups by manager kind in discovery order', () => {
        const groups = groupEnvironments([
            {
                name: 'Python (system)',
                pythonPath: '/usr/bin/python3',
                binDir: '/usr/bin',
                kind: 'system',
                active: true,
            },
            {
                name: 'repo/.venv',
                pythonPath: '/repo/.venv/bin/python3',
                binDir: '/repo/.venv/bin',
                kind: 'venv',
                active: false,
            },
            {
                name: 'uv 3.13',
                pythonPath: '/uv/bin/python3',
                binDir: '/uv/bin',
                kind: 'uv',
                active: false,
            },
        ]);

        expect(groups.map((group) => group.id)).toEqual(['system', 'venv', 'uv']);
        expect(groups.map((group) => group.label)).toEqual(['Global', 'venv', 'uv']);
    });

    it('collects several environments of the same kind into one group', () => {
        const groups = groupEnvironments([
            {
                name: 'a/.venv',
                pythonPath: '/a/.venv/bin/python3',
                binDir: '/a/.venv/bin',
                kind: 'venv',
                active: false,
            },
            {
                name: 'b/venv',
                pythonPath: '/b/venv/bin/python3',
                binDir: '/b/venv/bin',
                kind: 'venv',
                active: false,
            },
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.environments.map((entry) => entry.name)).toEqual(['a/.venv', 'b/venv']);
    });

    it('carries the active flag and version through to the renderer model', () => {
        const groups = groupEnvironments([
            {
                name: 'repo/.venv',
                pythonPath: '/repo/.venv/bin/python3',
                binDir: '/repo/.venv/bin',
                kind: 'venv',
                active: true,
                version: '3.12.3',
            },
        ]);

        expect(groups[0]?.environments[0]).toEqual({
            name: 'repo/.venv',
            pythonPath: '/repo/.venv/bin/python3',
            active: true,
            version: '3.12.3',
        });
    });

    it('omits the version key when the interpreter version is unknown', () => {
        const groups = groupEnvironments([
            {
                name: 'Python (system)',
                pythonPath: '/usr/bin/python3',
                binDir: '/usr/bin',
                kind: 'system',
                active: true,
            },
        ]);

        expect(groups[0]?.environments[0]).not.toHaveProperty('version');
    });
});

const cleanup: string[] = [];

afterEach(() => {
    while (cleanup.length > 0) {
        const directory = cleanup.pop();
        if (directory !== undefined) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }
});

describe('loadEnvironments', () => {
    it('lists the pinned interpreter first and reports it as in use', async () => {
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-list-'));
        cleanup.push(workspace);
        const bin = path.join(workspace, 'manual-env', 'bin');
        fs.mkdirSync(bin, { recursive: true });
        const pythonPath = path.join(bin, 'python3');
        fs.writeFileSync(pythonPath, '');
        fs.writeFileSync(path.join(workspace, 'manual-env', 'pyvenv.cfg'), 'version = 3.12.1\n');

        const result = await loadEnvironments(workspace, pythonPath);
        const listed = result.groups.flatMap((group) => group.environments);

        expect(result.selection).toBe(pythonPath);
        expect(listed[0]?.pythonPath).toBe(pythonPath);
        expect(listed[0]?.active).toBe(true);
        expect(listed.filter((entry) => entry.active)).toHaveLength(1);
    });

    it('reports automatic selection when nothing is pinned', async () => {
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-list-'));
        cleanup.push(workspace);

        const result = await loadEnvironments(workspace, null);

        expect(result.selection).toBeNull();
    });
});
