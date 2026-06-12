/**
 * Abbenay Daemon Client for Ansible Navita (Electron main process).
 *
 * Ported from the VS Code extension's DaemonClient without vscode imports.
 * Uses the same daemon discovery pattern: PATH first, then bundled SEA binary.
 *
 * The daemon communicates over a Unix Domain Socket using gRPC.
 * Runtime paths mirror the daemon's own path logic:
 *   Linux:   $XDG_RUNTIME_DIR/abbenay → /run/user/<uid>/abbenay
 *   macOS:   os.tmpdir()/abbenay
 */

import { createChannel, createClient, type Channel } from 'nice-grpc';
import * as proto from './proto/abbenay/v1/service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AbbenayStatus, AbbenayConnectionState } from '../shared/types';

const APP_NAME = 'abbenay';

function getRuntimeDir(): string {
    if (process.env.XDG_RUNTIME_DIR) {
        return path.join(process.env.XDG_RUNTIME_DIR, APP_NAME);
    }
    if (process.platform === 'darwin') {
        return path.join(os.tmpdir(), APP_NAME);
    }
    if (process.platform !== 'win32') {
        try {
            const uid = os.userInfo().uid;
            return path.join(`/run/user/${uid}`, APP_NAME);
        } catch { /* sandboxed */ }
    }
    return path.join('/tmp', APP_NAME);
}

const RUNTIME_DIR = getRuntimeDir();
const PID_FILE = path.join(RUNTIME_DIR, `${APP_NAME}.pid`);
const SOCKET_FILE = process.platform === 'win32'
    ? '\\\\.\\pipe\\abbenay-daemon'
    : path.join(RUNTIME_DIR, 'daemon.sock');
const DEFAULT_ADDRESS = `unix://${SOCKET_FILE}`;

function log(msg: string): void {
    console.log(`[abbenay] ${msg}`);
}

export function isDaemonRunning(): boolean {
    try {
        if (!fs.existsSync(PID_FILE)) return false;
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        if (isNaN(pid)) return false;
        process.kill(pid, 0);
        return fs.existsSync(SOCKET_FILE);
    } catch {
        return false;
    }
}

export class AbbenayClient {
    private channel: Channel | null = null;
    private client: proto.AbbenayClient | null = null;
    private clientId: string | null = null;
    private state: AbbenayConnectionState = 'disconnected';
    private lastError: string | null = null;

    async connect(options: { autoStart?: boolean; timeout?: number } = {}): Promise<void> {
        if (this.channel) return;

        const { autoStart = true, timeout = 15000 } = options;
        this.state = 'connecting';

        try {
            if (!isDaemonRunning()) {
                if (autoStart) {
                    log('Daemon not running, attempting to start...');
                    await this.startDaemon();
                    await this.waitForDaemon(timeout);
                } else {
                    throw new Error(`Daemon not running. Expected socket at ${SOCKET_FILE}`);
                }
            }

            log(`Creating gRPC channel to ${DEFAULT_ADDRESS}`);
            this.channel = createChannel(DEFAULT_ADDRESS);
            this.client = createClient(proto.AbbenayDefinition, this.channel);
            this.state = 'connected';
            this.lastError = null;
        } catch (err) {
            this.state = 'error';
            this.lastError = err instanceof Error ? err.message : String(err);
            throw err;
        }
    }

    private async startDaemon(): Promise<void> {
        const { spawn } = await import('child_process');

        if (!fs.existsSync(RUNTIME_DIR)) {
            fs.mkdirSync(RUNTIME_DIR, { recursive: true, mode: 0o700 });
        }

        const { cmd, args } = await this.findDaemonCommand();
        log(`Spawning: ${cmd} ${[...args, 'daemon'].join(' ')}`);

        const logPath = path.join(os.tmpdir(), 'abbenay-daemon.log');
        const logFd = fs.openSync(logPath, 'a');

        const daemon = spawn(cmd, [...args, 'daemon'], {
            detached: true,
            stdio: ['ignore', logFd, logFd],
            env: {
                ...process.env,
                ABBENAY_SOCKET: SOCKET_FILE,
                ABBENAY_PID_FILE: PID_FILE,
            },
        });
        log(`Spawned PID: ${daemon.pid}`);
        daemon.unref();
    }

    /**
     * Priority:
     *   1) `abbenay` in PATH
     *   2) Bundled SEA binary next to the Electron executable
     */
    private async findDaemonCommand(): Promise<{ cmd: string; args: string[] }> {
        const { execSync } = await import('child_process');

        try {
            const which = process.platform === 'win32' ? 'where abbenay' : 'which abbenay';
            const result = execSync(which, { encoding: 'utf-8' }).trim().split('\n')[0];
            if (result && fs.existsSync(result)) {
                log(`Found abbenay in PATH: ${result}`);
                return { cmd: result, args: [] };
            }
        } catch {
            log('abbenay not found in PATH');
        }

        const platform = process.platform === 'win32' ? 'win32'
            : process.platform === 'darwin' ? 'darwin' : 'linux';
        const arch = process.arch;

        const candidates = [
            path.join(__dirname, '..', 'bin', `abbenay-daemon-${platform}-${arch}`),
            path.join(__dirname, '..', '..', 'bin', `abbenay-daemon-${platform}-${arch}`),
            path.join(__dirname, '..', '..', '..', '..', 'resources', 'bin', `abbenay-daemon-${platform}-${arch}`),
        ];

        for (const seaBinary of candidates) {
            if (fs.existsSync(seaBinary)) {
                log(`Found SEA binary: ${seaBinary}`);
                return { cmd: seaBinary, args: [] };
            }
        }

        throw new Error(
            'Abbenay daemon binary not found. Install abbenay globally or ensure the binary is bundled.',
        );
    }

