import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import type { CollectionsResult } from '../../shared/ipc';
import { collectionCrumb, parseCollectionTrail } from '../collectionPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { CollectionTree } from './CollectionTree';
import { DrillButton } from './DrillButton';

export interface CollectionsViewProps {
    /** Called with a label once a prompt is copied. */
    readonly onCopied: (label: string) => void;
    /** Called with a message the documentation view wants surfaced. */
    readonly onNotice: (message: string) => void;
}

/**
 * Installed Collections section, ported from `ansibleDevToolsCollections`.
 *
 * The root is the list of installed collections; opening one hands over to the
 * shared `CollectionTree`, which carries the plugin type, plugin and
 * documentation levels for any view that reaches them.
 * @param props - Component properties.
 * @returns The collections panel.
 */
export function CollectionsView(props: CollectionsViewProps): JSX.Element {
    const { onCopied, onNotice } = props;
    const [result, setResult] = useState<CollectionsResult | null>(null);
    const { trail, push } = useTrail('installed-collections');

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getCollections()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    collections: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const { collection } = parseCollectionTrail(trail);

    const collections = useListFilter(
        result?.collections ?? [],
        (item) => `${item.name} ${item.description ?? ''}`,
    );

    const entry = useMemo(
        () => result?.collections.find((item) => item.name === collection),
        [result, collection],
    );

    if (collection !== undefined) {
        return (
            <CollectionTree
                section="installed-collections"
                collection={collection}
                {...(entry === undefined ? {} : { entry })}
                onCopied={onCopied}
                onNotice={onNotice}
            />
        );
    }

    return (
        <section className="card">
            <div className="card-header">
                <h2>Installed Collections</h2>
                <FilterBox
                    label="Filter collections"
                    value={collections.query}
                    onChange={collections.setQuery}
                />
                <span className="muted">
                    {result === null
                        ? '…'
                        : collections.active
                          ? `${String(collections.matches)} of ${String(collections.total)} collections`
                          : `${String(result.collections.length)} collections`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Reading collections from the environment…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not read collections.'}</p>
            ) : result.collections.length === 0 ? (
                <p className="muted">
                    No collections found. Install ansible-core in this environment.
                </p>
            ) : collections.active && collections.items.length === 0 ? (
                <p className="muted">No collections match “{collections.query}”.</p>
            ) : (
                <>
                    <ul className="item-list">
                        {collections.items.map((item) => (
                            <li key={item.name} className="item-row">
                                <div className="item-main">
                                    <span className="item-title">{item.name}</span>
                                    {item.description !== undefined && (
                                        <span className="item-description">{item.description}</span>
                                    )}
                                    <span className="item-description">
                                        {String(item.pluginTypes.length)} types ·{' '}
                                        {String(item.pluginCount)} plugins
                                        {item.path === undefined ? '' : ` · ${item.path}`}
                                    </span>
                                </div>
                                <span className="item-tag">{item.version}</span>
                                <DrillButton
                                    label={item.name}
                                    onOpen={() => {
                                        push(collectionCrumb(item.name));
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                    <CapNotice shown={collections.items.length} matches={collections.matches} />
                </>
            )}
        </section>
    );
}
