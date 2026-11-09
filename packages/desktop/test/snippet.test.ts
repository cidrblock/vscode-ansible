import { describe, expect, it } from 'vitest';

import { buildSnippet, type SnippetOptions } from '../src/main/snippet';

const options: SnippetOptions = {
    serverScript: '/opt/navita/dist/servers/mcp-server.js',
    skillsDir: '/opt/navita/dist/skills',
    execPath: '/opt/navita/navita',
};

describe('buildSnippet', () => {
    it('writes a Cursor-style mcpServers entry that runs Electron as Node', () => {
        const parsed = JSON.parse(buildSnippet('cursor', options)) as {
            mcpServers: Record<
                string,
                { command: string; args: string[]; env: Record<string, string> }
            >;
        };
        const server = parsed.mcpServers.ansible;
        expect(server.command).toBe('/opt/navita/navita');
        expect(server.args).toEqual(['/opt/navita/dist/servers/mcp-server.js']);
        expect(server.env.ELECTRON_RUN_AS_NODE).toBe('1');
        expect(JSON.parse(server.env.ANSIBLE_SKILL_SOURCES)).toEqual([
            { id: 'bundled', type: 'local', url: '/opt/navita/dist/skills', trust: 'certified' },
        ]);
    });

    it('uses the servers key for VS Code', () => {
        const parsed = JSON.parse(buildSnippet('vscode', options)) as Record<string, unknown>;
        expect(Object.keys(parsed)).toEqual(['servers']);
    });

    it('emits TOML for Codex', () => {
        const snippet = buildSnippet('codex', options);
        expect(snippet).toContain('[mcp_servers.ansible]');
        expect(snippet).toContain('command = "/opt/navita/navita"');
    });

    it('passes configured skill sources to the harness', () => {
        const snippet = buildSnippet('cursor', {
            ...options,
            skillSources: [
                {
                    id: 'ai-forge',
                    type: 'github',
                    url: 'https://github.com/acme/skills',
                    trust: 'community',
                },
            ],
        });
        const parsed = JSON.parse(snippet) as {
            mcpServers: Record<string, { env: Record<string, string> }>;
        };
        expect(JSON.parse(parsed.mcpServers.ansible.env.ANSIBLE_SKILL_SOURCES)).toEqual([
            { id: 'bundled', type: 'local', url: '/opt/navita/dist/skills', trust: 'certified' },
            {
                id: 'ai-forge',
                type: 'github',
                url: 'https://github.com/acme/skills',
                trust: 'community',
            },
        ]);
    });

    it('only pins a workspace when one is supplied', () => {
        expect(buildSnippet('cursor', options)).not.toContain('ANSIBLE_ENV_WORKSPACE');
        expect(buildSnippet('cursor', { ...options, workspacePath: '/tmp/project' })).toContain(
            'ANSIBLE_ENV_WORKSPACE',
        );
    });
});
