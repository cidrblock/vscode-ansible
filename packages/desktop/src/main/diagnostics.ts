/**
 * Diagnostics: one snapshot of what navita resolved for the open workspace.
 *
 * The shared `DiagnosticsView` from `@ansible/ui` renders this payload, so the
 * shape mirrors its `DiagnosticsData` contract. Only the host differs: the
 * extension reads status bars and its own caches, navita asks the services.
 */

import { CommandService } from '@ansible/developer-services';

import type {
    DiagnosticsPayload,
    DiagnosticsServiceEntry,
    DiagnosticsToolEntry,
    EnvironmentSummary,
    McpStatus,
    ServerStatus,
} from '../shared/ipc';

/** Packages `adt --version` lists that the page already reports separately. */
const REPORTED_ELSEWHERE = new Set(['ansible-core']);

/**
 * Parse the ansible-core version out of `ansible --version`.
 * @param stdout - Output of `ansible --version`.
 * @returns The version, or undefined when the banner is not the expected shape.
 */
export function parseAnsibleVersion(stdout: string): string | undefined {
    return /ansible\s+\[core\s+([\d.]+\S*)]/.exec(stdout)?.[1];
}

/**
 * Parse `adt --version` into the rows the dev tools table renders.
 * @param stdout - Output of `adt --version`.
 * @returns One row per tool, in the order adt printed them.
 */
export function parseAdtTools(stdout: string): DiagnosticsToolEntry[] {
    const tools: DiagnosticsToolEntry[] = [];
    for (const line of stdout.split('\n')) {
        const match = /^(\S+)\s+([\d.]+\S*)/.exec(line.trim());
        if (match === null) {
            continue;
        }
        const name = match[1];
        const version = match[2];
        if (REPORTED_ELSEWHERE.has(name)) {
            continue;
        }
        tools.push({ name, version });
    }
    return tools;
}

/**
 * Translate navita's server states into the vocabulary the view renders.
 * @param mcp - MCP server status from app state.
 * @param lsp - Language server status from app state.
 * @returns Service rows for the services card.
 */
export function describeServices(mcp: McpStatus, lsp: ServerStatus): DiagnosticsServiceEntry[] {
    return [
        {
            name: 'Language Server',
            status: lsp.state === 'ready' ? 'running' : 'stopped',
        },
        {
            name: 'MCP Server',
            status: mcp.state === 'ready' ? 'running' : 'stopped',
        },
    ];
}

export interface DiagnosticsInput {
    /** Workspace the snapshot is about, or undefined when none is open. */
    readonly workspacePath?: string;
    /** Interpreter navita resolved, or undefined when none was found. */
    readonly environment?: EnvironmentSummary;
    readonly mcp: McpStatus;
    readonly lsp: ServerStatus;
}

/**
 * Gather the diagnostics payload.
 *
 * Versions come from the tools themselves rather than from a cache, so the page
 * reflects the environment navita actually runs commands in. A tool that is
 * missing or fails reports as absent instead of failing the whole page.
 * @param input - Workspace, environment and server state to report.
 * @returns The payload the shared view renders.
 */
export async function gatherDiagnostics(input: DiagnosticsInput): Promise<DiagnosticsPayload> {
    const commands = CommandService.getInstance();
    const [ansible, adt] = await Promise.all([
        commands.runTool('ansible', ['--version']).catch(() => null),
        commands.runTool('adt', ['--version']).catch(() => null),
    ]);

    const ansibleVersion =
        ansible !== null && ansible.exitCode === 0
            ? parseAnsibleVersion(ansible.stdout)
            : undefined;
    const tools = adt !== null && adt.exitCode === 0 ? parseAdtTools(adt.stdout) : [];
    const environment = input.environment;

    return {
        ...(input.workspacePath === undefined ? {} : { workspacePath: input.workspacePath }),
        python: {
            ...(environment === undefined
                ? {}
                : { envName: environment.name, path: environment.pythonPath }),
            ...(environment?.version === undefined ? {} : { version: environment.version }),
        },
        ansible: ansibleVersion === undefined ? {} : { version: ansibleVersion },
        services: describeServices(input.mcp, input.lsp),
        tools,
    };
}
