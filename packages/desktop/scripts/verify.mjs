#!/usr/bin/env node
// @ts-check
/**
 * Headless check: prove the bundled stdio servers work without a display.
 * Exits non-zero if either handshake fails.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
const MCP = path.join(DIST, 'servers', 'mcp-server.js');
const LSP = path.join(DIST, 'servers', 'language-server.js');
const WORKSPACE = process.cwd();
const PKG = path.resolve(here, '..');
const REPO = path.resolve(PKG, '..', '..');

function fail(message) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
}

function probeMcp() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [MCP], {
            cwd: WORKSPACE,
            env: { ...process.env, ANSIBLE_ENV_WORKSPACE: WORKSPACE },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let buffer = '';
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('MCP server timed out'));
        }, 20000);
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            buffer += chunk;
            let index = buffer.indexOf('\n');
            while (index >= 0) {
                const line = buffer.slice(0, index).trim();
                buffer = buffer.slice(index + 1);
                index = buffer.indexOf('\n');
                if (line === '') continue;
                let message;
                try {
                    message = JSON.parse(line);
                } catch {
                    continue;
                }
                if (message.id === 1) {
                    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
                    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`);
                } else if (message.id === 2) {
                    clearTimeout(timer);
                    child.kill();
                    resolve(message.result?.tools?.map((tool) => tool.name) ?? []);
                    return;
                }
            }
        });
        child.on('error', reject);
        child.stdin.write(
            `${JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'navita-verify', version: '0.0.1' },
                },
            })}\n`,
        );
    });
}

function probeLsp() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [LSP, '--stdio'], {
            cwd: WORKSPACE,
            env: { ...process.env, ANSIBLE_ENV_WORKSPACE: WORKSPACE },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error('language server timed out'));
        }, 20000);
        let buffer = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            buffer += chunk;
            const separator = buffer.indexOf('\r\n\r\n');
            if (separator < 0) return;
            const length = Number(/Content-Length:\s*(\d+)/i.exec(buffer.slice(0, separator))?.[1] ?? 0);
            const start = separator + 4;
            if (buffer.length - start < length) return;
            const message = JSON.parse(buffer.slice(start, start + length));
            if (message.id !== 1) return;
            clearTimeout(timer);
            child.kill();
            resolve(message.result ?? {});
        });
        child.on('error', reject);
        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                processId: process.pid,
                rootUri: `file://${WORKSPACE}`,
                workspaceFolders: [{ uri: `file://${WORKSPACE}`, name: path.basename(WORKSPACE) }],
                capabilities: { workspace: { workspaceFolders: true } },
            },
        });
        child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    });
}


/**
 * Bundle a main-process view module for Node and report what it discovers.
 * Bundling keeps the check honest: it exercises the same code the main
 * process runs, without needing an Electron display.
 * @returns Package count and state.
 */
async function bundleModule(entry, name) {
    const esbuild = await import('esbuild');
    const outfile = path.join(DIST, 'verify', `${name}.cjs`);
    fs.mkdirSync(path.dirname(outfile), { recursive: true });
    await esbuild.build({
        entryPoints: [path.join(PKG, 'src', 'main', entry)],
        outfile,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        logLevel: 'silent',
        external: ['vscode'],
        alias: {
            '@ansible/common': path.join(REPO, 'packages', 'common', 'src', 'index.ts'),
            '@ansible/developer-services': path.join(
                REPO,
                'packages',
                'services',
                'src',
                'index.ts',
            ),
        },
    });
    return createRequire(import.meta.url)(outfile);
}

for (const script of [MCP, LSP]) {
    if (!fs.existsSync(script)) {
        fail(`missing build artifact ${path.relative(DIST, script)} — run pnpm build first`);
    }
}

if (process.exitCode !== 1) {
    const [tools, lsp] = await Promise.all([probeMcp(), probeLsp()]);
    console.log(`PASS  mcp-server      ${tools.length} tools (${tools.slice(0, 3).join(', ')}…)`);
    const capabilities = Object.keys(lsp.capabilities ?? {});
    console.log(`PASS  language-server capabilities: ${capabilities.join(', ') || '(none)'}`);

    const devToolsModule = await bundleModule('devtools.ts', 'devtools');
    const devTools = await devToolsModule.loadDevTools();
    if (devTools.state === 'error') {
        fail(`dev-tools discovery: ${devTools.detail}`);
    } else if (devTools.packages.length === 0) {
        console.log('SKIP  dev-tools        no ansible-dev-tools on PATH');
    } else {
        const names = devTools.packages.slice(0, 3).map((entry) => entry.name);
        console.log(`PASS  dev-tools        ${devTools.packages.length} packages (${names.join(', ')}…)`);
    }

    const environmentsModule = await bundleModule('environments.ts', 'environments');
    const environments = await environmentsModule.loadEnvironments(WORKSPACE);
    if (environments.state === 'error') {
        fail(`environments discovery: ${environments.detail}`);
    } else {
        const count = environments.groups.reduce((total, group) => total + group.environments.length, 0);
        const labels = environments.groups.map((group) => group.label);
        console.log(`PASS  environments     ${count} across ${labels.join(', ') || '(none)'}`);
    }
}
