import { useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';

import { BridgeProvider, PluginDocView } from '@ansible/ui';

import type {
    CollectionEntry,
    CollectionPluginsResult,
    SectionId,
    SourceCollectionRef,
    SourcePluginsResult,
} from '../../shared/ipc';
import { parseCollectionTrail, pluginCrumb, pluginTypeCrumb } from '../collectionPath';
import { CapNotice, FilterBox, useListFilter } from '../filter';
import { useTrail } from '../navigation';
import { CopyButton } from './CopyButton';
import { DrillButton } from './DrillButton';
import { createPluginDocBridge } from './pluginDocBridge';

export interface CollectionTreeProps {
    /** Section whose trail says how deep the user is. */
    readonly section: SectionId;
    /** Collection being browsed. */
    readonly collection: string;
    /** Installed metadata, when the view is about this environment. */
    readonly entry?: CollectionEntry;
    /** Published documentation, when the view is about a source instead. */
    readonly source?: SourceCollectionRef;
    /** Content shown above the plugin types, for source metadata. */
    readonly lead?: ReactNode;
    /** Called with a label once a prompt is copied. */
    readonly onCopied: (label: string) => void;
    /** Called with a message the documentation view wants surfaced. */
    readonly onNotice: (message: string) => void;
}

/**
 * Why a source reference is what it is, as one value for effect dependencies.
 * @param source - Reference, when the view has one.
 * @returns A string that changes only when the reference does.
 */
function sourceKeyOf(source: SourceCollectionRef | undefined): string {
    if (source === undefined) {
        return '';
    }
    return [
        source.kind,
        source.namespace,
        source.name,
        source.version,
        source.repository ?? '',
    ].join('|');
}

/**
 * The collection → plugin type → plugin → documentation levels.
 *
 * Two views reach these pages. Installed Collections reads `ansible-doc` for
 * what is installed; Collection Sources reads the published docs cache so a
 * Galaxy collection can be browsed without installing it, which is what the
 * extension does. Both get the same pages, filters and documentation view.
 * @param props - Component properties.
 * @returns The current level, or the collection page when no type is open.
 */
export function CollectionTree(props: CollectionTreeProps): JSX.Element {
    const { section, collection, entry, source, lead, onCopied, onNotice } = props;
    const [plugins, setPlugins] = useState<CollectionPluginsResult | null>(null);
    const [published, setPublished] = useState<SourcePluginsResult | null>(null);
    const { trail, push } = useTrail(section);
    const { pluginType, plugin } = parseCollectionTrail(trail);

    const sourceKey = sourceKeyOf(source);

    useEffect(() => {
        if (source === undefined) {
            setPublished(null);
            return undefined;
        }
        let active = true;
        setPublished(null);
        window.navita
            .getSourcePlugins(source)
            .then((next) => {
                if (active) {
                    setPublished(next);
                }
            })
            .catch((error: unknown) => {
                if (active) {
                    setPublished({
                        state: 'error',
                        types: [],
                        detail: error instanceof Error ? error.message : String(error),
                    });
                }
            });
        return () => {
            active = false;
        };
        // The reference is rebuilt by the parent each render; its key is what matters.
    }, [sourceKey]);

    useEffect(() => {
        if (source !== undefined || pluginType === undefined) {
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
    }, [collection, pluginType, source]);

    const bridge = useMemo(
        () =>
            createPluginDocBridge({
                showToast: onNotice,
                ...(source === undefined
                    ? {}
                    : {
                          loadDoc: (fqcn: string, type: string) =>
                              window.navita.getSourcePluginDoc(source, fqcn, type),
                      }),
            }),
        // Rebuild when the source reference changes, not on every parent render.
        [onNotice, sourceKey],
    );

    const typeRows =
        source === undefined
            ? (entry?.pluginTypes ?? [])
            : (published?.types ?? []).map((group) => ({
                  type: group.type,
                  count: group.plugins.length,
              }));

    const pluginItems =
        source === undefined
            ? (plugins?.plugins ?? [])
            : (published?.types.find((group) => group.type === pluginType)?.plugins ?? []);

    const pluginState =
        source === undefined
            ? plugins === null
                ? 'loading'
                : plugins.state
            : published === null
              ? 'loading'
              : published.state;

    const types = useListFilter(typeRows, (item) => item.type);
    const pluginRows = useListFilter(
        pluginItems,
        (item) => `${item.name} ${item.shortDescription}`,
    );

    const loading = source !== undefined && published === null;
    const failure =
        source === undefined
            ? undefined
            : published?.state === 'error'
              ? (published.detail ?? 'Could not read the published documentation.')
              : undefined;

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
                        {pluginState === 'loading'
                            ? '…'
                            : pluginRows.active
                              ? `${String(pluginRows.matches)} of ${String(pluginItems.length)} plugins`
                              : `${String(pluginItems.length)} plugins`}
                    </span>
                </div>
                {pluginState === 'loading' ? (
                    <p className="muted">Reading plugins…</p>
                ) : pluginState === 'error' ? (
                    <p className="muted">
                        {source === undefined
                            ? (plugins?.detail ?? 'Could not read plugins.')
                            : (published?.detail ?? 'Could not read the published documentation.')}
                    </p>
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

    const summary = (() => {
        if (loading) {
            return '…';
        }
        if (failure !== undefined) {
            return 'unavailable';
        }
        if (source !== undefined) {
            const total = typeRows.reduce((sum, item) => sum + item.count, 0);
            return `${String(typeRows.length)} type${typeRows.length === 1 ? '' : 's'} · ${String(total)} plugins`;
        }
        if (entry === undefined) {
            return 'not installed';
        }
        return `${String(entry.pluginTypes.length)} type${entry.pluginTypes.length === 1 ? '' : 's'} · ${String(entry.pluginCount)} plugins`;
    })();

    return (
        <section className="card">
            <div className="card-header">
                <h2>{collection}</h2>
                {typeRows.length > 0 && (
                    <FilterBox
                        label="Filter plugin types"
                        value={types.query}
                        onChange={types.setQuery}
                    />
                )}
                <span className="muted">{summary}</span>
                {source === undefined && entry !== undefined && (
                    <span className="item-tag">{entry.version}</span>
                )}
            </div>
            {lead}
            {loading ? (
                <p className="muted">Reading this collection&apos;s published documentation…</p>
            ) : failure !== undefined ? (
                <p className="muted">{failure}</p>
            ) : source === undefined && entry === undefined ? (
                <p className="muted">
                    This collection is not installed in the environment navita runs in, so its
                    plugins and documentation are not available here.
                </p>
            ) : typeRows.length === 0 ? (
                <p className="muted">This collection publishes no plugins.</p>
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
                            <DrillButton
                                label={`${collection} ${item.type}`}
                                title={`Open ${item.type} plugins`}
                                onOpen={() => {
                                    push(pluginTypeCrumb(collection, item.type));
                                }}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
