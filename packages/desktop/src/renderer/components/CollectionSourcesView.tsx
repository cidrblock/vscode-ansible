import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import type { CollectionSourcesResult, GitHubOrgSource } from '../../shared/ipc';
import { CapNotice, FilterBox, filterItems } from '../filter';
import { useTrail } from '../navigation';
import { CopyButton } from './CopyButton';

/** How often the view asks again while the catalog is downloading. */
const POLL_MS = 2500;

/** Trail id of the Galaxy catalog page. */
const GALAXY_ID = 'galaxy';

/** Trail id prefix for one GitHub organization page. */
const ORG_PREFIX = 'github:';

/**
 * Describe a GitHub organization cache in one line.
 * @param org - Cached organization.
 * @returns Collection count plus, when known, when it was refreshed.
 */
function orgSummary(org: GitHubOrgSource): string {
    const count = org.count === 0 ? 'not cached yet' : `${String(org.count)} collections`;
    if (org.lastUpdated === undefined) {
        return count;
    }
    return `${count} · updated ${new Date(org.lastUpdated).toLocaleDateString()}`;
}

/**
 * Collection Sources section, ported from `ansibleCollectionSources`.
 *
 * The root is a list of sources; opening one pushes a crumb, so the breadcrumb
 * and Back behave like every other drill-down in the app. Galaxy browses the
 * whole catalog behind a filter; an organization page shows what its cache
 * actually holds, which today is counts rather than collection names.
 * @param props - Component properties.
 * @param props.onCopied - Called with a label once a prompt is copied.
 * @returns The collection sources panel.
 */
export function CollectionSourcesView(props: { onCopied: (label: string) => void }): JSX.Element {
    const { onCopied } = props;
    const [result, setResult] = useState<CollectionSourcesResult | null>(null);
    const [query, setQuery] = useState('');
    const { trail, push } = useTrail('collection-sources');

    const load = useCallback(() => {
        window.navita
            .getCollectionSources()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    total: 0,
                    galaxy: [],
                    github: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (result?.state !== 'loading') {
            return undefined;
        }
        const timer = setTimeout(load, POLL_MS);
        return () => {
            clearTimeout(timer);
        };
    }, [result, load]);

    const galaxyCatalogue = useMemo(
        () => filterItems(result?.galaxy ?? [], (entry) => entry.name, query),
        [result, query],
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

    const open = trail.at(-1);

    if (open?.id === GALAXY_ID) {
        return (
            <section className="card">
                <div className="card-header">
                    <h2>Galaxy</h2>
                    <FilterBox label="Filter collections" value={query} onChange={setQuery} />
                    <span className="muted">
                        {result === null
                            ? 'loading Galaxy catalog…'
                            : result.state === 'loading'
                              ? (result.detail ?? 'loading Galaxy catalog…')
                              : query.trim().length > 0
                                ? `${String(galaxyCatalogue.matches)} of ${String(result.total)} collections`
                                : `${String(result.total)} collections`}
                    </span>
                    <button className="ghost" onClick={load}>
                        Refresh
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
                    <p className="muted">No collections match “{query}”.</p>
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
        const org = result?.github.find((entry) => entry.org === name);
        return (
            <section className="card">
                <div className="card-header">
                    <h2>{name}</h2>
                    <button className="ghost" onClick={load}>
                        Refresh
                    </button>
                </div>
                {result === null ? (
                    <p className="muted">Reading the organization cache…</p>
                ) : org === undefined ? (
                    <p className="muted">
                        This organization is no longer in the cache. Back returns to the source
                        list.
                    </p>
                ) : (
                    <>
                        <dl className="status-list">
                            <dt>Collections</dt>
                            <dd>{org.count === 0 ? 'not cached yet' : String(org.count)}</dd>
                            <dt>Last updated</dt>
                            <dd>
                                {org.lastUpdated === undefined
                                    ? 'unknown'
                                    : new Date(org.lastUpdated).toLocaleString()}
                            </dd>
                        </dl>
                        <p className="muted">
                            navita reads this from the VS Code extension&apos;s organization cache,
                            which records counts rather than collection names. Fetching the
                            organization itself is still an open question.
                        </p>
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
                    Refresh
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
                    <button
                        className="ghost"
                        onClick={() => {
                            push({ id: GALAXY_ID, label: 'Galaxy' });
                        }}
                    >
                        Browse
                    </button>
                </li>
                {(result?.github ?? []).map((org) => (
                    <li key={org.org} className="item-row">
                        <div className="item-main">
                            <span className="item-title">{org.org}</span>
                            <span className="item-description">{orgSummary(org)}</span>
                        </div>
                        <button
                            className="ghost"
                            onClick={() => {
                                push({ id: `${ORG_PREFIX}${org.org}`, label: org.org });
                            }}
                        >
                            Open
                        </button>
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
