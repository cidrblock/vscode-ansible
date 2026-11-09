/**
 * Default preferences and the validation that keeps a hand-edited state file
 * from breaking the app.
 *
 * Kept free of Electron and Node so the renderer, the main process and the
 * tests can share one definition of what a valid setting looks like.
 */

import type {
    AppSettings,
    PlaybookExecutor,
    SettingsPatch,
    SkillSourceSetting,
    SkillSourceType,
    SkillTrust,
} from './ipc';

/** Organizations Collection Sources scans until the user changes them. */
export const DEFAULT_GITHUB_ORGS: readonly string[] = [
    'ansible',
    'ansible-collections',
    'redhat-cop',
];

/** Longest organization list the Settings page accepts. */
export const MAX_GITHUB_ORGS = 20;

/**
 * Skill sources navita starts with.
 *
 * Same source the extension ships by default, so both hosts present the same
 * skills. Loading it needs `api.github.com`; the registry caches the index for
 * a day and built-in skills stay available when the fetch fails.
 */
export const DEFAULT_SKILL_SOURCES: readonly SkillSourceSetting[] = [
    {
        id: 'ai-forge',
        type: 'github',
        url: 'https://github.com/ansible-community/ai-forge',
        trust: 'community',
    },
];

/** Longest skill source list the Settings page accepts. */
export const MAX_SKILL_SOURCES = 20;

/** Transports a user may choose on the Skill sources page. */
export const SKILL_SOURCE_TYPES: readonly SkillSourceType[] = ['github', 'registry', 'local'];

/** Trust levels a source may carry. */
export const SKILL_TRUST_LEVELS: readonly SkillTrust[] = [
    'community',
    'certified',
    'partner',
    'private',
];

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
    skillSources: DEFAULT_SKILL_SOURCES.map((source) => ({ ...source })),
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
 * Check whether a value names a skill source transport.
 * @param value - Candidate value.
 * @returns True when it is one of the supported transports.
 */
export function isSkillSourceType(value: unknown): value is SkillSourceType {
    return SKILL_SOURCE_TYPES.some((type) => type === value);
}

/**
 * Check whether a value names a trust level.
 * @param value - Candidate value.
 * @returns True when it is one of the supported levels.
 */
export function isSkillTrust(value: unknown): value is SkillTrust {
    return SKILL_TRUST_LEVELS.some((level) => level === value);
}

/**
 * Clean a list of skill sources.
 *
 * Unlike the organization list an empty array is kept: turning every external
 * source off is a legitimate choice, and built-in skills are always loaded.
 * Entries that are not usable are dropped rather than turning into a source
 * that fails on every load.
 * @param raw - Candidate list from a state file or a settings patch.
 * @returns Sources to load, deduplicated by id and capped.
 */
export function normalizeSkillSources(raw: unknown): SkillSourceSetting[] {
    if (!Array.isArray(raw)) {
        return DEFAULT_SKILL_SOURCES.map((source) => ({ ...source }));
    }
    const seen = new Set<string>();
    const sources: SkillSourceSetting[] = [];
    for (const entry of raw) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }
        const candidate = entry as {
            id?: unknown;
            type?: unknown;
            url?: unknown;
            trust?: unknown;
            refreshInterval?: unknown;
        };
        if (
            typeof candidate.id !== 'string' ||
            typeof candidate.url !== 'string' ||
            !isSkillSourceType(candidate.type) ||
            !isSkillTrust(candidate.trust)
        ) {
            continue;
        }
        const id = candidate.id.trim().slice(0, 64);
        const url = candidate.url.trim().slice(0, 2000);
        const key = id.toLowerCase();
        if (id.length === 0 || url.length === 0 || seen.has(key)) {
            continue;
        }
        seen.add(key);
        const source: SkillSourceSetting = {
            id,
            type: candidate.type,
            url,
            trust: candidate.trust,
        };
        if (
            typeof candidate.refreshInterval === 'number' &&
            Number.isFinite(candidate.refreshInterval) &&
            candidate.refreshInterval > 0
        ) {
            sources.push({ ...source, refreshInterval: Math.min(candidate.refreshInterval, 8760) });
        } else {
            sources.push(source);
        }
    }
    return sources.slice(0, MAX_SKILL_SOURCES);
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
        skillSources?: unknown;
        playbookExecutor?: unknown;
        navigatorConfig?: unknown;
        terminal?: unknown;
    };
    return {
        githubOrgs: normalizeOrgs(candidate.githubOrgs),
        skillSources: normalizeSkillSources(candidate.skillSources),
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
        skillSources: 'skillSources' in candidate ? candidate.skillSources : current.skillSources,
        playbookExecutor:
            'playbookExecutor' in candidate ? candidate.playbookExecutor : current.playbookExecutor,
        navigatorConfig:
            'navigatorConfig' in candidate ? candidate.navigatorConfig : current.navigatorConfig,
        terminal: 'terminal' in candidate ? candidate.terminal : current.terminal,
    });
}
