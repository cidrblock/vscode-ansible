/**
 * Playbook Runner — spawns ansible-playbook and streams progress events.
 *
 * Uses the same Unix domain socket + callback plugin pattern as the
 * VS Code PlaybookProgressPanel, but decoupled from vscode APIs.
 */

import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { getCommandService } from '@ansible/core';
import type { PlaybookConfig, ProgressEvent } from '../shared/types';

export interface PlaybookRunnerOptions {
    playbookPath: string;
    workspaceRoot: string;
    callbackPluginsPath: string;
    config: PlaybookConfig;
    onEvent: (event: ProgressEvent) => void;
    onComplete: () => void;
    log: (message: string) => void;
}

export class PlaybookRunner {
    private _opts: PlaybookRunnerOptions;
    private _socketServer: net.Server | null = null;
    private _socketPath: string | null = null;
    private _process: ChildProcess | null = null;

    constructor(opts: PlaybookRunnerOptions) {
        this._opts = opts;
    }

    async start(): Promise<void> {
        await this._createSocketServer();
        await this._spawnPlaybook();
    }

    stop(): void {
        if (this._process && !this._process.killed) {
            this._process.kill('SIGTERM');
            this._process = null;
        }
        this._cleanupSocket();
    }

    private async _createSocketServer(): Promise<void> {
        this._socketPath = path.join(
            os.tmpdir(),
            `ansible-navita-${String(Date.now())}-${String(Math.random()).slice(2, 8)}.sock`,
        );

        try {
            if (fs.existsSync(this._socketPath)) {
                fs.unlinkSync(this._socketPath);
            }
        } catch {
            // ignore
        }

        return new Promise((resolve, reject) => {
            this._socketServer = net.createServer((socket) => {
                let buffer = '';

                socket.on('data', (data) => {
                    buffer += data.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop() ?? '';

                    for (const line of lines) {
                        if (line.trim()) {
                            try {
                                const event = JSON.parse(line) as ProgressEvent;
                                this._opts.onEvent(event);

                                if (event.type === 'playbook_complete') {
                                    this._opts.onComplete();
                                }
                            } catch (e) {
                                this._opts.log(
                                    `PlaybookRunner: parse error: ${e instanceof Error ? e.message : String(e)}`,
                                );
                            }
                        }
                    }
                });

                socket.on('error', (err) => {
                    this._opts.log(
                        `PlaybookRunner: socket error: ${err instanceof Error ? err.message : String(err)}`,
                    );
                });
            });

            this._socketServer.on('error', (err) => {
                this._opts.log(
                    `PlaybookRunner: server error: ${err instanceof Error ? err.message : String(err)}`,
                );
                reject(err);
            });

            this._socketServer.listen(this._socketPath, () => {
                this._opts.log(`PlaybookRunner: listening on ${this._socketPath ?? ''}`);
                resolve();
            });
        });
    }

    private async _spawnPlaybook(): Promise<void> {
        const commandService = getCommandService();
        const ansiblePlaybook = await commandService.getToolPath('ansible-playbook');
        const executable = ansiblePlaybook ?? 'ansible-playbook';

        const args = [this._opts.playbookPath];
        const { config } = this._opts;

        if (config.extraVars) {
            for (const [key, value] of Object.entries(config.extraVars)) {
                args.push('-e', `${key}=${value}`);
            }
        }
        if (config.limit) args.push('--limit', config.limit);
        if (config.tags) args.push('--tags', config.tags);
        if (config.skipTags) args.push('--skip-tags', config.skipTags);
        if (config.verbosity) {
            args.push('-' + 'v'.repeat(Math.min(config.verbosity, 6)));
        }
        if (config.check) args.push('--check');
        if (config.diff) args.push('--diff');

        const env = {
            ...process.env,
            ANSIBLE_CALLBACK_PLUGINS: this._opts.callbackPluginsPath,
            ANSIBLE_CALLBACKS_ENABLED: 'vscode_progress',
            ANSIBLE_ENV_SOCKET: this._socketPath ?? '',
        };

        this._opts.log(`PlaybookRunner: ${executable} ${args.join(' ')}`);

        this._process = spawn(executable, args, {
            cwd: this._opts.workspaceRoot,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this._process.stdout?.on('data', (data: Buffer) => {
            this._opts.log(`[ansible-playbook stdout] ${data.toString().trimEnd()}`);
        });

        this._process.stderr?.on('data', (data: Buffer) => {
            this._opts.log(`[ansible-playbook stderr] ${data.toString().trimEnd()}`);
        });

        this._process.on('close', (code) => {
            this._opts.log(`PlaybookRunner: process exited with code ${String(code)}`);
            this._cleanupSocket();
        });

        this._process.on('error', (err) => {
            this._opts.log(
                `PlaybookRunner: spawn error: ${err instanceof Error ? err.message : String(err)}`,
            );
            this._cleanupSocket();
        });
    }

    private _cleanupSocket(): void {
        if (this._socketServer) {
            this._socketServer.close();
            this._socketServer = null;
        }
        if (this._socketPath) {
            try {
                fs.unlinkSync(this._socketPath);
            } catch {
                // ignore
            }
            this._socketPath = null;
        }
    }
}
