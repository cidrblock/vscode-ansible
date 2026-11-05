/**
 * Small JSON state file for navita (recents, last workspace, active section).
 *
 * Written atomically so a crash mid-write cannot leave the app unable to start.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { SECTIONS, type SectionId, type WorkspaceEntry } from '../shared/ipc';
import { toWorkspaceEntry } from './workspaces';

const STATE_VERSION = 1;

export interface PersistedState {
    version: number;
    recents: WorkspaceEntry[];
    activeSection: SectionId;
    lastWorkspace: string | null;
    /** Interpreter the user pinned per workspace path, overriding discovery. */
    selectedEnvironments: Record<string, string>;
}

export const DEFAULT_STATE: PersistedState = {
    version: STATE_VERSION,
    recents: [],
    activeSection: 'overview',
    lastWorkspace: null,
    selectedEnvironments: {},
};

/**
 * Check whether a value is one of the known section ids.
 *
 * @param value - Candidate value from parsed JSON.
 * @returns True when the value names a sidebar section.
 */
function isSectionId(value: unknown): value is SectionId {
    return SECTIONS.some((section) => section.id === value);
}

/**
 * Turn one untrusted recents element into a workspace entry.
 *
 * @param value - Element from the parsed state file.
 * @returns Entry, or undefined when the element is malformed.
 */
function parseEntry(value: unknown): WorkspaceEntry | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }
    const candidate = value as { path?: unknown; openedAt?: unknown };
    if (typeof candidate.path !== 'string' || candidate.path.length === 0) {
        return undefined;
    }
    const openedAt = typeof candidate.openedAt === 'number' ? candidate.openedAt : 0;
    return toWorkspaceEntry(candidate.path, openedAt);
}

/**
 * Coerce unknown JSON into a usable state, discarding anything malformed.
 *
 * @param raw - Parsed JSON from disk.
 * @returns Validated state, falling back to defaults per field.
 */
export function parseState(raw: unknown): PersistedState {
    if (typeof raw !== 'object' || raw === null) {
        return { ...DEFAULT_STATE };
    }
    const candidate = raw as {
        recents?: unknown;
        activeSection?: unknown;
        lastWorkspace?: unknown;
        selectedEnvironments?: unknown;
    };
    const recents = Array.isArray(candidate.recents)
        ? candidate.recents
              .map((entry) => parseEntry(entry))
              .filter((entry): entry is WorkspaceEntry => entry !== undefined)
        : [];
    const activeSection = isSectionId(candidate.activeSection)
        ? candidate.activeSection
        : DEFAULT_STATE.activeSection;
    const lastWorkspace =
        typeof candidate.lastWorkspace === 'string' && candidate.lastWorkspace.length > 0
            ? candidate.lastWorkspace
            : null;
    return {
        version: STATE_VERSION,
        recents,
        activeSection,
        lastWorkspace,
        selectedEnvironments: parseSelections(candidate.selectedEnvironments),
    };
}

/**
 * Keep the pinned interpreters that survived a round trip through JSON.
 *
 * @param raw - Value from the parsed state file.
 * @returns Workspace path to interpreter path, dropping malformed entries.
 */
function parseSelections(raw: unknown): Record<string, string> {
    if (typeof raw !== 'object' || raw === null) {
        return {};
    }
    const selections: Record<string, string> = {};
    for (const [workspacePath, pythonPath] of Object.entries(raw)) {
        if (workspacePath.length > 0 && typeof pythonPath === 'string' && pythonPath.length > 0) {
            selections[workspacePath] = pythonPath;
        }
    }
    return selections;
}

/** Reader/writer for navita's JSON state file. */
export class StateStore {
    /**
     * Create a store bound to one file.
     *
     * @param filePath - Absolute path to the JSON state file.
     */
    constructor(private readonly filePath: string) {}

    /**
     * Read state from disk.
     *
     * @returns Persisted state, or defaults when the file is missing or invalid.
     */
    load(): PersistedState {
        try {
            const raw: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            return parseState(raw);
        } catch {
            return { ...DEFAULT_STATE };
        }
    }

    /**
     * Write state to disk atomically.
     *
     * @param state - State to persist.
     */
    save(state: PersistedState): void {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        const temporary = `${this.filePath}.tmp`;
        fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
        fs.renameSync(temporary, this.filePath);
    }
}
