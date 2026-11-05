import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { BridgeProvider, PluginDocView } from '@ansible/ui';

import type { CollectionPluginsResult, CollectionsResult } from '../../shared/ipc';
import {
    collectionCrumb,
    parseCollectionTrail,
    pluginCrumb,
    pluginTypeCrumb,
} from '../collectionPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { CopyButton } from './CopyButton';
import { createPluginDocBridge } from './pluginDocBridge';

export interface CollectionsViewProps {
    /** Called with a label once a prompt is copied. */
    readonly onCopied: (label: string) => void;
    /** Called with a message the documentation view wants surfaced. */
    readonly onNotice: (message: string) => void;
}

/**
 * Installed Collections section, ported from `ansibleDevToolsCollections`.
 *
 * Depth follows the extension's tree — collection, plugin type, plugin — and
 * adds the plugin documentation page the extension opens as a webview. Every
 * level comes from the shared trail, so Back and the breadcrumbs work without
 * the view tracking its own position.
 * @param props - Component properties.
 * @returns The collections panel.
 */
export function CollectionsView(props: CollectionsViewProps): JSX.Element {
    const { onCopied, onNotice } = props;
    const [result, setResult] = useState<CollectionsResult | null>(null);
    const [plugins, setPlugins] = useState<CollectionPluginsResult | null>(null);
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

    const { collection, pluginType, plugin } = parseCollectionTrail(trail);

    useEffect(() => {
        if (collection === undefined || pluginType === undefined) {
            setPlugins(null);
            return undefined;
        }
        let active = true;
        setPlugins(null);
        window.navita
            .getCollectionPlugins(collection, pluginType)
            .then((next) => {
                if (active) {
                    setPlugins(next);
                }
            })
            .catch((error: unknown) => {
                if (active) {
                    setPlugins({
                        state: 'error',
                        plugins: [],
                        detail: error instanceof Error ? error.message : String(error),
                    });
                }
            });
        return () => {
            active = false;
        };
    }, [collection, pluginType]);

    const bridge = useMemo(() => createPluginDocBridge({ showToast: onNotice }), [onNotice]);

    const entry = useMemo(
        () => result?.collections.find((item) => item.name === collection),
        [result, collection],
    );

    const collections = useListFilter(
        result?.collections ?? [],
        (item) => `${item.name} ${item.description ?? ''}`,
    );
    const types = useListFilter(entry?.pluginTypes ?? [], (item) => item.type);
    const pluginRows = useListFilter(
        plugins?.plugins ?? [],
        (item) => `${item.name} ${item.shortDescription}`,
    );

    if (plugin !== undefined && pluginType !== undefined) {
        return (
            <BridgeProvider value={bridge}>
                <PluginDocView fqcn={plugin} pluginType={pluginType} />
            </BridgeProvider>
        );
    }

    if (collection !== undefined && pluginType !== undefined) {
        return (
            <section className="card">
                <div className="card-header">
                    <h2>{pluginType}</h2>
                    <FilterBox
                        label="Filter plugins"
                        value={pluginRows.query}
                        onChange={pluginRows.setQuery}
                    />
                    <span className="muted">
                        {plugins === null
                            ? '…'
                            : pluginRows.active
                              ? `${String(pluginRows.matches)} of ${String(plugins.plugins.length)} plugins`
                              : `${String(plugins.plugins.length)} plugins`}
                    </span>
                </div>
                {plugins === null ? (
                    <p className="muted">Reading plugins…</p>
                ) : plugins.state === 'error' ? (
                    <p className="muted">{plugins.detail ?? 'Could not read plugins.'}</p>
                ) : pluginRows.active && pluginRows.items.length === 0 ? (
                    <p className="muted">No plugins match “{pluginRows.query}”.</p>
                ) : (
                    <>
                        <ul className="item-list">
                            {pluginRows.items.map((item) => (
                                <li key={item.fullName} className="item-row">
                                    <div className="item-main">
                                        <span className="item-title">{item.name}</span>
                                        <span className="item-description">
                                            {item.shortDescription}
                                        </span>
                                    </div>
                                    <button
                                        className="ghost"
                                        onClick={() => {
                                            push(pluginCrumb(item.fullName, pluginType));
                                        }}
                                    >
                                        Docs
                                    </button>
                                    <CopyButton
                                        label={item.fullName}
                                        prompt={item.prompt}
                                        onCopied={onCopied}
                                    />
                                </li>
                            ))}
                        </ul>
                        <CapNotice shown={pluginRows.items.length} matches={pluginRows.matches} />
                    </>
                )}
            </section>
        );
    }

    if (collection !== undefined) {
        return (
            <section className="card">
                <div className="card-header">
                    <h2>{collection}</h2>
                    <FilterBox
                        label="Filter plugin types"
                        value={types.query}
                        onChange={types.setQuery}
                    />
                    <span className="muted">
                        {entry === undefined
                            ? '…'
                            : `${String(entry.pluginTypes.length)} types · ${String(entry.pluginCount)} plugins`}
                    </span>
                    <span className="muted">{entry?.version ?? ''}</span>
                </div>
                {entry === undefined ? (
                    <p className="muted">
                        {result === null
                            ? 'Reading collections from the environment…'
                            : 'This collection is no longer loaded. Back returns to the list.'}
                    </p>
                ) : entry.pluginTypes.length === 0 ? (
                    <p className="muted">This collection reports no plugin types.</p>
                ) : types.active && types.items.length === 0 ? (
                    <p className="muted">No plugin types match “{types.query}”.</p>
                ) : (
                    <ul className="item-list">
                        {types.items.map((item) => (
                            <li key={item.type} className="item-row">
                                <div className="item-main">
                                    <span className="item-title">{item.type}</span>
                                    <span className="item-description">
                                        {String(item.count)} plugin{item.count === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <button
                                    className="ghost"
                                    onClick={() => {
                                        push(pluginTypeCrumb(collection, item.type));
                                    }}
                                >
                                    Open
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {entry?.description !== undefined && entry.description.length > 0 && (
                    <p className="muted">{entry.description}</p>
                )}
            </section>
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
                                <button
                                    className="ghost"
                                    onClick={() => {
                                        push(collectionCrumb(item.name));
                                    }}
                                >
                                    Open
                                </button>
                            </li>
                        ))}
                    </ul>
                    <CapNotice shown={collections.items.length} matches={collections.matches} />
                </>
            )}
        </section>
    );
}
