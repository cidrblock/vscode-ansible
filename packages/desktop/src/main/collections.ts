/**
 * Installed Collections view: collections visible to the Ansible environment.
 *
 * Wraps CollectionsService from packages/services, which caches to disk for
 * the first paint and refreshes in the background, and flattens its maps into
 * a payload the renderer can hold.
 */

import {
    buildPluginExplanationPrompt,
    CollectionsService,
    getCommandService,
} from '@ansible/developer-services';
import type { CollectionData } from '@ansible/developer-services';

import type {
    CollectionEntry,
    CollectionInstallResult,
    CollectionPluginsResult,
    CollectionsResult,
    PluginDocResult,
    PluginEntry,
} from '../shared/ipc';

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
        const pluginTypes = [...collection.pluginTypes.entries()]
            .map(([type, plugins]) => ({ type, count: plugins.length }))
            .sort((left, right) => left.type.localeCompare(right.type));
        entries.push({
            name: collection.info.name,
            version: collection.info.version,
            pluginCount,
            pluginTypes,
            ...(collection.info.description === ''
                ? {}
                : { description: collection.info.description }),
            ...(collection.info.path === undefined ? {} : { path: collection.info.path }),
        });
    }
    return entries.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Install one collection into the active Python environment.
 *
 * `ade install` is the same call the extension makes, and the service refreshes
 * its index afterwards, so the version it reports is the one now on disk
 * rather than the one the catalog offered. The spec can be an FQCN, an
 * `fqcn:version`, or the `git+https://…` URL a source row carries.
 * @param name - Collection spec to install.
 * @param version - Version to pin; omitted installs the latest the catalog has.
 * @param lookupName - FQCN to report the version for when the spec is a URL.
 * @returns The command output plus the version now installed; never throws.
 */
export async function installCollection(
    name: string,
    version?: string,
    lookupName?: string,
): Promise<CollectionInstallResult> {
    const service = CollectionsService.getInstance();
    try {
        const output = await service.installCollection(name, version);
        const installed = service.getCollection(lookupName ?? name);
        return {
            state: 'ready',
            detail: output.trim(),
            ...(installed === undefined ? {} : { installedVersion: installed.info.version }),
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            detail: error instanceof Error ? error.message : String(error),
        };
    }
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

/**
 * List the plugins of one type inside one collection.
 *
 * The service already holds the parsed metadata, so this is a map lookup plus
 * a prompt per row; the view fetches it when a type is opened rather than
 * carrying every plugin of every collection in the root payload.
 * @param collection - Fully qualified collection name.
 * @param pluginType - Plugin type to list, as `module` or `filter`.
 * @returns The plugins, or an error when the collection is not loaded.
 */
export function loadCollectionPlugins(
    collection: string,
    pluginType: string,
): CollectionPluginsResult {
    const service = CollectionsService.getInstance();
    if (service.getCollection(collection) === undefined) {
        return {
            state: 'error',
            plugins: [],
            detail: `Collection ${collection} is not loaded. Refresh the view and try again.`,
        };
    }
    const plugins: PluginEntry[] = service.getPlugins(collection, pluginType).map((plugin) => ({
        name: plugin.name,
        fullName: plugin.fullName,
        shortDescription: plugin.shortDescription,
        prompt: buildPluginExplanationPrompt(plugin.fullName, pluginType),
    }));
    return { state: 'ready', plugins };
}

/**
 * Documentation for one plugin, straight from `ansible-doc`.
 *
 * The payload is passed through untouched: `PluginDocView` from `@ansible/ui`
 * is the only consumer, and it expects exactly this shape.
 * @param fqcn - Fully qualified plugin name.
 * @param pluginType - Plugin type, used to pick the `ansible-doc` flag.
 * @returns The documentation payload, or an error when ansible-doc has none.
 */
export async function loadPluginDoc(fqcn: string, pluginType: string): Promise<PluginDocResult> {
    const service = CollectionsService.getInstance();
    try {
        const data = await service.getPluginDocumentation(fqcn, pluginType);
        if (data === null) {
            return {
                state: 'error',
                detail: `ansible-doc returned no documentation for ${fqcn}.`,
            };
        }
        return { state: 'ready', data };
    } catch (error: unknown) {
        return {
            state: 'error',
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
