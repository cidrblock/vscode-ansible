/**
 * Opening the user's terminal on a command.
 *
 * navita does not embed a PTY. Anything interactive — ansible-navigator,
 * molecule, a harness — is handed to the terminal the user already runs, which
 * keeps its fonts, keybindings, scrollback and multiplexer, and keeps a native
 * dependency out of the app.
 *
 * Every desktop ships a different way to say "run this in a new window", so the
 * convention lives in a template the user can edit:
 *
 *     ptyxis --working-directory {dir} -- {command}
 *
 * `{command}` is required; `{dir}` is optional for terminals that inherit the
 * working directory navita spawns them in.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { OpenTerminalRequest, TerminalCandidate, TerminalOpenResult } from '../shared/ipc';

/** Placeholder for the directory to open in. */
export const DIR_PLACEHOLDER = '{dir}';

/** Placeholder for the command to run; a template without it cannot work. */
export const COMMAND_PLACEHOLDER = '{command}';

/**
 * Terminals navita knows how to drive, in the order it prefers them.
 *
 * Each entry records that terminal's own convention for "run this command"
 * (`--` for the GNOME family and ptyxis, `-e` for the KDE/X11 family, and so
 * on). Verified against the programs' own option parsing where a man page was
 * reachable; anything else is a template the user can write by hand.
 */
export const TERMINAL_CANDIDATES: readonly { readonly bin: string; readonly template: string }[] = [
    { bin: 'ptyxis', template: 'ptyxis --working-directory {dir} -- {command}' },
    { bin: 'gnome-terminal', template: 'gnome-terminal --working-directory {dir} -- {command}' },
    { bin: 'kgx', template: 'kgx --working-directory {dir} -- {command}' },
    { bin: 'konsole', template: 'konsole --workdir {dir} -e {command}' },
    { bin: 'xfce4-terminal', template: 'xfce4-terminal --working-directory {dir} -x {command}' },
    { bin: 'mate-terminal', template: 'mate-terminal --working-directory {dir} -x {command}' },
    { bin: 'tilix', template: 'tilix --working-directory {dir} -e {command}' },
    { bin: 'alacritty', template: 'alacritty --working-directory {dir} -e {command}' },
    { bin: 'kitty', template: 'kitty --directory {dir} {command}' },
    { bin: 'wezterm', template: 'wezterm start --cwd {dir} -- {command}' },
    { bin: 'foot', template: 'foot --working-directory {dir} {command}' },
    { bin: 'x-terminal-emulator', template: 'x-terminal-emulator -e {command}' },
    { bin: 'xterm', template: 'xterm -e {command}' },
];

/**
 * Directories searched for a terminal, in PATH order.
 * @param env - Environment to read PATH from.
 * @returns Absolute directories, without the empty entries PATH can contain.
 */
export function searchDirs(env: NodeJS.ProcessEnv = process.env): string[] {
    return (env.PATH ?? '').split(path.delimiter).filter((entry) => entry.length > 0);
}

/**
 * Find an executable by name.
 * @param bin - Program name, for example `ptyxis`.
 * @param dirs - Directories to search, in order.
 * @returns Full path of the first match, or undefined.
 */
export function findOnPath(
    bin: string,
    dirs: readonly string[] = searchDirs(),
): string | undefined {
    for (const directory of dirs) {
        const candidate = path.join(directory, bin);
        try {
            if (fs.statSync(candidate).isFile()) {
                return candidate;
            }
        } catch {
            // Not in this directory; the next one may have it.
        }
    }
    return undefined;
}

/**
 * Which known terminals are installed.
 * @param dirs - Directories to search, in order.
 * @returns One entry per known terminal, with `detected` set.
 */
export function detectTerminals(dirs: readonly string[] = searchDirs()): TerminalCandidate[] {
    return TERMINAL_CANDIDATES.map(({ bin, template }) => ({
        bin,
        template,
        detected: findOnPath(bin, dirs) !== undefined,
    }));
}

/**
 * Explain why a template cannot be used.
 * @param template - Template from settings or the candidate table.
 * @returns A message naming what is missing, or undefined when it is usable.
 */
export function templateProblem(template: string): string | undefined {
    if (template.trim().length === 0) {
        return 'The terminal command is empty.';
    }
    if (!template.includes(COMMAND_PLACEHOLDER)) {
        return `The terminal command must contain ${COMMAND_PLACEHOLDER}.`;
    }
    return undefined;
}

/**
 * Quote one value for a POSIX shell.
 * @param value - Raw string, which may contain spaces or quotes.
 * @returns The value, safe to drop into a command line.
 */
export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** Characters that survive a shell untouched, so a word needs no quotes. */
const SAFE_ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/;

/**
 * Quote one word only when the shell would otherwise change it.
 *
 * Quoting every word is safe but turns `ansible-playbook site.yml` into
 * `'ansible-playbook' 'site.yml'`, which reads badly in a terminal title and in
 * the error navita reports. Anything outside this set — a space, `$`, a quote,
 * a glob — still goes through `shellQuote`.
 * @param value - Raw argument.
 * @returns The argument, quoted if it needs to be.
 */
export function quoteArgument(value: string): string {
    return SAFE_ARGUMENT.test(value) ? value : shellQuote(value);
}

/**
 * Turn an argument list into one shell command line.
 *
 * Callers pass words, never a pre-built line, so nothing they supply can be
 * reinterpreted as shell syntax.
 * @param argv - Arguments, executable first.
 * @returns Space-joined command line.
 */
