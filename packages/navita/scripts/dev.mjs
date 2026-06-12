#!/usr/bin/env node
/**
 * Development launcher for Ansible Navita.
 *
 * 1. Builds the navita esbuild targets (main + preload + renderer).
 * 2. Launches Electron.
 *
 * Usage:
 *   node packages/navita/scripts/dev.mjs
 *
 * For file watching, run in a separate terminal:
 *   node scripts/build.mjs --navita-only --watch
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const mainPath = path.join(repoRoot, 'dist', 'navita-main.js');

console.log('[navita:dev] Launching Electron...');
console.log(`[navita:dev] Main: ${mainPath}`);

const electronArgs = [mainPath];

const electronProc = spawn(String(electronPath), electronArgs, {
    stdio: 'inherit',
    env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
});

electronProc.on('close', (code) => {
    console.log(`[navita:dev] Electron exited with code ${code}`);
    process.exit(code ?? 0);
});

process.on('SIGINT', () => {
    electronProc.kill();
    process.exit(0);
});
