import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import type { CollectionSourcesResult } from '../../shared/ipc';
import { CapNotice, FilterBox, ROW_LIMIT, matchesQuery } from '../filter';
import { CopyButton } from './CopyButton';

/** How often the view asks again while the catalog is downloading. */
const POLL_MS = 2500;

/**
 * Collection Sources section, ported from `ansibleCollectionSources`.
 * @param props - Component properties.
 * @param props.onCopied - Called with a label once a prompt is copied.
 * @returns The collection sources panel.
 */
export function CollectionSourcesView(props: { onCopied: (label: string) => void }): JSX.Element {
    const { onCopied } = props;
    const [result, setResult] = useState<CollectionSourcesResult | null>(null);
    const [query, setQuery] = useState('');

    // One query for both lists: this page is one card with two sources.
    const galaxy = useMemo(
        () => (result?.galaxy ?? []).filter((entry) => matchesQuery(entry.name, query)),
        [result, query],
    );
    const github = useMemo(
        () => (result?.github ?? []).filter((entry) => matchesQuery(entry.org, query)),
        [result, query],
    );
    const filtering = query.trim().length > 0;

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

    return (
        <section className="card">
            <div className="card-header">
                <h2>Collection Sources</h2>
                <FilterBox label="Filter sources" value={query} onChange={setQuery} />
                <span className="muted">
                    {result === null || result.state === 'loading'
                        ? 'loading Galaxy catalog…'
                        : filtering
                          ? `${String(galaxy.length)} of ${String(result.total)} Galaxy collections`
                          : `${String(result.total)} Galaxy collections`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>

            <h3 className="group-label">Galaxy</h3>
            {result === null ? (
                <p className="muted">Reading the collection catalog…</p>
            ) : result.galaxy.length === 0 ? (
                <p className="muted">{result.detail ?? 'No Galaxy collections cached yet.'}</p>
            ) : galaxy.length === 0 ? (
                <p className="muted">No Galaxy collections match “{query}”.</p>
            ) : (
                <>
                    <ul className="item-list">
                        {galaxy.slice(0, ROW_LIMIT).map((collection) => (
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
                    <CapNotice shown={Math.min(galaxy.length, ROW_LIMIT)} matches={galaxy.length} />
                </>
            )}

            <h3 className="group-label">GitHub organizations</h3>
            {result === null || result.github.length === 0 ? (
                <p className="muted">No organization caches found.</p>
            ) : github.length === 0 ? (
                <p className="muted">No organizations match “{query}”.</p>
            ) : (
                <ul className="item-list">
                    {github.map((org) => (
                        <li key={org.org} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{org.org}</span>
                                <span className="item-description">
                                    {org.count === 0
                                        ? 'not cached yet'
                                        : `${String(org.count)} collections`}
                                    {org.lastUpdated === undefined
                                        ? ''
                                        : ` · updated ${new Date(org.lastUpdated).toLocaleDateString()}`}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