    private async waitForDaemon(timeout: number): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (isDaemonRunning()) {
                await new Promise((r) => setTimeout(r, 100));
                return;
            }
            await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error(`Daemon did not start within ${timeout}ms`);
    }

    isConnected(): boolean {
        return this.channel !== null && this.client !== null;
    }

    getConnectionState(): AbbenayConnectionState {
        return this.state;
    }

    getRawClient(): proto.AbbenayClient {
        if (!this.client) throw new Error('Not connected to Abbenay daemon.');
        return this.client;
    }

    async register(workspacePath: string): Promise<string> {
        const client = this.getRawClient();
        const response = await client.register({
            client: {
                clientType: proto.ClientType.CLIENT_TYPE_NODEJS,
                clientId: '',
                user: process.env.USER || 'unknown',
            },
            isSpawner: false,
            workspacePath,
            workspacePaths: workspacePath ? [workspacePath] : [],
        });
        this.clientId = response.clientId;
        log(`Registered with client ID: ${this.clientId}`);
        return this.clientId;
    }

    async getStatus(): Promise<AbbenayStatus> {
        if (!this.isConnected()) {
            return { state: this.state, error: this.lastError ?? undefined };
        }
        try {
            const status = await this.getRawClient().getStatus({});
            return {
                state: 'connected',
                version: status.version,
                connectedClients: status.connectedClients,
            };
        } catch (err) {
            return {
                state: 'error',
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const resp = await this.getRawClient().healthCheck({});
            return resp.healthy;
        } catch {
            return false;
        }
    }

    async listModels(): Promise<proto.Model[]> {
        const resp = await this.getRawClient().listModels({});
        return resp.models;
    }

    async startWebServer(port = 0): Promise<{ url: string; alreadyRunning: boolean }> {
        const resp = await this.getRawClient().startWebServer({ port });
        return { url: resp.url, alreadyRunning: resp.alreadyRunning };
    }

    /**
     * Register an MCP server with the Abbenay daemon so it can use
     * the tools during chat. Supports stdio and http/sse transports.
     */
    async registerMcpServer(opts: {
        serverId: string;
        transport: { type: 'stdio'; command: string; args: string[]; env?: Record<string, string> }
            | { type: 'http' | 'sse'; url: string; headers?: Record<string, string> };
        toolFilter?: string[];
    }): Promise<void> {
        const transport: proto.DeepPartial<proto.McpTransport> = {
            type: opts.transport.type,
            args: [],
            headers: {},
            env: {},
        };
        if (opts.transport.type === 'stdio') {
            transport.command = opts.transport.command;
            transport.args = opts.transport.args;
            transport.env = opts.transport.env ?? {};
        } else {
            transport.url = opts.transport.url;
            transport.headers = opts.transport.headers ?? {};
        }

        await this.getRawClient().registerMcpServer({
            serverId: opts.serverId,
            transport: transport as proto.McpTransport,
            toolFilter: opts.toolFilter ?? [],
        });
        log(`Registered MCP server: ${opts.serverId}`);
    }

    async unregisterMcpServer(serverId: string): Promise<void> {
        await this.getRawClient().unregisterMcpServer({ serverId });
        log(`Unregistered MCP server: ${serverId}`);
    }

    chat(request: proto.DeepPartial<proto.ChatRequest>): AsyncIterable<proto.ChatChunk> {
        return this.getRawClient().chat(request);
    }

    sessionChat(request: proto.DeepPartial<proto.SessionChatRequest>): AsyncIterable<proto.ChatChunk> {
        return this.getRawClient().sessionChat(request);
    }

    async createSession(model: string, topic?: string): Promise<proto.Session> {
        return this.getRawClient().createSession({ model, topic, metadata: {} });
    }

    async listSessions(): Promise<proto.SessionSummary[]> {
        const resp = await this.getRawClient().listSessions({});
        return resp.sessions;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.getRawClient().deleteSession({ sessionId });
    }

    async close(): Promise<void> {
        if (this.clientId && this.client) {
            try { await this.client.unregister({ clientId: this.clientId }); } catch { /* ignore */ }
            this.clientId = null;
        }
        if (this.channel) {
            this.channel.close();
            this.channel = null;
            this.client = null;
        }
        this.state = 'disconnected';
    }
}

let _instance: AbbenayClient | null = null;

export function getAbbenayClient(): AbbenayClient {
    if (!_instance) _instance = new AbbenayClient();
    return _instance;
}

export function disposeAbbenayClient(): void {
    if (_instance) {
        _instance.close().catch(() => {});
        _instance = null;
    }
}
