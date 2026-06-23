/**
 * MCP Host — runs the MCP tool handler in-process within Electron main.
 *
 * Delegates to `McpToolHandler` from `@ansible/mcp-server` so every tool
 * available to the VS Code extension is also available in Navita.
 */

import { McpToolHandler, STATIC_TOOLS } from '@ansible/mcp-server';
import type { McpToolInfo, McpConfigSnippet, NavitaSettings } from '../shared/types';
import { loadSettings } from './settingsStore';
import * as os from 'os';
import * as path from 'path';

let initialized = false;
let handler: McpToolHandler | undefined;

/**
 *
 */
export async function initializeMcpHost(): Promise<void> {
    if (initialized) return;
    handler = new McpToolHandler();
    await handler.initialize();
    initialized = true;
    console.log('[mcpHost] MCP host initialized (in-process, all tools available)');
}

/**
 *
 */
export function shutdownMcpHost(): void {
    handler = undefined;
    initialized = false;
    console.log('[mcpHost] MCP host shut down');
}

/**
 *
 */
export async function restartMcpHost(): Promise<void> {
    shutdownMcpHost();
    await initializeMcpHost();
}

/**
 *
 */
export function getMcpTools(): McpToolInfo[] {
    const settings = loadSettings();
    const allTools = getStaticToolList();
    if (settings.mcpExposedTools.length === 0) return allTools;
    return allTools.filter((t) => settings.mcpExposedTools.includes(t.name));
}

/**
 *
 */
function getStaticToolList(): McpToolInfo[] {
    const tools: McpToolInfo[] = STATIC_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    }));

    if (handler) {
        const creatorTools = handler.getCreatorTools();
        for (const t of creatorTools.getTools()) {
            tools.push({ name: t.name, description: t.description, inputSchema: t.inputSchema });
        }
        const skillTools = handler.getSkillTools();
        for (const t of skillTools.getTools()) {
            tools.push({ name: t.name, description: t.description, inputSchema: t.inputSchema });
        }
    }

    return tools;
}

/**
 *
 */
export function getAllMcpToolNames(): string[] {
    return getStaticToolList().map((t) => t.name);
}

/**
 *
 * @param toolName
 * @param args
 */
export async function callMcpTool(
    toolName: string,
    args: Record<string, unknown>,
): Promise<string> {
    if (!handler) {
        return JSON.stringify({ error: 'MCP host not initialized' });
    }
    try {
        const result = await handler.handleTool(toolName, args);
        return result.content[0]?.text ?? JSON.stringify({ error: 'Empty response' });
    } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
}

/**
 *
 */
export function getMcpStatus(): { running: boolean; toolCount: number } {
    return { running: initialized, toolCount: getMcpTools().length };
}

/**
 * Generate a config snippet for a given AI tool format.
 * This produces the JSON/YAML config that a user pastes into their
 * agent's configuration to connect to Navita's MCP server.
 * @param format
 */
export function generateMcpConfigSnippet(format: string): McpConfigSnippet {
    const settings = loadSettings();
    const navitaPath = path.join(process.cwd(), 'packages', 'navita');

    if (format === 'claude') {
        const config = {
            mcpServers: {
                'ansible-navita': buildTransportConfig(settings, navitaPath),
            },
        };
        return {
            format: 'claude',
            config: `// Add to ~/.claude.json or .claude/settings.json\n${JSON.stringify(config, null, 2)}`,
        };
    }

    if (format === 'cursor') {
        const config = {
            'ansible-navita': buildTransportConfig(settings, navitaPath),
        };
        return {
            format: 'cursor',
            config: `// Add to .cursor/mcp.json\n${JSON.stringify(config, null, 2)}`,
        };
    }

    const config = buildTransportConfig(settings, navitaPath);
    return {
        format: 'generic',
        config: `// MCP server configuration\n${JSON.stringify(config, null, 2)}`,
    };
}

/**
 *
 * @param settings
 * @param navitaPath
 */
function buildTransportConfig(
    settings: NavitaSettings,
    navitaPath: string,
): Record<string, unknown> {
    switch (settings.mcpTransport) {
        case 'socket':
            return {
                transport: 'socket',
                socketPath:
                    settings.mcpSocketPath ?? path.join(os.tmpdir(), 'ansible-navita-mcp.sock'),
            };
        case 'sse':
            return {
                transport: 'sse',
                url: `http://localhost:${String(settings.mcpPort ?? 3100)}/mcp`,
            };
        case 'stdio':
        default:
            return {
                command: 'node',
                args: [path.join(navitaPath, 'dist', 'mcp-stdio-proxy.js')],
            };
    }
}
