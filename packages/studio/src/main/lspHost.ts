/**
 * LSP Host — manages the Ansible language server as a child process.
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { loadSettings } from './settingsStore';

let lspProcess: ChildProcess | null = null;

function findLspBinary(): string | null {
    const settings = loadSettings();
    if (settings.lspBinaryPath) {
        if (fs.existsSync(settings.lspBinaryPath)) return settings.lspBinaryPath;
        console.log(`[lspHost] Configured LSP path not found: ${settings.lspBinaryPath}`);
    }

    const candidates = [
        path.join(__dirname, '..', '..', '..', '..', 'packages', 'language-server', 'out', 'cli.js'),
        path.join(__dirname, '..', 'packages', 'language-server', 'out', 'cli.js'),
        path.join(process.cwd(), 'packages', 'language-server', 'out', 'cli.js'),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

export function startLsp(): boolean {
    if (lspProcess) return true;

    const settings = loadSettings();
    if (!settings.lspAutoStart) {
        console.log('[lspHost] LSP auto-start disabled');
        return false;
    }

    const lspPath = findLspBinary();
    if (!lspPath) {
        console.log('[lspHost] Language server binary not found');
        return false;
    }

    try {
        lspProcess = spawn(process.execPath, [lspPath, '--stdio'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        lspProcess.stderr?.on('data', (data: Buffer) => {
            console.log(`[lspHost] ${data.toString().trim()}`);
        });

        lspProcess.on('exit', (code) => {
            console.log(`[lspHost] Language server exited with code ${String(code)}`);
            lspProcess = null;
        });

        console.log(`[lspHost] Language server started (pid=${String(lspProcess.pid)})`);
        return true;
    } catch (err) {
        console.log(`[lspHost] Failed to start: ${err instanceof Error ? err.message : String(err)}`);
        return false;
    }
}

export function stopLsp(): void {
    if (lspProcess) {
        lspProcess.kill();
        lspProcess = null;
        console.log('[lspHost] Language server stopped');
    }
}

export function restartLsp(): void {
    stopLsp();
    startLsp();
}

export function getLspStatus(): { running: boolean; pid: number | null } {
    const running = lspProcess !== null && lspProcess.exitCode === null;
    return { running, pid: running ? (lspProcess?.pid ?? null) : null };
}
