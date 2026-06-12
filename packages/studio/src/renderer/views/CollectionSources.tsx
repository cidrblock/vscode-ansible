import React, { useState } from 'react';
import { api } from '../api';
import { AiAnalysis } from '../components/AiAnalysis';
import { navItemStacked, navItemActive, navLabel, navMeta, navList, navSearchRow } from '../styles/navStyles';
import type { GalaxyCollectionInfo, GitHubCollectionInfo } from '../../shared/types';

interface SourceResult {
    name: string;
    source: 'Galaxy' | 'GitHub';
    version: string;
}

interface CollectionSourceSearchProps {
    selected: string | null;
    onSelect: (key: string) => void;
}

export function CollectionSourceSearch({ selected, onSelect }: CollectionSourceSearchProps): React.JSX.Element {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<SourceResult[]>([]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        try {
            const [galaxy, github] = await Promise.all([
                api.searchGalaxyCollections(query),
                api.searchGitHubCollections(query),
            ]);
            setResults([
                ...galaxy.map((c: GalaxyCollectionInfo) => ({ name: c.name, source: 'Galaxy' as const, version: c.version })),
                ...github.map((c: GitHubCollectionInfo) => ({ name: c.name, source: 'GitHub' as const, version: c.default_branch ?? '' })),
            ]);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div style={navList}>
            <div style={navSearchRow}>
                <input
                    style={styles.input}
                    type="text"
                    placeholder="Search Galaxy and GitHub..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                />
                <button style={styles.searchBtn} onClick={() => void handleSearch()} disabled={searching}>
                    {searching ? '...' : 'Go'}
                </button>
            </div>
            {results.map((c) => {
                const key = `${c.source}-${c.name}`;
                return (
                    <button
                        key={key}
                        style={{ ...navItemStacked, ...(selected === key ? navItemActive : {}) }}
                        onClick={() => onSelect(key)}
                    >
                        <span style={navLabel}>{c.name}</span>
                        <span style={navMeta}>{c.source} {c.version && `\u00B7 ${c.version}`}</span>
                    </button>
                );
            })}
        </div>
    );
}

interface CollectionSourceDetailProps {
    sourceKey: string;
}

export function CollectionSourceDetail({ sourceKey }: CollectionSourceDetailProps): React.JSX.Element {
    const [installing, setInstalling] = useState(false);
    const [installed, setInstalled] = useState(false);

    const dashIdx = sourceKey.indexOf('-');
    const source = sourceKey.substring(0, dashIdx);
    const name = sourceKey.substring(dashIdx + 1);

    const handleInstall = async () => {
        setInstalling(true);
        try {
            await api.installCollection(name);
            setInstalled(true);
        } finally {
            setInstalling(false);
        }
    };

    return (
        <div style={styles.detail}>
            <code style={styles.detailTitle}>{name}</code>
            <div style={styles.detailMeta}>Source: {source}</div>
            <AiAnalysis
                prompt={`Tell me about the Ansible collection "${name}" from ${source}. What does this collection provide, what are its most useful plugins, and when would an automation engineer want to install it?`}
                label="Learn about this collection"
            />
            {installed ? (
                <div style={styles.success}>Installed successfully</div>
            ) : (
                <button style={styles.installBtn} onClick={() => void handleInstall()} disabled={installing}>
                    {installing ? 'Installing...' : 'Install Collection'}
                </button>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    input: { flex: 1, padding: '5px 8px', background: 'var(--studio-bg-tertiary)', border: '1px solid var(--studio-border)', borderRadius: 'var(--studio-radius-sm)', color: 'var(--studio-text-primary)', fontSize: 'var(--studio-font-size-sm)', outline: 'none' },
    searchBtn: { padding: '5px 10px', background: 'var(--studio-bg-active)', borderRadius: 'var(--studio-radius-sm)', fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-primary)', fontWeight: 500 },

    detail: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600 },
    detailMeta: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-tertiary)' },
    installBtn: { alignSelf: 'flex-start', padding: '7px 20px', background: 'var(--studio-text-primary)', color: 'var(--studio-text-inverse)', borderRadius: 'var(--studio-radius-sm)', fontWeight: 500, fontSize: 'var(--studio-font-size-sm)' },
    success: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-success)' },
};
