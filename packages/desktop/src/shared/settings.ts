/**
 * Default preferences and the validation that keeps a hand-edited state file
 * from breaking the app.
 *
 * Kept free of Electron and Node so the renderer, the main process and the
 * tests can share one definition of what a valid setting looks like.
 */

import type { AppSettings, PlaybookExecutor, SettingsPatch } from './ipc';

/** Organizations Collection Sources scans until the user changes them. */
export const DEFAULT_GITHUB_ORGS: readonly string[] = [
    'ansible',
    'ansible-collections',
    'redhat-cop',
];

/** Longest organization list the Settings page accepts. */
export const MAX_GITHUB_ORGS = 20;

/** Executors the run action understands, in display order. */
export const PLAYBOOK_EXECUTORS: readonly {
    readonly id: PlaybookExecutor;
    readonly label: string;
    readonly hint: string;
}[] = [
    {
        id: 'ansible-navigator',
        label: 'ansible-navigator',
        hint: 'Runs inside an execution environment, the way the extension does.',
    },
    {
        id: 'ansible-playbook',
        label: 'ansible-playbook',
        hint: 'Runs in the active Python environment.',
    },
];

/** Longest terminal template the Settings page accepts. */
export const MAX_TERMINAL_TEMPLATE = 300;

export const DEFAULT_SETTINGS: AppSettings = {
    githubOrgs: [...DEFAULT_GITHUB_ORGS],
    playbookExecutor: 'ansible-navigator',
    navigatorConfig: '',
    terminal: '',
};

/**
 * Check whether a value names an executor the app can run.
 * @param value - Candidate from a state file or a settings patch.
 * @returns True when the value is a known executor.
 */
export function isPlaybookExecutor(value: unknown): value is PlaybookExecutor {
    return PLAYBOOK_EXECUTORS.some((executor) => executor.id === value);
}

/**
 * Clean an organization list: trim, drop blanks, dedupe, cap the length.
 *
 * Falls back to the defaults when the input is not a list, so an empty or
 * malformed value never leaves Collection Sources with nothing to scan.
 * @param raw - Candidate list from a state file or a settings patch.
 * @returns Organizations to scan, in the order the user gave them.
 */
export function normalizeOrgs(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
        return [...DEFAULT_GITHUB_ORGS];
    }
    const seen = new Set<string>();
    const orgs: string[] = [];
    for (const entry of raw) {
        if (typeof entry !== 'string') {
            continue;
        }
        const org = entry.trim();
        const key = org.toLowerCase();
        if (org.length === 0 || seen.has(key)) {
            continue;
        }
        seen.add(key);
        orgs.push(org);
    }
    return orgs.length === 0 ? [...DEFAULT_GITHUB_ORGS] : orgs.slice(0, MAX_GITHUB_ORGS);
}

/**
 * Clean a terminal template.
 *
 * The value is a command line the user owns, so only the obvious damage is
 * repaired: surrounding whitespace and an absurd length. The placeholders are
 * checked when a terminal is opened, where the message can say which is missing.
 * @param raw - Candidate from a state file or a settings patch.
 * @returns The template, or an empty string for automatic detection.
 */
export function normalizeTerminal(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim().slice(0, MAX_TERMINAL_TEMPLATE) : '';
}

/**
 * Coerce a stored settings object into a usable one.
 * @param raw - Value read from the state file.
 * @returns Settings, falling back to the default for each field.
 */
export function normalizeSettings(raw: unknown): AppSettings {
    if (typeof raw !== 'object' || raw === null) {
        return { ...DEFAULT_SETTINGS, githubOrgs: [...DEFAULT_SETTINGS.githubOrgs] };
    }
    const candidate = raw as {
        githubOrgs?: unknown;
        playbookExecutor?: unknown;
        navigatorConfig?: unknown;
        terminal?: unknown;
    };
    return {
        githubOrgs: normalizeOrgs(candidate.githubOrgs),
        playbookExecutor: isPlaybookExecutor(candidate.playbookExecutor)
            ? candidate.playbookExecutor
            : DEFAULT_SETTINGS.playbookExecutor,
        navigatorConfig:
            typeof candidate.navigatorConfig === 'string'
                ? candidate.navigatorConfig.trim()
                : DEFAULT_SETTINGS.navigatorConfig,
        terminal: normalizeTerminal(candidate.terminal),
    };
}

/**
 * Apply a settings patch, ignoring unknown keys and invalid values.
 * @param current - Settings in effect now.
 * @param patch - Fields the client asked to change.
 * @returns Settings to persist.
 */
export function mergeSettings(current: AppSettings, patch: unknown): AppSettings {
    if (typeof patch !== 'object' || patch === null) {
        return current;
    }
    const candidate = patch as SettingsPatch;
    return normalizeSettings({
        githubOrgs: 'githubOrgs' in candidate ? candidate.githubOrgs : current.githubOrgs,
        playbookExecutor:
            'playbookExecutor' in candidate ? candidate.playbookExecutor : current.playbookExecutor,
        navigatorConfig:
            'navigatorConfig' in candidate ? candidate.navigatorConfig : current.navigatorConfig,
        terminal: 'terminal' in candidate ? candidate.terminal : current.terminal,
    });
}
