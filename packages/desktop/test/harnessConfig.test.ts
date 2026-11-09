import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    applyHarnessConfig,
    harnessTargets,
    readHarnessConfigs,
    type HarnessTargetContext,
} from '../src/main/harnessConfig';
import type { HarnessServerEntry } from '../src/main/snippet';

const entry: HarnessServerEntry = {
    command: '/opt/navita/navita',
    args: ['/opt/navita/dist/servers/mcp-server.js'],
    env: { ELECTRON_RUN_AS_NODE: '1' },
};

const temporary: string[] = [];

/**
 * Create a throwaway workspace and home directory.
 * @returns Context pointing at them.
 */
function fixture(): HarnessTargetContext {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-harness-'));
    temporary.push(root);
    const workspacePath = path.join(root, 'project');
    const home = path.join(root, 'home');
    fs.mkdirSync(workspacePath, { recursive: true });
    fs.mkdirSync(home, { recursive: true });
    return { workspacePath, home, platform: 'linux' };
}

/**
 * Read a status for one harness and scope.
 * @param context - Fixture context.
 * @param harness - Harness to look up.
 * @param scope - Workspace or global.
 * @returns The status, or fails the test when it is missing.
 */
function status(
    context: HarnessTargetContext,
    harness: 'cursor' | 'claude-code' | 'codex' | 'vscode',
    scope: 'workspace' | 'global',
) {
    const found = readHarnessConfigs(context, entry).find(
        (candidate) => candidate.harness === harness && candidate.scope === scope,
    );
    if (found === undefined) {
        throw new Error(`no status for ${harness}/${scope}`);
    }
    return found;
}

afterEach(() => {
    for (const directory of temporary.splice(0)) {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

describe('harnessTargets', () => {
    it('offers a workspace and a user file for every harness', () => {
        const context = fixture();
        const targets = harnessTargets(context);
        expect(targets).toHaveLength(8);
        const codexWorkspace = targets.find(
            (target) => target.harness === 'codex' && target.scope === 'workspace',
        );
        expect(codexWorkspace?.path).toBe(
            path.join(context.workspacePath ?? '', '.codex', 'config.toml'),
        );
        expect(codexWorkspace?.format).toBe('toml');
        const cursorWorkspace = targets.find(
            (target) => target.harness === 'cursor' && target.scope === 'workspace',
        );
        expect(cursorWorkspace?.path).toBe(
            path.join(context.workspacePath ?? '', '.cursor', 'mcp.json'),
        );
    });

    it('uses the platform-specific VS Code user directory', () => {
        const base: HarnessTargetContext = {
            workspacePath: null,
            home: '/home/ansible',
            platform: 'linux',
        };
        const linux = harnessTargets(base).find(
            (target) => target.harness === 'vscode' && target.scope === 'global',
        );
        expect(linux?.path).toBe('/home/ansible/.config/Code/User/mcp.json');
        const mac = harnessTargets({ ...base, platform: 'darwin' }).find(
            (target) => target.harness === 'vscode' && target.scope === 'global',
        );
        expect(mac?.path).toBe('/home/ansible/Library/Application Support/Code/User/mcp.json');
        const windows = harnessTargets({
            ...base,
            platform: 'win32',
            appData: 'C:\\Users\\ansible\\AppData\\Roaming',
        }).find((target) => target.harness === 'vscode' && target.scope === 'global');
        expect(windows?.path).toContain('Code');
    });

    it('reports the workspace scope as unavailable when no workspace is open', () => {
        const context: HarnessTargetContext = {
            workspacePath: null,
            home: '/home/ansible',
            platform: 'linux',
        };
        const cursor = status(context, 'cursor', 'workspace');
        expect(cursor.state).toBe('unsupported');
        expect(cursor.detail).toContain('Open a workspace first');
    });
});

describe('Codex project config', () => {
    it('warns when the project has not been trusted', () => {
        const context = fixture();
        const codex = status(context, 'codex', 'workspace');
        expect(codex.path).toBe(path.join(context.workspacePath ?? '', '.codex', 'config.toml'));
        expect(codex.warning).toContain('trusted');
    });

    it('drops the warning once the user config trusts the project', () => {
        const context = fixture();
        const file = path.join(context.home, '.codex', 'config.toml');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            [
                '[projects."' + (context.workspacePath ?? '') + '"]',
                'trust_level = "trusted"',
                '',
            ].join('\n'),
        );
        expect(status(context, 'codex', 'workspace').warning).toBeUndefined();
    });

    it('accepts a trust decision recorded against the git root', () => {
        const context = fixture();
        const workspacePath = context.workspacePath ?? '';
        const repository = path.join(workspacePath, 'packages', 'app');
        fs.mkdirSync(path.join(workspacePath, '.git'), { recursive: true });
        fs.mkdirSync(repository, { recursive: true });
        const file = path.join(context.home, '.codex', 'config.toml');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            ['[projects."' + workspacePath + '"]', 'trust_level = "trusted"', ''].join('\n'),
        );
        const nested = { ...context, workspacePath: repository };
        expect(status(nested, 'codex', 'workspace').warning).toBeUndefined();
    });

    it('keeps the warning when the decision says untrusted', () => {
        const context = fixture();
        const file = path.join(context.home, '.codex', 'config.toml');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            [
                '[projects."' + (context.workspacePath ?? '') + '"]',
                'trust_level = "untrusted"',
                '',
            ].join('\n'),
        );
        expect(status(context, 'codex', 'workspace').warning).toContain('trusted');
    });

    it('writes the workspace table without touching the user config', () => {
        const context = fixture();
        const userFile = path.join(context.home, '.codex', 'config.toml');
        fs.mkdirSync(path.dirname(userFile), { recursive: true });
        fs.writeFileSync(userFile, 'model = "gpt-5"\n');
        const result = applyHarnessConfig(context, entry, 'codex', 'workspace', true);
        expect(result.error).toBeUndefined();
        const projectFile = path.join(context.workspacePath ?? '', '.codex', 'config.toml');
        expect(fs.readFileSync(projectFile, 'utf8')).toContain('[mcp_servers.ansible]');
        expect(fs.readFileSync(userFile, 'utf8')).toBe('model = "gpt-5"\n');
        expect(status(context, 'codex', 'workspace').state).toBe('installed');
    });
});

