/**
 * Workspace bookkeeping for navita.
 *
 * The picker itself is UI; everything here is the pure part: turning a chosen
 * folder into a recents entry and keeping that list sane. `ANSIBLE_ENV_WORKSPACE`
 * is what the services package reads when it has no VS Code workspace folder
 * (packages/services/src/CommandService.ts), so activating a workspace only has
 * to set that variable on the children navita spawns.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { WorkspaceEntry } from '../shared/ipc';

export const MAX_RECENTS = 10;

/**
 * Normalize a chosen folder into an absolute path without a trailing separator.
 *
 * @param input - Raw path from the folder picker or the recents list.
 * @returns Absolute path with any trailing separator removed.
 */
export function normalizeWorkspacePath(input: string): string {
    const resolved = path.resolve(input.trim());
    if (resolved.length > 1 && /[\\/]$/.test(resolved)) {
        return resolved.replace(/[\\/]+$/, '') || path.parse(resolved).root;
    }
    return resolved;
}

/**
 * Display name for a workspace.
 *
 * @param workspacePath - Normalized workspace path.
 * @returns Final path segment, or the path itself for a filesystem root.
 */
export function workspaceName(workspacePath: string): string {
    const base = path.basename(workspacePath);
    return base.length > 0 ? base : workspacePath;
}

/**
 * Build a recents entry for a folder.
 *
 * @param input - Folder chosen by the user.
 * @param now - Timestamp to record; defaults to the current time.
 * @returns Entry suitable for the recents list and persisted state.
 */
export function toWorkspaceEntry(input: string, now: number = Date.now()): WorkspaceEntry {
    const normalized = normalizeWorkspacePath(input);
    return { path: normalized, name: workspaceName(normalized), openedAt: now };
}

/**
 * Compare two workspace paths, tolerating Windows case differences.
 *
 * @param a - First path.
 * @param b - Second path.
 * @returns True when both refer to the same folder.
 */
function samePath(a: string, b: string): boolean {
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * Move an entry to the front of the recents list.
 *
 * @param recents - Existing recents, newest first.
 * @param entry - Entry to promote.
 * @param max - Maximum number of entries to keep.
 * @returns New list with the entry first, de-duplicated and capped.
 */
export function pushRecent(
    recents: readonly WorkspaceEntry[],
    entry: WorkspaceEntry,
    max: number = MAX_RECENTS,
): WorkspaceEntry[] {
    const withoutEntry = recents.filter((recent) => !samePath(recent.path, entry.path));
    return [entry, ...withoutEntry].slice(0, max);
}

/**
 * Check whether a path is an existing directory.
 *
 * @param candidate - Path to test.
 * @returns True when the path exists and is a directory.
 */
export function isDirectory(candidate: string): boolean {
    try {
        return fs.statSync(candidate).isDirectory();
    } catch {
        return false;
    }
}
