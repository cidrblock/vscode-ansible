import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';

import { BridgeProvider, PluginDocView } from '@ansible/ui';

import type { CollectionEntry, CollectionPluginsResult, SectionId } from '../../shared/ipc';
import { parseCollectionTrail, pluginCrumb, pluginTypeCrumb } from '../collectionPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { CopyButton } from './CopyButton';
import { createPluginDocBridge } from './pluginDocBridge';

export interface CollectionTreeProps {
    /** Section whose trail says how deep the user is. */
    readonly section: SectionId;
    /** Collection being browsed. */
    readonly collection: string;
    /** Installed metadata, when the collection is in this environment. */
    readonly entry?: CollectionEntry;
    /** Content shown above the plugin types, for source metadata. */
    readonly lead?: ReactNode;
    /** Called with a label once a prompt is copied. */
    readonly onCopied: (label: string) => void;
    /** Called with a message the documentation view wants surfaced. */
    readonly onNotice: (message: string) => void;
}

/**
 * The collection → plugin type → plugin → documentation levels.
 *
 * Both Installed Collections and Collection Sources reach these pages, so the
 * levels live here once and each view supplies its own trail section, its own
 * metadata and — when the collection is not installed — nothing to expand.
 * @param props - Component properties.
 * @returns The current level, or the collection page when no type is open.
 */
export function CollectionTree(props: CollectionTreeProps): JSX.Element {
    const { section, collection, entry, lead, onCopied, onNotice } = props;
    const [plugins, setPlugins] = useState<CollectionPluginsResult | null>(null);
    const { trail, push } = useTrail(section);
    const { pluginType, plugin } = parseCollectionTrail(trail);

    useEffect(() => {
        if (pluginType === undefined) {
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

    if (pluginType !== undefined) {
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

    return (
        <section className="card">
            <div className="card-header">
                <h2>{collection}</h2>
                {entry !== undefined && entry.pluginTypes.length > 0 && (
                    <FilterBox
                        label="Filter plugin types"
                        value={types.query}
                        onChange={types.setQuery}
                    />
                )}
                <span className="muted">
                    {entry === undefined
                        ? 'not installed'
                        : `${String(entry.pluginTypes.length)} type${entry.pluginTypes.length === 1 ? '' : 's'} · ${String(entry.pluginCount)} plugins`}
                </span>
                {entry !== undefined && <span className="item-tag">{entry.version}</span>}
            </div>
            {lead}
            {entry === undefined ? (
                <p className="muted">
                    This collection is not installed in the environment navita runs in, so its
                    plugins and documentation are not available here.
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
        </section>
    );
}
