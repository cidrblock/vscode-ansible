/**
 * Supervision of the two stdio servers navita ships.
 *
 * Both are ordinary stdio programs: the MCP server speaks newline-delimited
 * JSON-RPC, the language server speaks Content-Length framed LSP. navita runs
 * them with its own Electron binary acting as Node (`ELECTRON_RUN_AS_NODE=1`),
 * so the app never needs a system Node install.
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';

import type { McpStatus, ServerStatus } from '../shared/ipc';

export interface SpawnSpec {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: NodeJS.ProcessEnv;
}

export interface ProbeOptions {
    readonly timeoutMs?: number;
}

export interface McpToolSummary {
    readonly name: string;
    readonly description?: string;
}

export interface McpProbeResult {
    readonly toolCount: number;
    readonly toolNames: readonly string[];
    readonly tools: readonly McpToolSummary[];
}

export interface LspProbeResult {
    readonly serverName?: string;
    readonly capabilities: Record<string, unknown>;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 *
 * @param execPath - Executable that runs the script (Electron or Node).
 * @returns True when the executable looks like Electron.
 */
function isElectronBinary(execPath: string): boolean {
    return /(^|[\\/])electron(\.exe)?$/i.test(execPath);
}

/**
 * Environment a harness-spawned or navita-spawned server needs for a workspace.
 * @param workspacePath - Absolute workspace path handed to the server.
 * @param skillSources - Skill source directories exposed to the server.
 * @param base - Base environment; defaults to the current process environment.
 * @param binDir - Python environment bin dir to put first on PATH.
 * @returns Environment map for the child process.
 */
export function serverEnv(
    workspacePath: string | null,
    skillSources: readonly string[],
    base: NodeJS.ProcessEnv = process.env,
    binDir: string | null = null,
): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...base };
    if (workspacePath !== null) {
        env.ANSIBLE_ENV_WORKSPACE = workspacePath;
    }
    if (binDir !== null) {
        // Servers are separate processes, so the environment navita picked
        // reaches them through PATH rather than a resolver.
        const currentPath = env.PATH ?? '';
        env.PATH = currentPath === '' ? binDir : `${binDir}${path.delimiter}${currentPath}`;
    }
    if (skillSources.length > 0) {
        env.ANSIBLE_SKILL_SOURCES = JSON.stringify(
            skillSources.map((sourcePath) => ({ type: 'local', path: sourcePath })),
        );
    }
    return env;
}

/**
 * Build the spawn spec for a bundled server script.
 * @param execPath - Executable that runs the script (Electron or Node).
 * @param scriptPath - Absolute path to the bundled server entry.
 * @param env - Environment for the child process.
 * @param args - Extra arguments, for example --stdio for the language server.
 * @returns Command, argument list and environment for spawn.
 */
export function serverSpawnSpec(
    execPath: string,
    scriptPath: string,
    env: NodeJS.ProcessEnv,
    args: readonly string[] = [],
): SpawnSpec {
    const spawnEnv: NodeJS.ProcessEnv = { ...env };
    if (isElectronBinary(execPath)) {
        spawnEnv.ELECTRON_RUN_AS_NODE = '1';
    }
    return { command: execPath, args: [scriptPath, ...args], env: spawnEnv };
}

/**
 * Run a stdio JSON-RPC exchange to completion, then terminate the child.
 * @param spec - Command, arguments and environment for the server.
 * @param cwd - Working directory, which also acts as the default workspace.
 * @param timeoutMs - How long to wait before killing the child and failing.
 * @param handle - Called once handlers are attached; sends the first request.
 * @param onLine - Called for each complete newline-delimited message.
 * @returns The result reported through finish.
 */
function runStdio(
    spec: SpawnSpec,
    cwd: string,
    timeoutMs: number,
    handle: (ctx: StdioContext) => void,
    onLine: (line: string, ctx: StdioContext) => void,
): Promise<McpProbeResult> {
    return new Promise<McpProbeResult>((resolve, reject) => {
        const child = spawn(spec.command, [...spec.args], {
            cwd,
            env: spec.env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let settled = false;
        const ctx: StdioContext = {
            send: (payload) => {
                child.stdin.write(payload);
            },
            finish: (value) => {
                settled = true;
                clearTimeout(timer);
                child.kill();
                resolve(value);
            },
        };
        let buffer = '';
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill();
                reject(new Error(`timed out after ${String(timeoutMs)}ms`));
            }
        }, timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            buffer += chunk;
            let index = buffer.indexOf('\n');
            while (index >= 0) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                if (line.length > 0) {
                    onLine(line, ctx);
                }
                index = buffer.indexOf('\n');
            }
        });
        child.on('error', (error: Error) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        });
        child.on('exit', (code: number | null) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(new Error(`server exited with code ${String(code)}`));
            }
        });
        handle(ctx);
    });
}

interface StdioContext {
    send(payload: string): void;
    finish(value: McpProbeResult): void;
}

/**
 * Ask a bundled MCP server for its tool list.
 * @param spec - Command, arguments and environment for the server.
 * @param cwd - Working directory, which also acts as the default workspace.
 * @param options - Probe options; the timeout falls back to the default.
 * @returns Tool count and names reported by the tool listing.
 */
