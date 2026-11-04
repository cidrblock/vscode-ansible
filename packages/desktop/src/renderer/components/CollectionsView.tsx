import { useCallback, useEffect, useState, type JSX } from 'react';

import type { CollectionsResult } from '../../shared/ipc';

/**
 * Installed Collections section, ported from `ansibleDevToolsCollections`.
 * @returns The collections panel.
 */
export function CollectionsView(): JSX.Element {
    const [result, setResult] = useState<CollectionsResult | null>(null);

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

    return (
        <section className="card">
            <div className="card-header">
                <h2>Installed Collections</h2>
                <span className="muted">
                    {result === null ? '…' : `${String(result.collections.length)} collections`}
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
            ) : (
                <ul className="item-list">
                    {result.collections.map((collection) => (
                        <li key={collection.name} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{collection.name}</span>
                                {collection.description !== undefined && (
                                    <span className="item-description">
                                        {collection.description}
                                    </span>
                                )}
                                <span className="item-description">
                                    {String(collection.pluginCount)} plugins
                                    {collection.path === undefined ? '' : ` · ${collection.path}`}
                                </span>
                            </div>
                            <span className="item-tag">{collection.version}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
