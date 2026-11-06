import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { levelFor, LogRecorder, MAX_FILE_BYTES, redact } from '../src/main/logs';

/**
 * A recorder writing into a throwaway directory.
 * @param limit - Lines to keep in memory.
 * @param secrets - Values to redact.
 * @returns The recorder and its file path.
 */
function recorder(limit = 5, secrets: readonly string[] = []): { log: LogRecorder; file: string } {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-logs-'));
    const file = path.join(directory, 'navita.log');
    return { log: new LogRecorder(file, limit, secrets), file };
}

describe('levelFor', () => {
    it('reads failures as errors', () => {
        expect(levelFor('Failed to install community.general')).toBe('error');
        expect(levelFor('Traceback (most recent call last)')).toBe('error');
    });

    it('reads deprecation and warning lines as warnings', () => {
        expect(levelFor('[WARNING]: the specified collection path')).toBe('warn');
    });

    it('leaves ordinary output alone', () => {
        expect(levelFor('Loaded 2 execution environments')).toBe('info');
    });
});

describe('redact', () => {
    it('masks token shapes', () => {
        expect(redact('token ghp_abcdefghijklmnopqrstuvwxyz0123 done')).toBe('token *** done');
    });

    it('masks bearer headers', () => {
        expect(redact('Authorization: Bearer abcdef1234567890')).toBe('Authorization: ***');
    });

    it('masks exact secret values from the environment', () => {
        expect(redact('using s3cr3t-value-here for auth', ['s3cr3t-value-here'])).toBe(
            'using *** for auth',
        );
    });
});

describe('LogRecorder', () => {
    it('splits multi-line output and keeps the order', () => {
        const { log } = recorder();
        log.append('command', 'info', 'first\nsecond\n\nthird');
        expect(log.snapshot().entries.map((entry) => entry.message)).toEqual([
            'first',
            'second',
            'third',
        ]);
    });

    it('drops the oldest lines once past the limit, and counts them', () => {
        const { log } = recorder(3);
        for (const line of ['one', 'two', 'three', 'four']) {
            log.append('app', 'info', line);
        }
        const snapshot = log.snapshot();
        expect(snapshot.entries.map((entry) => entry.message)).toEqual(['two', 'three', 'four']);
        expect(snapshot.dropped).toBe(1);
    });

    it('upgrades a line that reads as an error even when logged as info', () => {
        const { log } = recorder();
        log.append('lsp', 'info', 'Error: cannot find module');
        expect(log.snapshot().entries[0]?.level).toBe('error');
    });

    it('writes the same lines to disk', () => {
        const { log, file } = recorder();
        log.append('app', 'info', 'hello');
        expect(fs.readFileSync(file, 'utf8')).toContain('app info hello');
    });

    it('rotates the file instead of growing without bound', () => {
        const { log, file } = recorder(10);
        const line = 'x'.repeat(1024);
        for (let index = 0; index < Math.ceil(MAX_FILE_BYTES / 1024) + 2; index += 1) {
            log.append('app', 'info', line);
        }
        expect(fs.existsSync(`${file}.1`)).toBe(true);
    });

    it('empties the buffer and the file on clear', () => {
        const { log, file } = recorder();
        log.append('app', 'info', 'hello');
        log.clear();
        expect(log.snapshot().entries).toEqual([]);
        expect(log.snapshot().dropped).toBe(0);
        expect(fs.readFileSync(file, 'utf8')).toBe('');
    });
});
