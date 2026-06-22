#!/usr/bin/env node
// @ts-check
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');
const navitaOnly = process.argv.includes('--navita-only');

/** @type {esbuild.BuildOptions} */
const shared = {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'es2022',
    sourcemap: !production,
    minify: production,
    metafile: true,
    logLevel: 'info',
    outdir: path.join(ROOT, 'dist'),
};

/** @type {esbuild.BuildOptions} */
const webviewShared = {
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: !production,
    minify: production,
    metafile: true,
    logLevel: 'info',
    outdir: path.join(ROOT, 'dist'),
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: { '.css': 'text' },
};

/** @type {esbuild.BuildOptions[]} */
const extensionTargets = [
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'src', 'extension.ts')],
        outfile: path.join(ROOT, 'dist', 'extension.js'),
        outdir: undefined,
        external: ['vscode'],
        alias: {
            '@src': path.join(ROOT, 'src'),
            '@ansible/lightspeed': path.join(ROOT, 'packages', 'lightspeed', 'src'),
            '@ansible/services': path.join(ROOT, 'packages', 'services', 'src'),
            '@ansible/common': path.join(ROOT, 'packages', 'common', 'src'),
        },
    },
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'packages', 'language-server', 'src', 'cli.ts')],
        outfile: path.join(ROOT, 'dist', 'language-server.js'),
        outdir: undefined,
        alias: {
            '@src': path.join(ROOT, 'packages', 'language-server', 'src'),
            '@ansible/services': path.join(ROOT, 'packages', 'services', 'src'),
            '@ansible/common': path.join(ROOT, 'packages', 'common', 'src'),
        },
    },
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'packages', 'mcp-server', 'src', 'server.ts')],
        outfile: path.join(ROOT, 'dist', 'mcp-server.js'),
        outdir: undefined,
        alias: {
            '@src': path.join(ROOT, 'packages', 'mcp-server', 'src'),
            '@ansible/services': path.join(ROOT, 'packages', 'services', 'src'),
            '@ansible/common': path.join(ROOT, 'packages', 'common', 'src'),
        },
    },
    {
        ...webviewShared,
        entryPoints: [path.join(ROOT, 'src', 'panels', 'webview-entry.tsx')],
        outfile: path.join(ROOT, 'dist', 'webview.js'),
        outdir: undefined,
        alias: {
            '@src': path.join(ROOT, 'src'),
            '@ansible/ui': path.join(ROOT, 'packages', 'ui', 'src'),
            '@ansible/common': path.join(ROOT, 'packages', 'common', 'src'),
        },
    },
];

const navitaMainAlias = {
    '@src': path.join(ROOT, 'packages', 'navita', 'src', 'main'),
    '@ansible/core/out': path.join(ROOT, 'packages', 'core', 'src'),
    '@ansible/core': path.join(ROOT, 'packages', 'core', 'src'),
};

/** @type {esbuild.BuildOptions[]} */
const navitaTargets = [
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'packages', 'navita', 'src', 'main', 'main.ts')],
        outfile: path.join(ROOT, 'dist', 'navita-main.js'),
        outdir: undefined,
        external: ['electron', '@grpc/grpc-js'],
        alias: navitaMainAlias,
    },
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'packages', 'navita', 'src', 'main', 'preload.ts')],
        outfile: path.join(ROOT, 'dist', 'navita-preload.js'),
        outdir: undefined,
        external: ['electron'],
        alias: navitaMainAlias,
    },
    {
        ...shared,
        entryPoints: [path.join(ROOT, 'packages', 'navita', 'src', 'renderer', 'main.tsx')],
        outfile: path.join(ROOT, 'dist', 'renderer', 'renderer.js'),
        outdir: undefined,
        platform: 'browser',
        format: 'iife',
        target: 'es2020',
        external: [],
        alias: {
            '@shared': path.join(ROOT, 'packages', 'navita', 'src', 'shared'),
        },
        loader: { '.css': 'text' },
        define: {
            'process.env.NODE_ENV': production ? '"production"' : '"development"',
        },
    },
];

const targets = navitaOnly ? navitaTargets : [...extensionTargets, ...navitaTargets];

function copyRendererHtml() {
    const src = path.join(ROOT, 'packages', 'navita', 'src', 'renderer', 'index.html');
    const dest = path.join(ROOT, 'dist', 'renderer', 'index.html');
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log('  dist/renderer/index.html: copied');
}

async function main() {
    if (watch) {
        const contexts = await Promise.all(targets.map((t) => esbuild.context(t)));
        await Promise.all(contexts.map((ctx) => ctx.watch()));
        console.log('[build] watching for changes…');
    } else {
        const results = await Promise.all(targets.map((t) => esbuild.build(t)));
        for (const result of results) {
            const outputs = Object.keys(result.metafile?.outputs ?? {});
            for (const out of outputs) {
                const bytes = result.metafile?.outputs[out]?.bytes ?? 0;
                console.log(`  ${out}: ${(bytes / 1024).toFixed(1)} KB`);
            }
        }
    }
    copyRendererHtml();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
