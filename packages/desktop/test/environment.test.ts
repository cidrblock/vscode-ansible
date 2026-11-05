import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { pickEnvironment, resolveBinDir } from '../src/main/environment';
import type { LocalEnvironment } from '@ansible/developer-services';

interface EnvironmentOptions {
    readonly active?: boolean;
    readonly kind?: LocalEnvironment['kind'];
}

const environment = (
    name: string,
    binDir: string,
    { active = false, kind = 'venv' }: EnvironmentOptions = {},
): LocalEnvironment => ({ name, pythonPath: `${binDir}/python3`, binDir, kind, active });

const capable = (value: LocalEnvironment): boolean => value.name === 'with-tools';

describe('pickEnvironment', () => {
    it('prefers an environment that ships the ansible tools', () => {
        const system = environment('system', '/usr/bin', { active: true, kind: 'system' });
        const tools = environment('with-tools', '/home/me/venv/bin');

        expect(pickEnvironment([system, tools], capable)).toBe(tools);
    });

    it('prefers the active environment among the capable ones', () => {
        const first = environment('with-tools', '/opt/one/bin');
        const second = environment('with-tools', '/opt/two/bin', { active: true });

        expect(pickEnvironment([first, second], capable)).toBe(second);
    });

    it('falls back to the active environment when none has the tools', () => {
        const inactive = environment('inactive', '/opt/a/bin');
        const active = environment('active', '/usr/bin', { active: true, kind: 'system' });

        expect(pickEnvironment([inactive, active], capable)).toBe(active);
    });

    it('falls back to the first environment when nothing is active', () => {
        const first = environment('first', '/opt/a/bin');

        expect(pickEnvironment([first], capable)).toBe(first);
    });

    it('returns undefined when nothing was discovered', () => {
        expect(pickEnvironment([], capable)).toBeUndefined();
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

/**
 * Create a workspace holding one virtual environment.
 * @returns Workspace path and the interpreter inside its .venv.
 */
function workspaceWithVenv(): { workspace: string; pythonPath: string } {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-pin-'));
    cleanup.push(workspace);
    const bin = path.join(workspace, '.venv', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    const pythonPath = path.join(bin, 'python3');
    fs.writeFileSync(pythonPath, '');
    fs.writeFileSync(path.join(workspace, '.venv', 'pyvenv.cfg'), 'version = 3.12.4\n');
    return { workspace, pythonPath };
}

describe('resolveBinDir', () => {
    it('uses the pinned interpreter ahead of discovery', async () => {
        const { workspace, pythonPath } = workspaceWithVenv();

        expect(await resolveBinDir(workspace, pythonPath)).toBe(path.dirname(pythonPath));
    });

    it('falls back to discovery when the pin no longer exists', async () => {
        const { workspace } = workspaceWithVenv();

        const resolved = await resolveBinDir(
            workspace,
            path.join(workspace, 'gone', 'bin', 'python3'),
        );

        expect(resolved).not.toBe(path.join(workspace, 'gone', 'bin'));
    });
});