export function commandLine(argv: readonly string[]): string {
    return argv.map(quoteArgument).join(' ');
}

/**
 * Fill a template in for one directory and command.
 *
 * `{dir}` is quoted because it is a path. `{command}` is inserted verbatim: it
 * is built by the caller from quoted words, and terminals that want the whole
 * line as a single argument (`-x`) need it unquoted so the shell keeps it one.
 * @param template - Template containing the placeholders.
 * @param spec - Directory to open in and command to run.
 * @param spec.dir - Directory to open the terminal in.
 * @param spec.command - Command the terminal should run.
 * @returns The command line to hand to `sh -c`.
 */
export function buildTerminalLine(
    template: string,
    spec: { readonly dir: string; readonly command: string },
): string {
    return template
        .replaceAll(DIR_PLACEHOLDER, shellQuote(spec.dir))
        .replaceAll(COMMAND_PLACEHOLDER, spec.command);
}

export interface ResolvedTerminal {
    /** Template to use, or null when nothing usable was found. */
    readonly template: string | null;
    readonly detail?: string;
}

/**
 * Choose the template to use.
 *
 * An explicit setting always wins, so a user whose terminal is not in the table
 * is never blocked by detection. Otherwise the first detected terminal in
 * preference order is used.
 * @param setting - Stored template; empty means automatic.
 * @param candidates - Result of `detectTerminals`.
 * @returns The template and, when nothing was found, why.
 */
export function resolveTerminal(
    setting: string,
    candidates: readonly TerminalCandidate[],
): ResolvedTerminal {
    const chosen = setting.trim();
    if (chosen.length > 0) {
        return { template: chosen };
    }
    const detected = candidates.find((candidate) => candidate.detected);
    if (detected === undefined) {
        return {
            template: null,
            detail: 'No known terminal found on PATH. Set a terminal command under Settings › Terminal.',
        };
    }
    return { template: detected.template };
}

export interface OpenTerminalOptions {
    /** Directory the terminal opens in. */
    readonly dir: string;
    /** Command to run, already quoted for the shell. */
    readonly command: string;
    /** Stored template; empty means automatic. */
    readonly setting: string;
    /** Directories to search for known terminals. */
    readonly dirs?: readonly string[];
}

/**
 * Check a request that arrived over IPC before any of it is used.
 *
 * The renderer is the only caller, but it is also the one place in navita where
 * a value could arrive that nobody wrote: the request is validated here rather
 * than trusted, so the terminal can only ever be asked to run a list of words.
 * @param request - Value received on the IPC channel.
 * @returns A usable request, or the reason it was rejected.
 */
export function parseOpenTerminalRequest(
    request: unknown,
): OpenTerminalRequest | { readonly error: string } {
    if (request === undefined || request === null) {
        return {};
    }
    if (typeof request !== 'object') {
        return { error: 'The terminal request was not an object.' };
    }
    const record = request as Record<string, unknown>;
    const parsed: { argv?: readonly string[]; dir?: string } = {};

    if (record.argv !== undefined) {
        const argv = record.argv;
        if (
            !Array.isArray(argv) ||
            argv.some((word) => typeof word !== 'string' || word.length === 0)
        ) {
            return { error: 'The terminal command must be a list of non-empty words.' };
        }
        if (argv.length > 0) {
            parsed.argv = argv as string[];
        }
    }

    if (record.dir !== undefined) {
        const dir = record.dir;
        if (typeof dir !== 'string' || dir.trim().length === 0) {
            return { error: 'The terminal directory must be a path.' };
        }
        parsed.dir = dir;
    }

    return parsed;
}

/** How long a terminal may take to fail before navita calls it started. */
const FAILURE_WINDOW_MS = 700;

/**
 * Launch the user's terminal on a command.
 *
 * The terminal is detached: navita does not own it and must not wait for it.
 * A window still fails fast when the binary is missing or rejects the options,
 * so the first moments of its life are watched and a non-zero exit is reported
 * with the command line rather than silently doing nothing.
 * @param options - Directory, command and template to use.
 * @returns Whether a terminal was started, plus the line that was run.
 */
export async function openTerminal(options: OpenTerminalOptions): Promise<TerminalOpenResult> {
    const candidates = detectTerminals(options.dirs ?? searchDirs());
    const resolved = resolveTerminal(options.setting, candidates);
    if (resolved.template === null) {
        return { state: 'error', command: '', detail: resolved.detail ?? 'No terminal available.' };
    }
    const problem = templateProblem(resolved.template);
    if (problem !== undefined) {
        return { state: 'error', command: resolved.template, detail: problem };
    }
    const line = buildTerminalLine(resolved.template, options);

    return new Promise<TerminalOpenResult>((resolve) => {
        const child = spawn('/bin/sh', ['-c', line], {
            cwd: options.dir,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        let settled = false;
        const finish = (result: TerminalOpenResult): void => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });
        child.on('error', (error: Error) => {
            finish({ state: 'error', command: line, detail: error.message });
        });
        child.on('exit', (code) => {
            if (code !== null && code !== 0) {
                finish({
                    state: 'error',
                    command: line,
                    detail: stderr.trim() || `The terminal exited with code ${String(code)}.`,
                });
            }
        });

        setTimeout(() => {
            if (!settled) {
                child.unref();
                finish({ state: 'ready', command: line });
            }
        }, FAILURE_WINDOW_MS);
    });
}
