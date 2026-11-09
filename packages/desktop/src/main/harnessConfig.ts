/**
 * Write navita's MCP server into a harness's own config file.
 *
 * Every harness reads a different file in a different shape, so the mapping
 * lives here once: workspace-scoped files inside the project, user-scoped files
 * under the home directory, JSON for Cursor, Claude Code and VS Code, TOML for
 * Codex. Only the `ansible` entry is ever touched — the rest of the user's
 * config is left byte-identical apart from JSON re-indentation, and the file
 * before each write is kept as `<name>.navita.bak`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    HARNESSES,
    type HarnessConfigResult,
    type HarnessConfigState,
    type HarnessConfigStatus,
    type HarnessId,
    type HarnessScope,
} from '../shared/ipc';
import type { HarnessServerEntry } from './snippet';

const SERVER_KEY = 'ansible';
const BACKUP_SUFFIX = '.navita.bak';

/** Values that decide where a harness keeps its config on this machine. */
export interface HarnessTargetContext {
    readonly workspacePath: string | null;
    readonly home: string;
    readonly platform: NodeJS.Platform;
    /** Windows `%APPDATA%`; ignored elsewhere. */
    readonly appData?: string;
}

/** One file navita can write, and the shape that file expects. */
export interface HarnessConfigTarget {
    readonly harness: HarnessId;
    readonly scope: HarnessScope;
    /** Absolute path, or null when this scope does not exist for the harness. */
    readonly path: string | null;
    readonly format: 'json' | 'toml';
    /** Top-level key holding the server map, for JSON configs. */
    readonly wrapper: 'mcpServers' | 'servers';
    /** Why the target is unavailable, when it is. */
    readonly detail?: string;
}

interface JsonParseFailure {
    readonly ok: false;
    readonly detail: string;
}

interface JsonParseSuccess {
    readonly ok: true;
    readonly value: Record<string, unknown>;
}

type JsonParseResult = JsonParseFailure | JsonParseSuccess;

/**
 * User-scoped config file for a harness, if it has one.
 *
 * @param harness - Harness in question.
 * @param context - Home directory and platform that decide the path.
 * @returns Absolute path, or null when the harness is workspace-only.
 */
function globalPath(harness: HarnessId, context: HarnessTargetContext): string | null {
    switch (harness) {
        case 'cursor':
            return path.join(context.home, '.cursor', 'mcp.json');
        case 'claude-code':
            return path.join(context.home, '.claude.json');
        case 'codex':
            return path.join(context.home, '.codex', 'config.toml');
        case 'vscode':
        default:
            if (context.platform === 'darwin') {
                return path.join(
                    context.home,
                    'Library',
                    'Application Support',
                    'Code',
                    'User',
                    'mcp.json',
                );
            }
            if (context.platform === 'win32') {
                const appData = context.appData ?? path.join(context.home, 'AppData', 'Roaming');
                return path.join(appData, 'Code', 'User', 'mcp.json');
            }
            return path.join(context.home, '.config', 'Code', 'User', 'mcp.json');
    }
}

/**
 * Workspace-relative config file for a harness, if it has one.
 *
 * @param harness - Harness in question.
 * @returns Path relative to the workspace root, or null for Codex.
 */
function workspaceRelativePath(harness: HarnessId): string | null {
    switch (harness) {
        case 'cursor':
            return path.join('.cursor', 'mcp.json');
        case 'claude-code':
            return '.mcp.json';
        case 'vscode':
            return path.join('.vscode', 'mcp.json');
        case 'codex':
            return path.join('.codex', 'config.toml');
        default:
            return null;
    }
}

/**
 * Top-level key each JSON harness uses for its server map.
 *
 * @param harness - Harness in question.
 * @returns `servers` for VS Code, `mcpServers` everywhere else.
 */
function wrapperFor(harness: HarnessId): 'mcpServers' | 'servers' {
    return harness === 'vscode' ? 'servers' : 'mcpServers';
}

/**
 * Every config file navita knows how to write, for this machine and workspace.
 *
 * @param context - Workspace, home directory and platform.
 * @returns Targets in sidebar order, workspace scope before global scope.
 */
