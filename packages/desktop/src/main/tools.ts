/**
 * AI Tools view: the tool catalog the bundled MCP server advertises.
 *
 * The list is read over JSON-RPC from the same server navita ships, so the
 * view cannot drift from what a harness would actually see. Categories come
 * from @ansible/common, shared with the extension's tree.
 */

import {
    MCP_TOOL_CATEGORIES,
    buildMcpToolExamplePrompt,
    categorizeMcpTool,
} from '@ansible/developer-services';

import type { ToolEntry, ToolGroup, ToolsResult } from '../shared/ipc';
import type { McpToolSummary, SpawnSpec } from './servers';
import { probeMcpServer } from './servers';

const CACHE_MS = 60_000;

let cache: { readonly at: number; readonly result: ToolsResult } | undefined;

/**
 * Group advertised tools into the categories the sidebar shows.
 * @param tools - Tool summaries returned by the MCP server.
 * @returns Groups in display order, each tool carrying its example prompt.
 */
export function buildToolGroups(tools: readonly McpToolSummary[]): ToolGroup[] {
    const groups: ToolGroup[] = [];
    for (const category of MCP_TOOL_CATEGORIES) {
        const entries: ToolEntry[] = [];
        for (const tool of tools) {
            if (categorizeMcpTool(tool.name) !== category.id) {
                continue;
            }
            const description = tool.description ?? '';
            entries.push({
                name: tool.name,
                prompt: buildMcpToolExamplePrompt(tool.name, description),
                ...(description === '' ? {} : { description }),
            });
        }
        if (entries.length > 0) {
            groups.push({ id: category.id, label: category.label, tools: entries });
        }
    }
    return groups;
}

/**
 * Read the tool catalog from the bundled MCP server, caching briefly so the
 * view can be re-rendered without respawning the server.
 * @param spec - Spawn spec for the bundled MCP server.
 * @param cwd - Working directory used as the server's workspace.
 * @returns Grouped tools, or the failure detail; never throws.
 */
export async function loadTools(spec: SpawnSpec, cwd: string): Promise<ToolsResult> {
    if (cache !== undefined && Date.now() - cache.at < CACHE_MS) {
        return cache.result;
    }
    try {
        const probe = await probeMcpServer(spec, cwd);
        const result: ToolsResult = {
            state: 'ready',
            toolCount: probe.toolCount,
            groups: buildToolGroups(probe.tools),
        };
        cache = { at: Date.now(), result };
        return result;
    } catch (error: unknown) {
        return {
            state: 'error',
            toolCount: 0,
            groups: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}

/** Drop the cached catalog so the next read respawns the server. */
export function invalidateToolCache(): void {
    cache = undefined;
}
