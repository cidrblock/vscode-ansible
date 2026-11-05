import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import type {
    CollectionSourcesResult,
    GitHubOrgSource,
    SourceCollectionRef,
} from '../../shared/ipc';
import { collectionCrumb, parseCollectionTrail } from '../collectionPath';
import { CapNotice, FilterBox, filterItems } from '../filter';
import { useTrail } from '../navigation';
import { CollectionTree } from './CollectionTree';
import { CopyButton } from './CopyButton';
import { DrillButton } from './DrillButton';

/** How often the view asks again while a catalog or organization scan is running. */
const POLL_MS = 2500;

/** Trail id of the Galaxy catalog page. */
const GALAXY_ID = 'galaxy';

/** Trail id prefix for one GitHub organization page. */
const ORG_PREFIX = 'github:';

/**
 * Describe a GitHub organization cache in one line.
 * @param org - Cached organization.
 * @returns Collection count plus, when known, when it was last scanned.
 */
function orgSummary(org: GitHubOrgSource): string {
    if (org.refreshing) {
        return 'scanning GitHub…';
    }
    const count = org.count === 0 ? 'not cached yet' : `${String(org.count)} collections`;
    if (org.lastUpdated === undefined) {
        return count;
    }
    return `${count} · scanned ${new Date(org.lastUpdated).toLocaleDateString()}`;
}

/**
 * Collection Sources section, ported from `ansibleCollectionSources`.
 *
 * The root is a list of sources; opening one pushes a crumb, so the breadcrumb
 * and Back behave like every other drill-down in the app. Galaxy browses the
 * whole catalog behind a filter; an organization lists the collections its
 * cache holds, which the extension populates by scanning galaxy.yml files, and
 * navita can populate the same way through the service's token resolver.
 * Opening a collection goes one level further: its metadata comes from the
 * source, and its plugins come from the shared `CollectionTree` when the
 * collection is installed.
 * @param props - Component properties.
 * @param props.onCopied - Called with a label once a prompt is copied.
 * @param props.onNotice - Called with a message the documentation view wants surfaced.
 * @returns The collection sources panel.
 */