export function harnessTargets(context: HarnessTargetContext): readonly HarnessConfigTarget[] {
    const targets: HarnessConfigTarget[] = [];
    for (const harness of HARNESSES) {
        const relative = workspaceRelativePath(harness.id);
        const workspacePath =
            relative === null || context.workspacePath === null
                ? null
                : path.join(context.workspacePath, relative);
        targets.push({
            harness: harness.id,
            scope: 'workspace',
            path: workspacePath,
            format: harness.id === 'codex' ? 'toml' : 'json',
            wrapper: wrapperFor(harness.id),
            detail: workspacePath === null ? 'Open a workspace first.' : undefined,
        });
        targets.push({
            harness: harness.id,
            scope: 'global',
            path: globalPath(harness.id, context),
            format: harness.id === 'codex' ? 'toml' : 'json',
            wrapper: wrapperFor(harness.id),
        });
    }
    return targets;
}

/**
 * Parse a JSON config without throwing.
 *
 * @param text - File contents.
 * @returns Parsed object, or the reason parsing failed.
 */
function parseJson(text: string): JsonParseResult {
    try {
        const value: unknown = JSON.parse(text);
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return { ok: false, detail: 'The file does not contain a JSON object.' };
        }
        return { ok: true, value: value as Record<string, unknown> };
    } catch (error) {
        return { ok: false, detail: `Cannot parse the file as JSON: ${String(error)}` };
    }
}

/**
 * Read one harness entry out of a parsed JSON config.
 *
 * @param value - Parsed config object.
 * @param wrapper - Top-level key holding the server map.
 * @returns The entry as written, or undefined when it is absent.
 */
function readJsonEntry(
    value: Record<string, unknown>,
    wrapper: 'mcpServers' | 'servers',
): Record<string, unknown> | undefined {
    const servers = value[wrapper];
    if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
        return undefined;
    }
    const entry = (servers as Record<string, unknown>)[SERVER_KEY];
    return typeof entry === 'object' && entry !== null && !Array.isArray(entry)
        ? (entry as Record<string, unknown>)
        : undefined;
}

/**
 * Check whether a stored entry would start the same server navita would write.
 *
 * @param entry - Entry read from the config file.
 * @param expected - Entry navita wants in place.
 * @returns True when command and arguments match.
 */
function entryMatches(
    entry: Record<string, unknown> | undefined,
    expected: HarnessServerEntry,
): boolean {
    if (entry === undefined) {
        return false;
    }
    if (entry.command !== expected.command) {
        return false;
    }
    const args = entry.args;
    if (!Array.isArray(args) || args.length !== expected.args.length) {
        return false;
    }
    return args.every((value, index) => value === expected.args[index]);
}

/**
 * Unescape a TOML basic string body.
 *
 * @param value - Escaped body, without the surrounding quotes.
 * @returns Plain string.
 */
function unescapeToml(value: string): string {
    return value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * Find the body of the `[mcp_servers.ansible]` table.
 *
 * @param text - Whole TOML file.
 * @returns Lines inside that table, or undefined when it is absent.
 */
function tomlBlock(text: string): string | undefined {
    const lines = text.split('\n');
    const start = lines.findIndex((line) => /^\s*\[\s*mcp_servers\.ansible\s*\]\s*$/.test(line));
    if (start < 0) {
        return undefined;
    }
    const body: string[] = [];
    for (let index = start + 1; index < lines.length; index += 1) {
        if (/^\s*\[/.test(lines[index])) {
            break;
        }
        body.push(lines[index]);
    }
    return body.join('\n');
}

/**
 * Read the command and arguments Codex's config currently carries.
 *
 * @param block - Body of the `[mcp_servers.ansible]` table.
 * @returns Command and arguments, or undefined when they cannot be read.
 */
function readTomlEntry(block: string): { command: string; args: string[] } | undefined {
    const commandMatch = /^\s*command\s*=\s*"((?:[^"\\]|\\.)*)"/m.exec(block);
    if (commandMatch === null) {
        return undefined;
    }
    const command = unescapeToml(commandMatch[1]);
    const argsMatch = /^\s*args\s*=\s*\[([\s\S]*?)\]/m.exec(block);
    if (argsMatch === null) {
        return { command, args: [] };
    }
    const args: string[] = [];
    const argumentPattern = /"((?:[^"\\]|\\.)*)"/g;
    let match = argumentPattern.exec(argsMatch[1]);
    while (match !== null) {
        args.push(unescapeToml(match[1]));
        match = argumentPattern.exec(argsMatch[1]);
    }
    return { command, args };
}

/**
 * Paths Codex may have recorded a trust decision under.
 *
 * Codex keys its `projects` map by the project root, canonicalised when it can
 * be. The workspace itself, its real path, and the nearest ancestor holding a
 * `.git` entry are all plausible spellings of that root.
 * @param workspacePath - Workspace the user opened.
 * @returns Candidate keys, most specific first.
 */
