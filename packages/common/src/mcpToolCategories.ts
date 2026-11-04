/**
 * Categories used to group MCP tools in the UI.
 *
 * The grouping is derived from the tool name so the extension tree and navita
 * stay in step without shipping the tool definitions to either of them.
 */

export type McpToolCategoryId =
    'getting_started' | 'discovery' | 'generation' | 'execution' | 'devtools' | 'creator';

export interface McpToolCategory {
    readonly id: McpToolCategoryId;
    readonly label: string;
}

/** Categories in the order they are shown. */
export const MCP_TOOL_CATEGORIES: readonly McpToolCategory[] = [
    { id: 'getting_started', label: 'Getting Started' },
    { id: 'discovery', label: 'Discovery' },
    { id: 'generation', label: 'Task Generation' },
    { id: 'execution', label: 'Execution Environments' },
    { id: 'devtools', label: 'Dev Tools' },
    { id: 'creator', label: 'Creator' },
];

/**
 * Assign a display category to an MCP tool by name.
 * @param name - MCP tool identifier.
 * @returns Category the tool is grouped under.
 */
export function categorizeMcpTool(name: string): McpToolCategoryId {
    if (name === 'get_agent_onboarding' || name === 'get_extension_walkthrough') {
        return 'getting_started';
    }
    if (
        name.includes('search') ||
        name.includes('list') ||
        name.includes('get_plugin_documentation')
    ) {
        return 'discovery';
    }
    if (name.includes('generate') || name.includes('build_ansible_task')) {
        return 'generation';
    }
    if (name.includes('execution_environment') || name.includes('ee_')) {
        return 'execution';
    }
    if (name.includes('dev_tools')) {
        return 'devtools';
    }
    return 'discovery';
}
