#!/usr/bin/env node
/**
 * Development launcher for Ansible Studio.
 *
 * 1. Builds the studio esbuild targets (main + preload + renderer).
 * 2. Launches Electron.
 *
 * Usage:
 *   node packages/studio/scripts/dev.mjs
 *
 * For file watching, run in a separate terminal:
 *   node scripts/build.mjs --studio-only --watch
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const mainPath = path.join(repoRoot, 'dist', 'studio-main.js');

console.log('[studio:dev] Launching Electron...');
console.log(`[studio:dev] Main: ${mainPath}`);

const electronArgs = [mainPath];

const electronProc = spawn(String(electronPath), electronArgs, {
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
});

electronProc.on('close', (code) => {
    console.log(`[studio:dev] Electron exited with code ${code}`);
    process.exit(code ?? 0);
});

process.on('SIGINT', () => {
    electronProc.kill();
    process.exit(0);
});
