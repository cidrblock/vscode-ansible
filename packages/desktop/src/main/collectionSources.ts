/**
 * Collection Sources view: the Galaxy catalog and GitHub org caches.
 *
 * Both caches come from packages/services. The Galaxy catalog is thousands of
 * entries fetched page by page, so the first call starts the fetch in the
 * background and the renderer polls until it is there instead of blocking an
 * IPC round trip for the whole download.
 */

import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';

import {
    buildCollectionSummaryPrompt,
    GalaxyCollectionCache,
    GitHubCollectionCache,
} from '@ansible/developer-services';
import type { GalaxyCollection, GitHubCollection } from '@ansible/developer-services';

import type {
    CollectionSourceEntry,
    CollectionSourcesResult,
    GitHubCollectionEntry,
    GitHubOrgSource,
} from '../shared/ipc';

/** Organizations the extension scans by default. */
export const DEFAULT_GITHUB_ORGS = ['ansible', 'ansible-collections', 'redhat-cop'] as const;

/** How many Galaxy collections the view lists before asking for a search. */
export const GALAXY_LIMIT = 50;

/**
 * Convert Galaxy catalog rows into IPC entries.
 * @param collections - Collections from the cache.
 * @returns Entries with the summary prompt attached to each row.
 */
export function toGalaxyEntries(collections: readonly GalaxyCollection[]): CollectionSourceEntry[] {
    return collections.map((collection) => {
        const name = `${collection.namespace}.${collection.name}`;
        return {
            name,
            version: collection.version,
            downloadCount: collection.downloadCount,
            deprecated: collection.deprecated,
            prompt: buildCollectionSummaryPrompt(name),
        };
    });
}

const run = promisify(execFile);

/** Environment variables navita will take a GitHub token from, in order. */
const TOKEN_ENV_VARS = ['GH_TOKEN', 'GIT_TOKEN', 'GITHUB_TOKEN'] as const;

/**
 * Resolve a GitHub token the way a CLI on this machine would.
 *
 * The service's own path is `vscode.authentication.getSession`, which does not
 * exist in Electron. A token in the environment wins; otherwise ask `gh`, which
 * is where the same token lives for anyone who has run `gh auth login`.
 * @returns A bearer token, or undefined when neither source has one.
 */
export async function resolveGitHubToken(): Promise<string | undefined> {
    for (const name of TOKEN_ENV_VARS) {
        const value = process.env[name];
        if (value !== undefined && value.length > 0) {
            return value;
        }
    }
    try {
        const { stdout } = await run('gh', ['auth', 'token'], { timeout: 5000 });
        const token = stdout.trim();
        return token.length > 0 ? token : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Convert GitHub collections into IPC rows.
 * @param collections - Collections from an organization cache.
 * @returns Entries with the summary prompt attached to each row.
 */
export function toGitHubEntries(collections: readonly GitHubCollection[]): GitHubCollectionEntry[] {
    return collections.map((collection) => {
        const name = `${collection.namespace}.${collection.name}`;
        return {
            name,
            version: collection.version,
            description: collection.description,
            repository: collection.repository,
            htmlUrl: collection.htmlUrl,
            prompt: buildCollectionSummaryPrompt(name),
        };
    });
}

/**
 * Read the GitHub org caches that are already on disk.
 * @param orgs - Organizations to report.
 * @returns One entry per organization, with its cached collections.
 */
export function readGitHubOrgs(orgs: readonly string[]): GitHubOrgSource[] {
    const cache = GitHubCollectionCache.getInstance();
    return orgs.map((org) => {
        const loaded = cache.loadFromDisk(org);
        const error = cache.getLastError(org);
        return {
            org,
            count: cache.getCount(org),
            ...(loaded === undefined ? {} : { lastUpdated: loaded.lastUpdated }),
            collections: toGitHubEntries(cache.getCollections(org)),
            refreshing: cache.isRefreshing(org),
            ...(error === undefined ? {} : { error }),
        };
    });
}

/**
 * Start scanning one organization in the background.
 *
 * The scan is a pile of GitHub API calls, so it cannot be awaited inside an IPC
 * round trip. The caller polls `getCollectionSources` instead, and `refreshing`
 * on the org tells it when to stop.
 * @param storageDir - Directory navita keeps its Galaxy cache in.
 * @param org - GitHub organization to rescan.
 * @returns The current sources, with that organization marked as refreshing.
 */
export function refreshCollectionSource(storageDir: string, org: string): CollectionSourcesResult {
    const cache = GitHubCollectionCache.getInstance();
    cache.setTokenResolver(resolveGitHubToken);
    void cache.refresh(org);
    return loadCollectionSources(storageDir, { startLoad: false });
}

/**
 * Read the collection sources.
 * @param storageDir - Directory navita keeps its Galaxy cache in.
 * @param options - Behaviour for this read.
 * @param options.startLoad - False reports state without starting a fetch.
 * @returns Galaxy entries, GitHub org counts, and whether Galaxy is still loading.
 */
export function loadCollectionSources(
    storageDir: string,
    options: { readonly startLoad?: boolean } = {},
): CollectionSourcesResult {
    GitHubCollectionCache.getInstance().setTokenResolver(resolveGitHubToken);
    const github = readGitHubOrgs(DEFAULT_GITHUB_ORGS);
    try {
        const galaxy = GalaxyCollectionCache.getInstance();
        galaxy.setExtensionContext({
            globalStorageUri: { fsPath: path.join(storageDir, 'galaxy') },
        });
        if (!galaxy.isLoaded()) {
            if (options.startLoad !== false) {
                galaxy.startBackgroundLoad();
            }
            const progress = galaxy.getProgress();
            return {
                state: 'loading',
                total: progress.loaded,
                galaxy: [],
                github,
                detail:
                    progress.total === 0
                        ? 'Fetching the Galaxy collection catalog…'
                        : `Fetching Galaxy collections: ${String(progress.loaded)} of ${String(progress.total)}…`,
            };
        }
        const collections = galaxy.getTopCollections(GALAXY_LIMIT);
        return {
            state: 'ready',
            total: galaxy.getCollections().length,
            galaxy: toGalaxyEntries(collections),
            github,
        };
    } catch (error: unknown) {
        return {
            state: 'error',
            total: 0,
            galaxy: [],
            github,
            detail: error instanceof Error ? error.message : String(error),
        };
    }
}