function trustKeys(workspacePath: string): readonly string[] {
    const keys = new Set<string>();
    const add = (candidate: string): void => {
        keys.add(candidate);
        try {
            keys.add(fs.realpathSync(candidate));
        } catch {
            // A path that cannot be resolved can still match its original spelling.
        }
    };
    add(workspacePath);
    let directory = workspacePath;
    for (;;) {
        if (fs.existsSync(path.join(directory, '.git'))) {
            add(directory);
            break;
        }
        const parent = path.dirname(directory);
        if (parent === directory) {
            break;
        }
        directory = parent;
    }
    return [...keys];
}

/**
 * Read `[projects."<path>"] trust_level` decisions from a Codex user config.
 *
 * @param text - Contents of `~/.codex/config.toml`.
 * @returns Trusted flag per project key.
 */
function projectsTrust(text: string): Map<string, boolean> {
    const decisions = new Map<string, boolean>();
    let current: string | null = null;
    for (const line of text.split('\n')) {
        const quoted = /^\s*\[\s*projects\s*\.\s*"((?:[^"\\]|\\.)*)"\s*\]\s*$/.exec(line);
        if (quoted !== null) {
            current = unescapeToml(quoted[1]);
            continue;
        }
        const literal = /^\s*\[\s*projects\s*\.\s*'([^']*)'\s*\]\s*$/.exec(line);
        if (literal !== null) {
            current = literal[1];
            continue;
        }
        if (/^\s*\[/.test(line)) {
            current = null;
            continue;
        }
        if (current === null) {
            continue;
        }
        const trust = /^\s*trust_level\s*=\s*"([^"]*)"/.exec(line);
        if (trust !== null) {
            decisions.set(current, trust[1] === 'trusted');
        }
    }
    return decisions;
}

/**
 * Whether Codex will load this project's `.codex/config.toml`.
 *
 * Codex merges project config into the stack but disables that layer until the
 * directory is trusted, so an entry can be correct and still be ignored.
 * @param context - Home directory and workspace being inspected.
 * @param workspacePath - Workspace the user opened.
 * @returns True when a trusted decision names the workspace or its git root.
 */
function codexProjectTrusted(context: HarnessTargetContext, workspacePath: string): boolean {
    const file = path.join(context.home, '.codex', 'config.toml');
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch {
        return false;
    }
    const decisions = projectsTrust(text);
    return trustKeys(workspacePath).some((key) => decisions.get(key) === true);
}

/**
 * Explain why a valid-looking config might still be ignored.
 *
 * @param target - File that was read.
 * @param context - Home directory and workspace being inspected.
 * @returns Warning text, or undefined when nothing would stop the harness.
 */
function targetWarning(
    target: HarnessConfigTarget,
    context: HarnessTargetContext,
): string | undefined {
    if (
        target.harness !== 'codex' ||
        target.scope !== 'workspace' ||
        context.workspacePath === null
    ) {
        return undefined;
    }
    if (codexProjectTrusted(context, context.workspacePath)) {
        return undefined;
    }
    return 'Codex ignores .codex/config.toml until this project is trusted. Trust it once in Codex.';
}

/**
 * Decide what a config file says about navita's server.
 *
 * @param target - File being inspected.
 * @param text - File contents.
 * @param expected - Entry navita would write.
 * @returns State and, when it cannot be read, why.
 */
function inspectText(
    target: HarnessConfigTarget,
    text: string,
    expected: HarnessServerEntry,
): { state: HarnessConfigState; detail?: string } {
    if (target.format === 'toml') {
        const block = tomlBlock(text);
        if (block === undefined) {
            return { state: 'absent' };
        }
        const entry = readTomlEntry(block);
        if (entry === undefined) {
            // The table exists but its command cannot be read.
            return { state: 'stale' };
        }
        const matches =
            entry.command === expected.command &&
            entry.args.length === expected.args.length &&
            entry.args.every((value, index) => value === expected.args[index]);
        return { state: matches ? 'installed' : 'stale' };
    }
    const parsed = parseJson(text);
    if (!parsed.ok) {
        return { state: 'error', detail: parsed.detail };
    }
    const entry = readJsonEntry(parsed.value, target.wrapper);
    return {
        state: entryMatches(entry, expected)
            ? 'installed'
            : entry === undefined
              ? 'absent'
              : 'stale',
    };
}

