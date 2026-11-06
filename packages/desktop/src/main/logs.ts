/**
 * Log capture for navita.
 *
 * The services log through `@ansible/common`'s `setLogFunction`, which was an
 * OutputChannel inside VS Code and the plain console here — invisible in a
 * packaged launch. This module takes that seam over: everything the services
 * print, plus the stderr of the processes navita spawns, lands in a bounded
 * in-memory buffer for the Logs page and in a rotating file for afterwards.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { LogEntry, LogLevel, LogsResult, LogSource } from '../shared/ipc';

/** Lines kept in memory; the file keeps more. */
export const LOG_LIMIT = 2000;

/** File size that triggers rotation to `<name>.1`. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Patterns that must never reach a log file, whatever produced them. */
const SECRET_PATTERNS: readonly RegExp[] = [
    /gh[pousr]_[A-Za-z0-9]{16,}/g,
    /\bBearer\s+[A-Za-z0-9._-]{10,}/g,
];

/**
 * Infer a level from text navita does not produce itself.
 *
 * Child processes print free-form lines, so severity comes from the words they
 * use rather than a field: an install that fails says `Failed`, an ansible
 * warning says `[WARNING]`.
 * @param message - One log line.
 * @returns The level it reads as.
 */
export function levelFor(message: string): LogLevel {
    if (/\b(error|failed|failure|critical|exception|traceback)\b/i.test(message)) {
        return 'error';
    }
    if (/\b(warn|warning|deprecated)\b/i.test(message)) {
        return 'warn';
    }
    return 'info';
}

/**
 * Remove credentials from a line before it is stored.
 *
 * Token shapes catch most of it; the values passed in cover the environment
 * variables navita itself injects, which never look like tokens but are just
 * as sensitive.
 * @param text - Raw output.
 * @param secrets - Exact values to replace, typically the token environment.
 * @returns The line with every match replaced by `***`.
 */
export function redact(text: string, secrets: readonly string[] = []): string {
    let redacted = text;
    for (const secret of secrets) {
        if (secret.length >= 8) {
            redacted = redacted.split(secret).join('***');
        }
    }
    for (const pattern of SECRET_PATTERNS) {
        redacted = redacted.replace(pattern, '***');
    }
    return redacted;
}

/** In-memory plus on-disk log sink. */
export class LogRecorder {
    private entries: LogEntry[] = [];
    private nextId = 1;
    private dropped = 0;
    private bytes = 0;

    /**
     * Open a recorder bound to one file.
     * @param filePath - Absolute path of the log file.
     * @param limit - How many lines to keep in memory.
     * @param secrets - Values to redact from every line.
     */
    constructor(
        private readonly filePath: string,
        private readonly limit: number = LOG_LIMIT,
        private readonly secrets: readonly string[] = [],
    ) {
        try {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            this.bytes = fs.statSync(filePath).size;
        } catch {
            this.bytes = 0;
        }
    }

    /**
     * Where the lines are written.
     * @returns Absolute path of the log file.
     */
    get path(): string {
        return this.filePath;
    }

    /**
     * Record one message, splitting it into lines.
     * @param source - Which process produced it.
     * @param level - Severity, or `info` for output that has none.
     * @param message - Text, possibly several lines.
     */
    append(source: LogSource, level: LogLevel, message: string): void {
        const lines = message.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (lines.length === 0) {
            return;
        }
        const time = new Date().toISOString();
        const written: string[] = [];
        for (const line of lines) {
            const text = redact(line, this.secrets);
            const inferred = levelFor(text);
            const effective = level === 'info' && inferred !== 'info' ? inferred : level;
            this.entries.push({
                id: this.nextId,
                time,
                source,
                level: effective,
                message: text,
            });
            this.nextId += 1;
            written.push(`${time} ${source} ${level} ${text}`);
        }
        while (this.entries.length > this.limit) {
            this.entries.shift();
            this.dropped += 1;
        }
        this.write(written);
    }

    /**
     * The buffer as the renderer sees it.
     * @returns Entries, file path and how many lines were dropped.
     */
    snapshot(): LogsResult {
        return { entries: [...this.entries], filePath: this.filePath, dropped: this.dropped };
    }

    /**
     * Empty the buffer and the file.
     *
     * The dropped counter resets too: after a clear, "dropped" would otherwise
     * describe lines nobody can account for any more.
     */
    clear(): void {
        this.entries = [];
        this.dropped = 0;
        try {
            fs.writeFileSync(this.filePath, '', 'utf8');
            this.bytes = 0;
        } catch {
            // A read-only directory must not break the page that clears it.
        }
    }

    /**
     * Append lines to the file, rotating once it grows past the cap.
     * @param lines - Formatted lines to write.
     */
    private write(lines: readonly string[]): void {
        const payload = `${lines.join('\n')}\n`;
        try {
            if (this.bytes + payload.length > MAX_FILE_BYTES) {
                fs.renameSync(this.filePath, `${this.filePath}.1`);
                this.bytes = 0;
            }
            fs.appendFileSync(this.filePath, payload, 'utf8');
            this.bytes += payload.length;
        } catch {
            // Logging must never take the app down with it.
        }
    }
}

let active: LogRecorder | undefined;
let listener: (() => void) | undefined;

/**
 * Create the process-wide recorder and make it the sink for the services.
 * @param filePath - Absolute path of the log file.
 * @param secrets - Values to redact from every line.
 * @returns The recorder, for callers that need its path.
 */
export function configureLogs(filePath: string, secrets: readonly string[] = []): LogRecorder {
    active = new LogRecorder(filePath, LOG_LIMIT, secrets);
    return active;
}

/**
 * Record a line if logging has been configured.
 * @param source - Which process produced it.
 * @param level - Severity.
 * @param message - Text, possibly several lines.
 */
export function logLines(source: LogSource, level: LogLevel, message: string): void {
    if (active === undefined) {
        return;
    }
    active.append(source, level, message);
    listener?.();
}

/**
 * Be told when a line arrives, so the page can follow the tail.
 * @param next - Called after each append.
 */
export function onLogAppended(next: () => void): void {
    listener = next;
}

/**
 * The current buffer.
 * @returns Entries and file path, or undefined before configuration.
 */
export function currentLogs(): LogsResult | undefined {
    return active?.snapshot();
}

/**
 * Empty the buffer and the file.
 * @returns The buffer after clearing, or undefined before configuration.
 */
export function clearLogs(): LogsResult | undefined {
    if (active === undefined) {
        return undefined;
    }
    active.clear();
    listener?.();
    return active.snapshot();
}
