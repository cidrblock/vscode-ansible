/**
 * MCP Host — runs the MCP tool handler in-process within Electron main.
 *
 * Provides:
 * - In-process tool listing and invocation for the renderer UI
 * - Config snippet generation for external AI tools (Claude Code, Cursor, etc.)
 * - A future stdio proxy for external agents
 */

import {
    CollectionsService,
    DevToolsService,
} from '@ansible/services';
import type { McpToolInfo, McpConfigSnippet, NavitaSettings } from '../shared/types';
import { loadSettings } from './settingsStore';
import * as os from 'os';
import * as path from 'path';

let initialized = false;

export async function initializeMcpHost(): Promise<void> {
    if (initialized) return;
    initialized = true;
    console.log('[mcpHost] MCP host initialized (in-process)');
}

export function shutdownMcpHost(): void {
    initialized = false;
    console.log('[mcpHost] MCP host shut down');
}

export async function restartMcpHost(): Promise<void> {
    shutdownMcpHost();
    await initializeMcpHost();
}

const ALL_TOOLS: McpToolInfo[] = [
    { name: 'search_ansible_plugins', description: 'Search for Ansible plugins by keyword across all installed collections.' },
    { name: 'get_plugin_documentation', description: 'Get full documentation for a specific Ansible plugin including parameters, return values, and examples.' },
    { name: 'list_ansible_collections', description: 'List all installed Ansible collections with their versions.' },
    { name: 'install_ansible_collection', description: 'Install an Ansible collection from Galaxy or a Git URL using ade.' },
    { name: 'search_available_collections', description: 'Search for available collections across Galaxy and configured GitHub orgs.' },
    { name: 'list_source_collections', description: 'List all collections from a specific source (Galaxy or GitHub org).' },
    { name: 'get_collection_plugins', description: 'List all plugins in a specific collection by type (modules, roles, etc.).' },
    { name: 'generate_ansible_task', description: 'Generate an Ansible task YAML snippet for any plugin with parameters filled in.' },
    { name: 'build_ansible_task', description: 'Interactively build an Ansible task with guided parameter collection.' },
    { name: 'generate_ansible_playbook', description: 'Generate a complete Ansible playbook with multiple tasks, handlers, and variables.' },
    { name: 'list_execution_environments', description: 'List available Ansible execution environment container images (podman/docker).' },
    { name: 'get_ee_details', description: 'Get detailed information about an execution environment: collections, Python packages, system packages.' },
    { name: 'list_ansible_dev_tools', description: 'List installed ansible-dev-tools packages and versions.' },
    { name: 'get_ansible_creator_schema', description: 'Get the full ansible-creator command schema for scaffolding roles, collections, and playbook projects.' },
    { name: 'get_ansible_best_practices', description: 'Get Ansible coding guidelines, style rules, and best practices for writing quality automation.' },
];

export function getMcpTools(): McpToolInfo[] {
    const settings = loadSettings();
    if (settings.mcpExposedTools.length === 0) return ALL_TOOLS;
    return ALL_TOOLS.filter((t) => settings.mcpExposedTools.includes(t.name));
}

export function getAllMcpToolNames(): string[] {
    return ALL_TOOLS.map((t) => t.name);
}

export async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
        switch (toolName) {
            case 'list_ansible_collections': {
                const collections = CollectionsService.getInstance();
                const names = collections.listCollectionNames();
                return JSON.stringify(names.map((n) => {
                    const data = collections.getCollection(n);
                    return { name: n, version: data?.info?.version ?? 'unknown' };
                }), null, 2);
            }
            case 'search_ansible_plugins': {
                const collections = CollectionsService.getInstance();
                const results = collections.searchPlugins(String(args.query ?? ''));
                return JSON.stringify(results.slice(0, 15).map((r) => ({
                    name: `${r.collection}.${r.plugin.name}`,
                    type: r.pluginType,
                    description: r.plugin.shortDescription,
                })), null, 2);
            }
            case 'list_ansible_dev_tools': {
                const devTools = DevToolsService.getInstance();
                if (!devTools.isLoaded()) await devTools.refresh();
                return JSON.stringify(devTools.getPackages(), null, 2);
            }
            default:
                return JSON.stringify({ error: `Tool '${toolName}' not yet implemented in Navita MCP host` });
        }
    } catch (err) {
        return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
    }
}

export function getMcpStatus(): { running: boolean; toolCount: number } {
    return { running: initialized, toolCount: getMcpTools().length };
}

/**
 * Generate a config snippet for a given AI tool format.
 * This produces the JSON/YAML config that a user pastes into their
 * agent's configuration to connect to Navita's MCP server.
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

function buildTransportConfig(settings: NavitaSettings, navitaPath: string): Record<string, unknown> {
    switch (settings.mcpTransport) {
        case 'socket':
            return {
                transport: 'socket',
                socketPath: settings.mcpSocketPath ?? path.join(os.tmpdir(), 'ansible-navita-mcp.sock'),
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
