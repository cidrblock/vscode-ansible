import React, { useState, useMemo, useCallback } from 'react';
import { useCollections, usePluginSearch, usePlugins } from '../hooks/useCollections';
import { SearchInput } from '../components/SearchInput';
import { AiAnalysis } from '../components/AiAnalysis';
import { navItem, navItemActive, navItemStacked, navLabel, navMeta, navList, navMuted, navSearchRow } from '../styles/navStyles';

const PLUGIN_TYPES = ['module', 'role', 'lookup', 'filter', 'connection', 'callback', 'inventory'];

interface CollectionsListProps {
    selected: string | null;
    onSelect: (collectionName: string) => void;
}

export function CollectionsList({ selected, onSelect }: CollectionsListProps): React.JSX.Element {
    const { collections, loading, error } = useCollections();
    const { results: searchResults, search } = usePluginSearch();
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = useCallback(
        (query: string) => {
            setSearchQuery(query);
            void search(query);
        },
        [search],
    );

    const filteredCollections = useMemo(() => {
        if (!searchQuery.trim()) return collections;
        const q = searchQuery.toLowerCase();
        return collections.filter((c) => c.name.toLowerCase().includes(q));
    }, [collections, searchQuery]);

    return (
        <div style={navList}>
            <div style={navSearchRow}>
                <SearchInput
                    value={searchQuery}
                    onChange={handleSearch}
                    placeholder="Search..."
                />
            </div>

            {searchQuery && searchResults.length > 0 && (
                <div>
                    <div style={styles.searchHeader}>Matches ({searchResults.length})</div>
                    {searchResults.slice(0, 20).map((r) => (
                        <button
                            key={`${r.collection}.${r.pluginName}`}
                            style={navItem}
                            onClick={() => onSelect(r.collection)}
                        >
                            <span style={navLabel}>{r.pluginName}</span>
                            <span style={navMeta}>{r.collection} · {r.pluginType}</span>
                        </button>
                    ))}
                </div>
            )}

            {loading && <div style={navMuted}>Loading...</div>}
            {error && <div style={styles.error}>{error}</div>}

            {filteredCollections.map((c) => (
                <button
                    key={c.name}
                    style={{
                        ...navItem,
                        ...(selected === c.name ? navItemActive : {}),
                    }}
                    onClick={() => onSelect(c.name)}
                >
                    <span style={navLabel}>{c.name}</span>
                    <span style={navMeta}>{c.version}</span>
                </button>
            ))}
            {!loading && filteredCollections.length === 0 && (
                <div style={navMuted}>
                    {collections.length === 0 ? 'No collections found.' : 'No match.'}
                </div>
            )}
        </div>
    );
}

interface PluginTypeListProps {
    collectionName: string;
    selected: string | null;
    onSelect: (pluginType: string) => void;
}

export function PluginTypeList({ collectionName, selected, onSelect }: PluginTypeListProps): React.JSX.Element {
    return (
        <div style={navList}>
            <div style={styles.collectionHeader}>
                <code style={styles.collectionTitle}>{collectionName}</code>
            </div>
            <AiAnalysis
                prompt={`Analyze the Ansible collection "${collectionName}". Summarize its purpose, what types of automation it enables, its most commonly used modules, and how it fits into a typical Ansible workflow.`}
                label="Analyze collection"
            />
            {PLUGIN_TYPES.map((type) => (
                <button
                    key={type}
                    style={{
                        ...navItem,
                        ...(selected === type ? navItemActive : {}),
                    }}
                    onClick={() => onSelect(type)}
                >
                    <span style={navLabel}>{type}</span>
                </button>
            ))}
        </div>
    );
}

interface PluginListProps {
    collectionName: string;
    pluginType: string;
    selected: string | null;
    onSelect: (pluginFqcn: string) => void;
}

export function PluginList({ collectionName, pluginType, selected, onSelect }: PluginListProps): React.JSX.Element {
    const { plugins, loading } = usePlugins(collectionName, pluginType);

    return (
        <div style={navList}>
            {loading && <div style={navMuted}>Loading...</div>}
            {plugins.map((plugin) => {
                const fqcn = `${collectionName}.${plugin.name}`;
                return (
                    <button
                        key={plugin.name}
                        style={{
                            ...navItemStacked,
                            ...(selected === fqcn ? navItemActive : {}),
                        }}
                        onClick={() => onSelect(fqcn)}
                    >
                        <span style={navLabel}>{plugin.name}</span>
                        {plugin.description && <span style={navMeta}>{plugin.description}</span>}
                    </button>
                );
            })}
            {!loading && plugins.length === 0 && (
                <div style={navMuted}>No {pluginType} plugins</div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    searchHeader: { padding: '6px 12px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '1px solid var(--navita-border)' },
    error: { padding: '8px 12px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-error)' },
    collectionHeader: { padding: '10px 12px 4px', borderBottom: '1px solid var(--navita-border)' },
    collectionTitle: { fontFamily: 'var(--navita-font-mono)', fontSize: 'var(--navita-font-size-sm)', fontWeight: 600 },
};
