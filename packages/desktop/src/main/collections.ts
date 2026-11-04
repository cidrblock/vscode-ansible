/**
 * Installed Collections view: collections visible to the Ansible environment.
 *
 * Wraps CollectionsService from packages/services, which caches to disk for
 * the first paint and refreshes in the background, and flattens its maps into
 * a payload the renderer can hold.
 */

import { CollectionsService, getCommandService } from '@ansible/developer-services';
import type { CollectionData } from '@ansible/developer-services';

import type { CollectionEntry, CollectionsResult } from '../shared/ipc';

/** Shown when the environment cannot answer because ansible-doc is missing. */
export const MISSING_ANSIBLE_DOC =
    'ansible-doc was not found. navita reads collections from the Python environment on PATH; ' +
    'install ansible-dev-tools, or activate the virtual environment that has it.';

/**
 * Flatten collection data into sorted IPC entries.
 * @param collections - Collections reported by CollectionsService.
 * @returns Entries ordered by fully qualified name.
 */
export function toCollectionEntries(collections: Iterable<CollectionData>): CollectionEntry[] {
    const entries: CollectionEntry[] = [];
    for (const collection of collections) {
        const pluginCount = [...collection.pluginTypes.values()].reduce(
            (total, plugins) => total + plugins.length,
            0,
        );
        entries.push({
            name: collection.info.name,
            version: collection.info.version,
            pluginCount,
            ...(collection.info.description === ''
                ? {}
                : { description: collection.info.description }),
            ...(collection.info.path === undefined ? {} : { path: collection.info.path }),
        });
    }
    return entries.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Refresh and read the installed collections.
 *
 * The tool check runs first so a missing ansible-doc is reported as such: the
 * service would otherwise treat the empty answer as data and cache it, leaving
 * every later run with an empty view.
 *
 * @param resolveToolPath - Resolver for an executable; defaults to the shared
 * CommandService so callers get the venv-aware lookup.
 * @returns Collections plus any failure detail; never throws.
 */
export async function loadCollections(
    resolveToolPath: (toolName: string) => Promise<string | null> = (toolName) =>
        getCommandService().getToolPath(toolName),
): Promise<CollectionsResult> {
    const service = CollectionsService.getInstance();
    try {
        if ((await resolveToolPath('ansible-doc')) === null) {
            return { state: 'error', collections: [], detail: MISSING_ANSIBLE_DOC };
        }
        await service.refresh();
        const entries = toCollectionEntries(service.getCollections().values());
        return { state: 'ready', collections: entries };
    } catch (error: unknown) {
        return {
            state: 'error',
            collections: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
