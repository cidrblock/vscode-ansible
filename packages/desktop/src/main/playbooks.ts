/**
 * Playbooks view: playbooks in the workspace and the plays inside them.
 *
 * Reuses `discoverPlaybooks` from packages/services, which validates YAML by
 * parsing it as a list of plays, so role task files and variable files are not
 * reported as playbooks. Each entry carries the same summary prompt the
 * extension's "Generate AI Summary" action copies.
 */

import { buildPlaybookSummaryPrompt, discoverPlaybooks } from '@ansible/developer-services';
import type { DiscoveredPlaybook } from '@ansible/developer-services';

import type { PlaybookEntry, PlaybooksResult, PlayEntry } from '../shared/ipc';

/**
 * Convert a discovered playbook into the IPC payload.
 * @param playbook - Playbook reported by discovery.
 * @returns Entry the renderer can display, including its summary prompt.
 */
export function toPlaybookEntry(playbook: DiscoveredPlaybook): PlaybookEntry {
    const plays: PlayEntry[] = playbook.plays.map((play) => ({
        name: play.name,
        hosts: play.hosts,
        lineNumber: play.lineNumber,
    }));
    return {
        name: playbook.name,
        path: playbook.path,
        relativePath: playbook.relativePath,
        playCount: plays.length,
        plays,
        prompt: buildPlaybookSummaryPrompt(playbook.relativePath, playbook.name),
    };
}

/**
 * Discover the workspace's playbooks.
 *
 * With no workspace open there is nothing to scan, and scanning the current
 * directory would report navita's own checkout.
 *
 * @param workspacePath - Open workspace, or null when none is open.
 * @returns Playbooks plus any failure detail; never throws.
 */
export async function loadPlaybooks(workspacePath: string | null): Promise<PlaybooksResult> {
    if (workspacePath === null) {
        return {
            state: 'error',
            playbooks: [],
            detail: 'Open a workspace to discover its playbooks.',
        };
    }
    try {
        const playbooks = await discoverPlaybooks(workspacePath);
        return { state: 'ready', playbooks: playbooks.map(toPlaybookEntry) };
    } catch (error: unknown) {
        return {
            state: 'error',
            playbooks: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
