/**
 * Collection Sources drill-down: plugins and documentation for a collection
 * that is not installed.
 *
 * The extension never installs a collection to browse it — it reads the
 * published docs-blob from Galaxy, or indexes a repository for GitHub
 * collections. Those two caches are in packages/services, so navita asks them
 * rather than `ansible-doc`, which only knows what is installed here.
 */

import * as path from 'node:path';

import {
    buildPluginExplanationPrompt,
    GalaxyDocsCache,
    SCMDocsCache,
} from '@ansible/developer-services';
import type { PluginInfo } from '@ansible/developer-services';

import type {
    PluginDocResult,
    SourceCollectionRef,
    SourcePluginType,
    SourcePluginsResult,
} from '../shared/ipc';

/**
 * Convert a docs-cache plugin map into IPC groups.
 * @param types - Plugin type to plugins, as the caches return it.
 * @returns Groups ordered by type, each row carrying its explanation prompt.
 */
export function toSourceTypes(types: Record<string, PluginInfo[]>): SourcePluginType[] {
    return Object.entries(types)
        .map(([type, plugins]) => ({
            type,
            plugins: plugins.map((plugin) => ({
                name: plugin.name,
                fullName: plugin.fullName,
                shortDescription: plugin.shortDescription,
                prompt: buildPluginExplanationPrompt(plugin.fullName, type),
            })),
        }))
        .sort((left, right) => left.type.localeCompare(right.type));
}

/**
 * Point the Galaxy docs cache at navita's storage.
 * @param storageDir - navita's per-user data directory.
 */
function configureGalaxyDocs(storageDir: string): void {
    GalaxyDocsCache.getInstance().setExtensionContext({
        globalStorageUri: { fsPath: path.join(storageDir, 'galaxy') },
    });
}

/**
 * Split a repository reference into its organization and name.
 * @param source - Collection to resolve.
 * @returns Organization and repository, defaulting to the namespace and name.
 */
function repositoryParts(source: SourceCollectionRef): [string, string] {
    const repository = source.repository;
    if (repository === undefined) {
        return [source.namespace, source.name];
    }
    const separator = repository.indexOf('/');
    if (separator === -1) {
        return [source.namespace, repository];
    }
    return [repository.slice(0, separator), repository.slice(separator + 1)];
}

/**
 * Plugins of a collection as its source publishes them.
 * @param storageDir - navita's per-user data directory.
 * @param source - Collection to read.
 * @returns Plugin groups, or the reason they could not be read.
 */
export async function loadSourcePlugins(
    storageDir: string,
    source: SourceCollectionRef,
): Promise<SourcePluginsResult> {
    try {
        let types: Record<string, PluginInfo[]> | null;
        if (source.kind === 'galaxy') {
            configureGalaxyDocs(storageDir);
            types = await GalaxyDocsCache.getInstance().getPluginTypes(
                source.namespace,
                source.name,
                source.version,
            );
        } else {
            const [org, repo] = repositoryParts(source);
            types = await SCMDocsCache.getInstance().getPluginTypes(
                org,
                repo,
                source.namespace,
                source.name,
            );
        }
        if (types === null) {
            return {
                state: 'error',
                types: [],
                detail: `No published documentation for ${source.namespace}.${source.name} ${source.version}.`,
            };
        }
        return { state: 'ready', types: toSourceTypes(types) };
    } catch (error: unknown) {
        return {
            state: 'error',
            types: [],
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Documentation for one plugin of a source collection.
 * @param storageDir - navita's per-user data directory.
 * @param source - Collection the plugin belongs to.
 * @param fqcn - Fully qualified plugin name.
 * @param pluginType - Plugin type, as `module`.
 * @returns The documentation payload, or the reason it is missing.
 */
export async function loadSourcePluginDoc(
    storageDir: string,
    source: SourceCollectionRef,
    fqcn: string,
    pluginType: string,
): Promise<PluginDocResult> {
    try {
        let data;
        if (source.kind === 'galaxy') {
            configureGalaxyDocs(storageDir);
            data = await GalaxyDocsCache.getInstance().getPluginDoc(
                source.namespace,
                source.name,
                source.version,
                fqcn,
                pluginType,
            );
        } else {
            const [org, repo] = repositoryParts(source);
            data = await SCMDocsCache.getInstance().getPluginDoc(
                org,
                repo,
                source.namespace,
                source.name,
                fqcn,
                pluginType,
            );
        }
        if (data === null) {
            return {
                state: 'error',
                detail: `The documentation cache has no entry for ${fqcn}.`,
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
