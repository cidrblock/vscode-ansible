#!/usr/bin/env node
// @ts-check
/**
 * navita build: esbuild for the main process, preload and the two stdio servers;
 * Vite for the renderer. Everything lands in dist/ so the packaged app can ship
 * the servers next to the UI without a separate Node install.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(here, '..');
const REPO = path.resolve(PKG, '..', '..');
const DIST = path.join(PKG, 'dist');
const watch = process.argv.includes('--watch');

const alias = {
    '@ansible/common': path.join(REPO, 'packages', 'common', 'src', 'index.ts'),
    '@ansible/developer-services': path.join(REPO, 'packages', 'services', 'src', 'index.ts'),
};

/** @type {import('esbuild').BuildOptions} */
const base = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    sourcemap: true,
    logLevel: 'info',
    alias,
};

const targets = [
    {
        entryPoints: [path.join(PKG, 'src', 'main', 'index.ts')],
        outfile: path.join(DIST, 'main', 'index.js'),
        external: ['electron', 'vscode'],
    },
    {
        entryPoints: [path.join(PKG, 'src', 'preload', 'index.ts')],
        outfile: path.join(DIST, 'preload', 'index.js'),
        external: ['electron'],
    },
    {
        entryPoints: [path.join(REPO, 'packages', 'mcp-server', 'src', 'server.ts')],
        outfile: path.join(DIST, 'servers', 'mcp-server.js'),
        external: ['vscode'],
    },
    {
        entryPoints: [path.join(REPO, 'packages', 'language-server', 'src', 'cli.ts')],
        outfile: path.join(DIST, 'servers', 'language-server.js'),
        external: ['vscode'],
    },
];

function copySkills() {
    const source = path.join(REPO, 'skills');
    const destination = path.join(DIST, 'skills');
    if (!fs.existsSync(source)) {
        return;
    }
    fs.cpSync(source, destination, { recursive: true });
}

/**
 * Copy the introspection scripts ExecutionEnvService mounts into a container.
 *
 * The service looks for `data/` next to its own bundle, and dist/data is one of
 * its candidates from both dist/main and dist/verify. Without this, opening an
 * execution environment fails with "Vendored introspection scripts not found".
 */
function copyServiceData() {
    const source = path.join(REPO, 'packages', 'services', 'src', 'data');
    const destination = path.join(DIST, 'data');
    if (!fs.existsSync(source)) {
        throw new Error(`missing service data directory: ${source}`);
    }
    fs.cpSync(source, destination, { recursive: true });
}

async function buildRenderer() {
    const { build } = await import('vite');
    await build({
        root: path.join(PKG, 'src', 'renderer'),
        base: './',
        esbuild: { jsx: 'automatic' },
        resolve: {
            alias: [
                // Same reason as the esbuild aliases above: consume workspace
                // sources, not stale build output.
                { find: /^@ansible\/ui$/, replacement: path.join(REPO, 'packages', 'ui', 'src', 'index.ts') },
                {
                    find: /^@ansible\/common$/,
                    replacement: path.join(REPO, 'packages', 'common', 'src', 'index.ts'),
                },
            ],
        },
        logLevel: 'info',
        build: {
            outDir: path.relative(path.join(PKG, 'src', 'renderer'), path.join(DIST, 'renderer')),
            emptyOutDir: true,
            sourcemap: true,
            watch: watch ? {} : null,
        },
    });
}

const contexts = [];
for (const target of targets) {
    const options = { ...base, entryPoints: target.entryPoints, outfile: target.outfile, external: target.external };
    if (watch) {
        contexts.push(await esbuild.context(options));
    } else {
        await esbuild.build(options);
    }
}
if (watch) {
    await Promise.all(contexts.map((context) => context.watch()));
}
copySkills();
copyServiceData();
await buildRenderer();
