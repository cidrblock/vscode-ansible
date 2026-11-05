/**
 * Pure presentation helpers for the Playbooks view.
 *
 * Kept out of the renderer component so both the view and its tests can use
 * them without pulling in JSX.
 */

import type { PlaybookEntry } from './ipc';

/** Playbooks that share a folder, as the view lists them. */
export interface PlaybookFolder {
    readonly folder: string;
    readonly playbooks: readonly PlaybookEntry[];
}

/**
 * Group playbooks by the folder that holds them, so a large workspace reads as
 * a hierarchy instead of one long list.
 * @param playbooks - Playbooks to group.
 * @returns Folder label and its playbooks, sorted by label then name.
 */
export function groupByFolder(playbooks: readonly PlaybookEntry[]): PlaybookFolder[] {
    const groups = new Map<string, PlaybookEntry[]>();
    for (const playbook of playbooks) {
        // Discovery reports platform separators, so normalise before splitting.
        const relativePath = playbook.relativePath.replaceAll('\\', '/');
        const separator = relativePath.lastIndexOf('/');
        const folder = separator <= 0 ? '.' : relativePath.slice(0, separator);
        const bucket = groups.get(folder);
        if (bucket === undefined) {
            groups.set(folder, [playbook]);
        } else {
            bucket.push(playbook);
        }
    }
    return [...groups.entries()]
        .map(([folder, entries]) => ({
            folder,
            playbooks: [...entries].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .sort((left, right) => left.folder.localeCompare(right.folder));
}