/**
 * Read one target's state from disk.
 *
 * @param target - File being inspected.
 * @param expected - Entry navita would write.
 * @param context - Home directory and workspace the target belongs to.
 * @returns Status the renderer can render directly.
 */
function readTarget(
    target: HarnessConfigTarget,
    expected: HarnessServerEntry,
    context: HarnessTargetContext,
): HarnessConfigStatus {
    if (target.path === null) {
        return {
            harness: target.harness,
            scope: target.scope,
            path: null,
            state: 'unsupported',
            detail: target.detail,
        };
    }
    let text: string;
    try {
        text = fs.readFileSync(target.path, 'utf8');
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return {
                harness: target.harness,
                scope: target.scope,
                path: target.path,
                state: 'absent',
                warning: targetWarning(target, context),
            };
        }
        return {
            harness: target.harness,
            scope: target.scope,
            path: target.path,
            state: 'error',
            detail: String(error),
            warning: targetWarning(target, context),
        };
    }
    const result = inspectText(target, text, expected);
    return {
        harness: target.harness,
        scope: target.scope,
        path: target.path,
        state: result.state,
        detail: result.detail,
        warning: targetWarning(target, context),
    };
}

/**
 * Read every harness config this machine has.
 *
 * @param context - Workspace, home directory and platform.
 * @param expected - Entry navita would write.
 * @returns One status per harness and scope.
 */
export function readHarnessConfigs(
    context: HarnessTargetContext,
    expected: HarnessServerEntry,
): readonly HarnessConfigStatus[] {
    return harnessTargets(context).map((target) => readTarget(target, expected, context));
}

/**
 * Merge navita's entry into a JSON config, keeping everything else.
 *
 * @param text - Existing file contents, or null for a new file.
 * @param target - File being written.
 * @param expected - Entry to place.
 * @returns New file contents.
 */
function mergeJson(
    text: string | null,
    target: HarnessConfigTarget,
    expected: HarnessServerEntry,
): string {
    let base: Record<string, unknown> = {};
    if (text !== null && text.trim() !== '') {
        const parsed = parseJson(text);
        if (!parsed.ok) {
            throw new Error(parsed.detail);
        }
        base = parsed.value;
    }
    const servers = base[target.wrapper];
    const existing =
        typeof servers === 'object' && servers !== null && !Array.isArray(servers)
            ? (servers as Record<string, unknown>)
            : {};
    base[target.wrapper] = { ...existing, [SERVER_KEY]: expected };
    return `${JSON.stringify(base, null, 2)}\n`;
}

/**
 * Drop navita's entry from a JSON config, keeping everything else.
 *
 * @param text - Existing file contents.
 * @param target - File being written.
 * @returns New contents and whether anything changed.
 */
function removeJson(text: string, target: HarnessConfigTarget): { text: string; changed: boolean } {
    const parsed = parseJson(text);
    if (!parsed.ok) {
        throw new Error(parsed.detail);
    }
    const servers = parsed.value[target.wrapper];
    if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) {
        return { text, changed: false };
    }
    const map = servers as Record<string, unknown>;
    if (!(SERVER_KEY in map)) {
        return { text, changed: false };
    }
    parsed.value[target.wrapper] = Object.fromEntries(
        Object.entries(map).filter(([key]) => key !== SERVER_KEY),
    );
    return { text: `${JSON.stringify(parsed.value, null, 2)}\n`, changed: true };
}

/**
 * Render the TOML table navita owns.
 *
 * @param expected - Entry to place.
 * @returns Table text with a trailing newline.
 */