export function CollectionSourcesView(props: {
    onCopied: (label: string) => void;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { onCopied, onNotice } = props;
    const [result, setResult] = useState<CollectionSourcesResult | null>(null);
    const [galaxyQuery, setGalaxyQuery] = useState('');
    const [orgQuery, setOrgQuery] = useState('');
    const { trail, push } = useTrail('collection-sources');

    const apply = useCallback((next: Promise<CollectionSourcesResult>) => {
        next.then(setResult).catch((error: unknown) => {
            setResult({
                state: 'error',
                total: 0,
                galaxy: [],
                github: [],
                detail: error instanceof Error ? error.message : String(error),
            });
        });
    }, []);

    const load = useCallback(() => {
        apply(window.navita.getCollectionSources());
    }, [apply]);

    useEffect(() => {
        load();
    }, [load]);

    const scanning = result?.github.some((org) => org.refreshing) === true;

    useEffect(() => {
        if (result?.state !== 'loading' && !scanning) {
            return undefined;
        }
        const timer = setTimeout(load, POLL_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [result, scanning, load]);

    const galaxyCatalogue = useMemo(
        () => filterItems(result?.galaxy ?? [], (entry) => entry.name, galaxyQuery),
        [result, galaxyQuery],
    );

    const { collection } = parseCollectionTrail(trail);
    const origin = trail.at(0);

    const open = trail.at(-1);

    const org = useMemo(() => {
        if (open?.id.startsWith(ORG_PREFIX) !== true) {
            return undefined;
        }
        const name = open.id.slice(ORG_PREFIX.length);
        return result?.github.find((entry) => entry.org === name);
    }, [open, result]);

    const orgCatalogue = useMemo(
        () =>
            filterItems(
                org?.collections ?? [],
                (entry) => `${entry.name} ${entry.description}`,
                orgQuery,
            ),
        [org, orgQuery],
    );

    const scanOrg = useCallback(
        (name: string) => {
            apply(window.navita.refreshCollectionSource(name));
        },
        [apply],
    );

    if (result !== null && result.state === 'error') {
        return (
            <section className="card">
                <div className="card-header">
                    <h2>Collection Sources</h2>
                </div>
                <p className="muted">{result.detail ?? 'Could not read collection sources.'}</p>
            </section>
        );
    }

    if (collection !== undefined) {
        // Metadata belongs to the source it was opened from: the Galaxy catalog
        // knows downloads, an organization cache knows the repository.
        const orgName = origin?.id.startsWith(ORG_PREFIX)
            ? origin.id.slice(ORG_PREFIX.length)
            : undefined;
        const galaxyEntry =
            orgName === undefined
                ? result?.galaxy.find((entry) => entry.name === collection)
                : undefined;
        const orgEntry =
            orgName === undefined
                ? undefined
                : result?.github
                      .find((entry) => entry.org === orgName)
                      ?.collections.find((entry) => entry.name === collection);
        const prompt = galaxyEntry?.prompt ?? orgEntry?.prompt;
        const dot = collection.indexOf('.');
        const namespace = dot === -1 ? collection : collection.slice(0, dot);
        const name = dot === -1 ? collection : collection.slice(dot + 1);
        const source: SourceCollectionRef =
            orgEntry === undefined
                ? {
                      kind: 'galaxy',
                      namespace,
                      name,
                      version: galaxyEntry?.version ?? '',
                  }
                : {
                      kind: 'scm',
                      namespace,
                      name,
                      version: orgEntry.version,
                      repository: orgEntry.repository,
                  };

        const lead = (
            <>
                {orgEntry !== undefined && orgEntry.description.length > 0 && (
                    <p className="muted">{orgEntry.description}</p>
                )}
                <dl className="status-list">
                    <dt>Source</dt>
                    <dd>{orgName ?? 'Galaxy catalog'}</dd>
                    <dt>Latest version</dt>
                    <dd>{galaxyEntry?.version ?? orgEntry?.version ?? 'unknown'}</dd>
                    {galaxyEntry !== undefined && (
                        <>
                            <dt>Downloads</dt>
                            <dd>{galaxyEntry.downloadCount.toLocaleString()}</dd>
                        </>
                    )}
                    {orgEntry !== undefined && (
                        <>
                            <dt>Repository</dt>
                            <dd>{orgEntry.repository}</dd>
                        </>
                    )}
                    {galaxyEntry?.deprecated === true && (
                        <>
                            <dt>Deprecated</dt>
                            <dd>yes</dd>
                        </>
                    )}
                </dl>
                {prompt !== undefined && (
                    <div className="lead-actions">
                        <CopyButton label={collection} prompt={prompt} onCopied={onCopied} />
                        <span className="muted">Copy an AI summary prompt for this collection</span>
                    </div>
                )}
            </>
        );

        return (
            <CollectionTree
                section="collection-sources"
                collection={collection}
                source={source}
                lead={lead}
                onCopied={onCopied}
                onNotice={onNotice}
            />
        );
    }

    if (open?.id === GALAXY_ID) {
        return (
            <section className="card">
                <div className="card-header">
                    <h2>Galaxy</h2>
                    <FilterBox
                        label="Filter collections"
                        value={galaxyQuery}
                        onChange={setGalaxyQuery}
                    />
                    <span className="muted">
                        {result === null
                            ? 'loading Galaxy catalog…'
                            : result.state === 'loading'
                              ? (result.detail ?? 'loading Galaxy catalog…')
                              : galaxyQuery.trim().length > 0
                                ? `${String(galaxyCatalogue.matches)} of ${String(result.total)} collections`
                                : `${String(result.total)} collections`}
                    </span>
                    <button className="ghost" onClick={load}>
                        Reload
                    </button>
                </div>
                {result === null ? (
                    <p className="muted">Reading the collection catalog…</p>
                ) : result.state === 'loading' ? (
                    <p className="muted">
                        The catalog downloads once into navita&apos;s cache, then loads from disk
                        instantly. This page fills in when it finishes.
                    </p>
                ) : result.galaxy.length === 0 ? (
                    <p className="muted">{result.detail ?? 'No Galaxy collections cached yet.'}</p>
                ) : galaxyCatalogue.matches === 0 ? (
                    <p className="muted">No collections match “{galaxyQuery}”.</p>
                ) : (
                    <>
                        <ul className="item-list">
                            {galaxyCatalogue.items.map((collection) => (
                                <li key={collection.name} className="item-row">
                                    <div className="item-main">
                                        <span className="item-title">{collection.name}</span>
                                        <span className="item-description">
                                            {String(collection.downloadCount)} downloads
                                        </span>
                                    </div>
                                    {collection.deprecated && (
                                        <span className="item-tag">deprecated</span>
                                    )}
                                    <span className="item-tag">{collection.version}</span>
                                    <CopyButton
                                        label={collection.name}
                                        prompt={collection.prompt}
                                        onCopied={onCopied}
                                    />
                                    <DrillButton
                                        label={collection.name}
                                        onOpen={() => {
                                            push(collectionCrumb(collection.name));
                                        }}
                                    />
                                </li>
                            ))}
                        </ul>
                        <CapNotice
                            shown={galaxyCatalogue.items.length}
                            matches={galaxyCatalogue.matches}
                        />
                    </>
                )}
            </section>
        );
    }

    if (open?.id.startsWith(ORG_PREFIX)) {
        const name = open.id.slice(ORG_PREFIX.length);
        return (
            <section className="card">
                <div className="card-header">
                    <h2>{name}</h2>
                    {org !== undefined && org.collections.length > 0 && (
                        <FilterBox
                            label="Filter collections"
                            value={orgQuery}
                            onChange={setOrgQuery}
                        />
                    )}
                    <span className="muted">
                        {org === undefined
                            ? '…'
                            : org.refreshing
                              ? 'scanning…'
                              : orgQuery.trim().length > 0
                                ? `${String(orgCatalogue.matches)} of ${String(org.count)} collections`
                                : `${String(org.count)} collections`}
                    </span>
                    <button
                        className="ghost"
                        disabled={org?.refreshing === true}
                        onClick={() => {
                            scanOrg(name);
                        }}
                    >
                        {org?.refreshing === true ? 'Scanning…' : 'Scan now'}
                    </button>
                </div>
                {result === null ? (
                    <p className="muted">Reading the organization cache…</p>
                ) : org === undefined ? (
                    <p className="muted">
                        This organization is no longer in the cache. Back returns to the source
                        list.
                    </p>
                ) : org.error !== undefined ? (
                    <p className="muted">
                        The last scan failed: {org.error}. Scans need a GitHub token — either
                        <code> GH_TOKEN</code> or a <code>gh auth login</code> session.
                    </p>
                ) : org.collections.length === 0 ? (
                    <p className="muted">
                        {org.refreshing
                            ? 'Scanning this organization for galaxy.yml files. One API call per repository, so this takes a while.'
                            : 'Nothing cached yet. Scan now reads every repository in the organization and caches the ones with a galaxy.yml.'}
                    </p>
                ) : orgCatalogue.matches === 0 ? (
                    <p className="muted">No collections match “{orgQuery}”.</p>
                ) : (
                    <>
                        <ul className="item-list">
                            {orgCatalogue.items.map((collection) => (
                                <li key={collection.name} className="item-row">
                                    <div className="item-main">
                                        <span className="item-title">{collection.name}</span>
                                        <span className="item-description">
                                            {collection.description.length > 0
                                                ? collection.description
                                                : collection.repository}
                                        </span>
                                    </div>
                                    <span className="item-tag">{collection.version}</span>
                                    <CopyButton
                                        label={collection.name}
                                        prompt={collection.prompt}
                                        onCopied={onCopied}
                                    />
                                    <DrillButton
                                        label={collection.name}
                                        onOpen={() => {
                                            push(collectionCrumb(collection.name));
                                        }}
                                    />
                                </li>
                            ))}
                        </ul>
                        <CapNotice
                            shown={orgCatalogue.items.length}
                            matches={orgCatalogue.matches}
                        />
                    </>
                )}
            </section>
        );
    }

    const sources = result?.github.length ?? 0;

    return (
        <section className="card">
            <div className="card-header">
                <h2>Collection Sources</h2>
                <span className="muted">
                    {result === null
                        ? '…'
                        : `${String(sources + 1)} source${sources === 0 ? '' : 's'}`}
                </span>
                <button className="ghost" onClick={load}>
                    Reload
                </button>
            </div>
            <ul className="item-list">
                <li className="item-row">
                    <div className="item-main">
                        <span className="item-title">Galaxy catalog</span>
                        <span className="item-description">
                            {result === null
                                ? 'downloading the catalog…'
                                : result.state === 'loading'
                                  ? (result.detail ?? 'downloading the catalog…')
                                  : `${String(result.total)} collections · searchable`}
                        </span>
                    </div>
                    <DrillButton
                        label="Galaxy"
                        title="Browse Galaxy collections"
                        onOpen={() => {
                            push({ id: GALAXY_ID, label: 'Galaxy' });
                        }}
                    />
                </li>
                {(result?.github ?? []).map((orgEntry) => (
                    <li key={orgEntry.org} className="item-row">
                        <div className="item-main">
                            <span className="item-title">{orgEntry.org}</span>
                            <span className="item-description">{orgSummary(orgEntry)}</span>
                        </div>
                        <DrillButton
                            label={orgEntry.org}
                            onOpen={() => {
                                setOrgQuery('');
                                push({
                                    id: `${ORG_PREFIX}${orgEntry.org}`,
                                    label: orgEntry.org,
                                });
                            }}
                        />
                    </li>
                ))}
            </ul>
            {result !== null && result.github.length === 0 && (
                <p className="muted">
                    No GitHub organization caches found. The VS Code extension writes them.
                </p>
            )}
        </section>
    );
}