export function probeMcpServer(
    spec: SpawnSpec,
    cwd: string,
    options: ProbeOptions = {},
): Promise<McpProbeResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return runStdio(
        spec,
        cwd,
        timeoutMs,
        (ctx) => {
            ctx.send(
                `${JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: { name: 'navita', version: '0.0.1' },
                    },
                })}\n`,
            );
        },
        (line, ctx) => {
            let message: {
                id?: unknown;
                result?: { tools?: { name?: unknown; description?: unknown }[] };
            };
            try {
                message = JSON.parse(line) as typeof message;
            } catch {
                return;
            }
            if (message.id === 1) {
                ctx.send(
                    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
                );
                ctx.send(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
                return;
            }
            if (message.id === 2) {
                const tools = message.result?.tools ?? [];
                const summaries: McpToolSummary[] = [];
                for (const tool of tools) {
                    if (typeof tool.name !== 'string') {
                        continue;
                    }
                    summaries.push(
                        typeof tool.description === 'string'
                            ? { name: tool.name, description: tool.description }
                            : { name: tool.name },
                    );
                }
                const toolNames = summaries.map((tool) => tool.name);
                ctx.finish({ toolCount: toolNames.length, toolNames, tools: summaries });
            }
        },
    );
}

/**
 *
 * @param body - JSON-RPC message to frame.
 * @returns Content-Length header plus the JSON body.
 */
function lspPayload(body: unknown): string {
    const json = JSON.stringify(body);
    return `Content-Length: ${String(Buffer.byteLength(json, 'utf8'))}\r\n\r\n${json}`;
}

/**
 * Handshake with a bundled language server and return its capabilities.
 * @param spec - Command, arguments and environment for the server.
 * @param workspacePath - Absolute workspace path handed to the server.
 * @param options - Probe options; the timeout falls back to the default.
 * @returns Server name and advertised capabilities.
 */
export function probeLanguageServer(
    spec: SpawnSpec,
    workspacePath: string,
    options: ProbeOptions = {},
): Promise<LspProbeResult> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return new Promise<LspProbeResult>((resolve, reject) => {
        const child = spawn(spec.command, [...spec.args], {
            cwd: workspacePath,
            env: spec.env,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let buffer = '';
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                child.kill();
                reject(new Error(`language server timed out after ${String(timeoutMs)}ms`));
            }
        }, timeoutMs);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            buffer += chunk;
            const headerEnd = buffer.indexOf('\r\n\r\n');
            if (headerEnd < 0) {
                return;
            }
            const header = buffer.slice(0, headerEnd);
            const match = /Content-Length:\s*(\d+)/i.exec(header);
            if (match === null) {
                return;
            }
            const length = Number(match[1]);
            const bodyStart = headerEnd + 4;
            if (buffer.length - bodyStart < length) {
                return;
            }
            const body = buffer.slice(bodyStart, bodyStart + length);
            buffer = buffer.slice(bodyStart + length);
            let message: {
                id?: unknown;
                result?: { capabilities?: Record<string, unknown>; serverInfo?: { name?: string } };
            };
            try {
                message = JSON.parse(body) as typeof message;
            } catch {
                return;
            }
            if (message.id !== 1 || settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({
                serverName: message.result?.serverInfo?.name,
                capabilities: message.result?.capabilities ?? {},
            });
            child.stdin.write(lspPayload({ jsonrpc: '2.0', id: 2, method: 'shutdown' }));
            child.stdin.end(lspPayload({ jsonrpc: '2.0', method: 'exit' }));
            setTimeout(() => {
                child.kill();
            }, 500).unref();
        });
        child.on('error', (error: Error) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(error);
            }
        });
        const rootUri = `file://${workspacePath}`;
        child.stdin.write(
            lspPayload({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    processId: process.pid,
                    rootUri,
                    workspaceFolders: [{ uri: rootUri, name: path.basename(workspacePath) }],
                    capabilities: { workspace: { workspaceFolders: true } },
                },
            }),
        );
    });
}

/** Result of probing both servers for one workspace. */
export interface ServerStatuses {
    readonly mcp: McpStatus;
    readonly lsp: ServerStatus;
}

/**
 *
 * @param reason - Why the action is unavailable, shown to the user.
 * @returns Error status with a human-readable detail string.
 */
function failureStatus(reason: unknown): ServerStatus {
    const detail = reason instanceof Error ? reason.message : 'failed to start';
    return { state: 'error', detail };
}

/**
 * Probe the MCP server and the language server for a workspace, in parallel.
 * @param mcpSpec - Spawn spec for the bundled MCP server.
 * @param lspSpec - Spawn spec for the bundled language server.
 * @param workspacePath - Absolute workspace path handed to the server.
 * @returns Status for each server; never throws.
 */
export async function probeServers(
    mcpSpec: SpawnSpec,
    lspSpec: SpawnSpec,
    workspacePath: string,
): Promise<ServerStatuses> {
    const [mcpResult, lspResult] = await Promise.allSettled([
        probeMcpServer(mcpSpec, workspacePath),
        probeLanguageServer(lspSpec, workspacePath),
    ]);
    const mcp: McpStatus =
        mcpResult.status === 'fulfilled'
            ? {
                  state: 'ready',
                  toolCount: mcpResult.value.toolCount,
                  detail: `${String(mcpResult.value.toolCount)} tools`,
              }
            : failureStatus(mcpResult.reason);
    const lsp: ServerStatus =
        lspResult.status === 'fulfilled'
            ? { state: 'ready', detail: lspResult.value.serverName ?? 'language server' }
            : failureStatus(lspResult.reason);
    return { mcp, lsp };
}
