import { describe, expect, it } from 'vitest';

import { groupEnvironments } from '../src/main/environments';

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
