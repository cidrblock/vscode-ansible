/**
 * Harness snippet generation.
 *
 * navita ships the MCP server inside the app, so a snippet only has to point at
 * that script and let Electron act as Node. Nothing is downloaded at paste time.
 */

import { HARNESSES, type HarnessId } from '../shared/ipc';

export interface SnippetOptions {
    /** Absolute path to the bundled MCP server entry. */
    readonly serverScript: string;
    /** Absolute path to the navita-managed skills directory. */
    readonly skillsDir: string;
    /** Absolute path to the app binary harnesses should execute. */
    readonly execPath: string;
    /** Optional workspace pin; omitted when the snippet should follow the harness cwd. */
    readonly workspacePath?: string;
}

const SERVER_KEY = 'ansible';

/**
 * Environment variables a harness needs to run the bundled server.
 *
 * @param options - Paths and optional workspace pin for the snippet.
 * @returns Environment map rendered into the snippet.
 */
function envPairs(options: SnippetOptions): Record<string, string> {
    const env: Record<string, string> = {
        ELECTRON_RUN_AS_NODE: '1',
        ANSIBLE_SKILL_SOURCES: JSON.stringify([{ type: 'local', path: options.skillsDir }]),
    };
    if (options.workspacePath !== undefined) {
        env.ANSIBLE_ENV_WORKSPACE = options.workspacePath;
    }
    return env;
}

/**
 * Render a JSON snippet for harnesses that use a JSON config file.
 *
 * @param options - Paths and optional workspace pin for the snippet.
 * @param wrapper - Top-level key the harness expects (`mcpServers` or `servers`).
 * @returns Pretty-printed JSON with a trailing newline.
 */
function jsonSnippet(options: SnippetOptions, wrapper: 'mcpServers' | 'servers'): string {
    const body = {
        [wrapper]: {
            [SERVER_KEY]: {
                command: options.execPath,
                args: [options.serverScript],
                env: envPairs(options),
            },
        },
    };
    return `${JSON.stringify(body, null, 2)}\n`;
}

/**
 * Quote a string for a TOML basic string.
 *
 * @param value - Raw value.
 * @returns Escaped, quoted TOML string.
 */
function tomlString(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Render a TOML snippet for Codex.
 *
 * @param options - Paths and optional workspace pin for the snippet.
 * @returns TOML table for `mcp_servers.ansible`.
 */
function tomlSnippet(options: SnippetOptions): string {
    const env = envPairs(options);
    const envTable = Object.entries(env)
        .map(([key, value]) => `${key} = ${tomlString(value)}`)
        .join(', ');
    return [
        `[mcp_servers.${SERVER_KEY}]`,
        `command = ${tomlString(options.execPath)}`,
        `args = [${tomlString(options.serverScript)}]`,
        `env = { ${envTable} }`,
        '',
    ].join('\n');
}

/**
 * Render the snippet a user pastes into the given harness.
 *
 * @param harness - Target harness id.
 * @param options - Paths and optional workspace pin for the snippet.
 * @returns Snippet text ready for the clipboard.
 */
export function buildSnippet(harness: HarnessId, options: SnippetOptions): string {
    const target = HARNESSES.find((candidate) => candidate.id === harness);
    if (target === undefined) {
        throw new Error(`unknown harness: ${harness}`);
    }
    switch (harness) {
        case 'codex':
            return tomlSnippet(options);
        case 'vscode':
            return jsonSnippet(options, 'servers');
        case 'cursor':
        case 'claude-code':
        default:
            return jsonSnippet(options, 'mcpServers');
    }
}