describe('applyHarnessConfig', () => {
    it('writes an absent JSON config and keeps unrelated keys', () => {
        const context = fixture();
        const file = path.join(context.workspacePath ?? '', '.cursor', 'mcp.json');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({ mcpServers: { other: { command: 'other' } }, theme: 'dark' }),
        );
        const result = applyHarnessConfig(context, entry, 'cursor', 'workspace', true);
        expect(result.error).toBeUndefined();
        expect(result.change?.action).toBe('added');
        const written = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            theme: string;
            mcpServers: Record<string, unknown>;
        };
        expect(written.theme).toBe('dark');
        expect(written.mcpServers.other).toEqual({ command: 'other' });
        expect(written.mcpServers.ansible).toEqual(entry);
        expect(status(context, 'cursor', 'workspace').state).toBe('installed');
    });

    it('creates a config file that did not exist', () => {
        const context = fixture();
        const result = applyHarnessConfig(context, entry, 'vscode', 'workspace', true);
        expect(result.change?.action).toBe('added');
        const file = path.join(context.workspacePath ?? '', '.vscode', 'mcp.json');
        const written = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            servers: Record<string, unknown>;
        };
        expect(written.servers.ansible).toEqual(entry);
    });

    it('replaces a stale entry that points at another install', () => {
        const context = fixture();
        const file = path.join(context.home, '.cursor', 'mcp.json');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({
                mcpServers: {
                    ansible: { command: '/old/navita', args: ['/old/mcp-server.js'] },
                    other: { command: 'other' },
                },
            }),
        );
        expect(status(context, 'cursor', 'global').state).toBe('stale');
        const result = applyHarnessConfig(context, entry, 'cursor', 'global', true);
        expect(result.change?.action).toBe('updated');
        expect(status(context, 'cursor', 'global').state).toBe('installed');
        const written = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            mcpServers: Record<string, unknown>;
        };
        expect(written.mcpServers.other).toEqual({ command: 'other' });
    });

    it('removes only the ansible entry and keeps a backup', () => {
        const context = fixture();
        applyHarnessConfig(context, entry, 'claude-code', 'workspace', true);
        const file = path.join(context.workspacePath ?? '', '.mcp.json');
        const before = fs.readFileSync(file, 'utf8');
        const result = applyHarnessConfig(context, entry, 'claude-code', 'workspace', false);
        expect(result.change?.action).toBe('removed');
        expect(status(context, 'claude-code', 'workspace').state).toBe('absent');
        const written = JSON.parse(fs.readFileSync(file, 'utf8')) as {
            mcpServers: Record<string, unknown>;
        };
        expect(written.mcpServers).toEqual({});
        expect(fs.readFileSync(`${file}.navita.bak`, 'utf8')).toBe(before);
    });

    it('writes TOML for Codex and leaves other tables alone', () => {
        const context = fixture();
        const file = path.join(context.home, '.codex', 'config.toml');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            ['model = "gpt-5"', '', '[mcp_servers.other]', 'command = "other"', ''].join('\n'),
        );
        const result = applyHarnessConfig(context, entry, 'codex', 'global', true);
        expect(result.error).toBeUndefined();
        const written = fs.readFileSync(file, 'utf8');
        expect(written).toContain('model = "gpt-5"');
        expect(written).toContain('[mcp_servers.other]');
        expect(written).toContain('[mcp_servers.ansible]');
        expect(written).toContain('command = "/opt/navita/navita"');
        expect(status(context, 'codex', 'global').state).toBe('installed');

        applyHarnessConfig(context, entry, 'codex', 'global', true);
        const rewritten = fs.readFileSync(file, 'utf8');
        expect(rewritten.match(/\[mcp_servers\.ansible\]/g)).toHaveLength(1);

        const removed = applyHarnessConfig(context, entry, 'codex', 'global', false);
        expect(removed.error).toBeUndefined();
        const after = fs.readFileSync(file, 'utf8');
        expect(after).not.toContain('[mcp_servers.ansible]');
        expect(after).toContain('[mcp_servers.other]');
        expect(status(context, 'codex', 'global').state).toBe('absent');
    });

    it('refuses to overwrite a file it cannot parse', () => {
        const context = fixture();
        const file = path.join(context.workspacePath ?? '', '.cursor', 'mcp.json');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, '{ not json');
        expect(status(context, 'cursor', 'workspace').state).toBe('error');
        const result = applyHarnessConfig(context, entry, 'cursor', 'workspace', true);
        expect(result.error).toContain('Cannot parse');
        expect(fs.readFileSync(file, 'utf8')).toBe('{ not json');
    });

    it('reports removing an entry that is not there', () => {
        const context = fixture();
        const result = applyHarnessConfig(context, entry, 'cursor', 'workspace', false);
        expect(result.error).toContain('No ansible entry');
        expect(result.statuses).toHaveLength(8);
    });
});