function tomlTable(expected: HarnessServerEntry): string {
    const quote = (value: string): string =>
        `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const env = Object.entries(expected.env)
        .map(([key, value]) => `${key} = ${quote(value)}`)
        .join(', ');
    return [
        `[mcp_servers.${SERVER_KEY}]`,
        `command = ${quote(expected.command)}`,
        `args = [${expected.args.map(quote).join(', ')}]`,
        `env = { ${env} }`,
        '',
    ].join('\n');
}

/**
 * Remove the `[mcp_servers.ansible]` table and its sub-tables.
 *
 * @param text - Whole TOML file.
 * @returns Contents without navita's table.
 */
function removeTomlTable(text: string): string {
    const lines = text.split('\n');
    const kept: string[] = [];
    let skipping = false;
    for (const line of lines) {
        const header = /^\s*\[\s*([^\]]+?)\s*\]\s*$/.exec(line);
        if (header !== null) {
            const name = header[1].replace(/\s+/g, '');
            if (name === `mcp_servers.${SERVER_KEY}` || name === `mcp_servers.${SERVER_KEY}.env`) {
                skipping = true;
                continue;
            }
            skipping = false;
            kept.push(line);
            continue;
        }
        if (!skipping) {
            kept.push(line);
        }
    }
    return kept
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trimEnd();
}

/**
 * Place navita's table in a TOML config, replacing any previous copy.
 *
 * @param text - Existing file contents, or null for a new file.
 * @param expected - Entry to place.
 * @returns New file contents.
 */
function mergeToml(text: string | null, expected: HarnessServerEntry): string {
    const base = text === null ? '' : removeTomlTable(text);
    return base === '' ? tomlTable(expected) : `${base}\n\n${tomlTable(expected)}`;
}

/**
 * Back up a config file before modifying it.
 *
 * @param file - File that is about to change.
 * @returns Nothing; the copy is `<file>.navita.bak`.
 */
function backup(file: string): void {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, `${file}${BACKUP_SUFFIX}`);
    }
}

/**
 * Write navita's entry into one target.
 *
 * @param target - File to write.
 * @param expected - Entry to place.
 * @param context - Home directory and workspace the target belongs to.
 * @returns Whether the entry was added or replaced.
 */
function writeTarget(
    target: HarnessConfigTarget,
    expected: HarnessServerEntry,
    context: HarnessTargetContext,
): 'added' | 'updated' {
    if (target.path === null) {
        throw new Error(target.detail ?? 'This harness has no such config file.');
    }
    const previous = readTarget(target, expected, context);
    if (previous.state === 'unsupported') {
        throw new Error(previous.detail ?? 'This harness has no such config file.');
    }
    const existing = fs.existsSync(target.path) ? fs.readFileSync(target.path, 'utf8') : null;
    const next =
        target.format === 'toml'
            ? mergeToml(existing, expected)
            : mergeJson(existing, target, expected);
    fs.mkdirSync(path.dirname(target.path), { recursive: true });
    backup(target.path);
    fs.writeFileSync(target.path, next, 'utf8');
    return previous.state === 'absent' ? 'added' : 'updated';
}

/**
 * Remove navita's entry from one target.
 *
 * @param target - File to edit.
 * @returns True when an entry was present and removed.
 */
function removeTarget(target: HarnessConfigTarget): boolean {
    if (target.path === null) {
        throw new Error(target.detail ?? 'This harness has no such config file.');
    }
    if (!fs.existsSync(target.path)) {
        return false;
    }
    const existing = fs.readFileSync(target.path, 'utf8');
    let next: string;
    let changed: boolean;
    if (target.format === 'toml') {
        changed = tomlBlock(existing) !== undefined;
        const stripped = removeTomlTable(existing);
        next = stripped === '' ? '' : `${stripped}\n`;
    } else {
        const removed = removeJson(existing, target);
        next = removed.text;
        changed = removed.changed;
    }
    if (!changed) {
        return false;
    }
    backup(target.path);
    fs.writeFileSync(target.path, next, 'utf8');
    return true;
}

/**
 * Add or remove navita's server in one harness config.
 *
 * @param context - Workspace, home directory and platform.
 * @param expected - Entry to place.
 * @param harness - Harness to edit.
 * @param scope - Workspace or user config.
 * @param install - True to write, false to remove.
 * @returns Every status afterwards, plus what changed or why it failed.
 */
export function applyHarnessConfig(
    context: HarnessTargetContext,
    expected: HarnessServerEntry,
    harness: HarnessId,
    scope: HarnessScope,
    install: boolean,
): HarnessConfigResult {
    const target = harnessTargets(context).find(
        (candidate) => candidate.harness === harness && candidate.scope === scope,
    );
    if (target?.path == null) {
        return {
            statuses: readHarnessConfigs(context, expected),
            error: target?.detail ?? `Unknown harness: ${harness}`,
        };
    }
    try {
        if (install) {
            const action = writeTarget(target, expected, context);
            return {
                statuses: readHarnessConfigs(context, expected),
                change: { harness, scope, action, path: target.path },
            };
        }
        const removed = removeTarget(target);
        return {
            statuses: readHarnessConfigs(context, expected),
            change: { harness, scope, action: 'removed', path: target.path },
            error: removed ? undefined : `No ansible entry in ${target.path}.`,
        };
    } catch (error) {
        return {
            statuses: readHarnessConfigs(context, expected),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
