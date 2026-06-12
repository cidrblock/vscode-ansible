import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { navItem, navItemActive, navLabel, navMeta, navList, navMuted } from '../styles/navStyles';
import type { DiscoveredEnv } from '../../shared/types';

/**
 * Column 2: discovered Python environment list
 */
interface EnvironmentListProps {
    selected: string | null;
    onSelect: (pythonPath: string) => void;
}

export function EnvironmentList({ selected, onSelect }: EnvironmentListProps): React.JSX.Element {
    const [envs, setEnvs] = useState<DiscoveredEnv[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(() => {
        setLoading(true);
        void api.discoverEnvironments().then((list) => {
            setEnvs(list);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    if (loading) return <div style={navMuted}>Scanning for Python environments...</div>;

    if (envs.length === 0) {
        return (
            <div style={styles.emptyState}>
                <div style={navMuted}>No Python environments found.</div>
                <div style={styles.hint}>
                    Create a virtual environment in your project, or install Python via pyenv or conda.
                </div>
                <button style={styles.rescanBtn} onClick={refresh}>Rescan</button>
            </div>
        );
    }

    const grouped = groupBySource(envs);
    const sourceOrder: Array<DiscoveredEnv['source']> = ['venv', 'conda', 'pyenv', 'system'];
    const sourceLabels: Record<string, string> = { venv: 'Virtual Environments', conda: 'Conda', pyenv: 'Pyenv', system: 'System' };

    return (
        <div style={navList}>
            {sourceOrder.map((source) => {
                const items = grouped[source];
                if (!items?.length) return null;
                return (
                    <React.Fragment key={source}>
                        <div style={styles.groupHeader}>{sourceLabels[source]}</div>
                        {items.map((env) => (
                            <button
                                key={env.pythonPath}
                                style={{ ...navItem, ...(selected === env.pythonPath ? navItemActive : {}) }}
                                onClick={() => onSelect(env.pythonPath)}
                            >
                                <span style={navLabel}>{env.displayName}</span>
                                <span style={navMeta}>{env.version}</span>
                            </button>
                        ))}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/**
 * Column 3: environment detail + select action
 */
interface EnvironmentDetailProps {
    pythonPath: string;
    onSelect?: () => void;
}

export function EnvironmentDetail({ pythonPath, onSelect }: EnvironmentDetailProps): React.JSX.Element {
    const [envs, setEnvs] = useState<DiscoveredEnv[]>([]);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState(false);

    useEffect(() => {
        void api.discoverEnvironments().then(setEnvs).catch(() => {});
    }, []);

    useEffect(() => {
        setSelected(false);
    }, [pythonPath]);

    const env = envs.find((e) => e.pythonPath === pythonPath);

    const handleSelect = async () => {
        if (!env) return;
        setSelecting(true);
        try {
            await api.selectEnvironment(env);
            setSelected(true);
            onSelect?.();
        } finally {
            setSelecting(false);
        }
    };

    if (!env) return <div style={navMuted}>Loading...</div>;

    return (
        <div style={styles.detail}>
            <code style={styles.detailTitle}>{env.displayName}</code>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Python path</span>
                <code style={styles.fieldValue}>{env.pythonPath}</code>
            </div>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Version</span>
                <span style={styles.fieldValue}>{env.version}</span>
            </div>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Source</span>
                <span style={styles.fieldValue}>{env.source}</span>
            </div>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Environment path</span>
                <code style={styles.fieldValue}>{env.envPath}</code>
            </div>
            {selected ? (
                <div style={styles.success}>Active environment updated</div>
            ) : (
                <button style={styles.selectBtn} onClick={() => void handleSelect()} disabled={selecting}>
                    {selecting ? 'Selecting...' : 'Use This Environment'}
                </button>
            )}
        </div>
    );
}

function groupBySource(envs: DiscoveredEnv[]): Partial<Record<DiscoveredEnv['source'], DiscoveredEnv[]>> {
    const groups: Partial<Record<DiscoveredEnv['source'], DiscoveredEnv[]>> = {};
    for (const env of envs) {
        (groups[env.source] ??= []).push(env);
    }
    return groups;
}

const styles: Record<string, React.CSSProperties> = {
    emptyState: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 0' },
    hint: { padding: '0 12px', color: 'var(--studio-text-tertiary)', fontSize: 'var(--studio-font-size-xs)', lineHeight: 1.5 },
    rescanBtn: { margin: '4px 12px', alignSelf: 'flex-start', padding: '5px 14px', background: 'var(--studio-bg-active)', borderRadius: 'var(--studio-radius-sm)', fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-primary)', fontWeight: 500 },
    groupHeader: { padding: '6px 12px', fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', borderBottom: '1px solid var(--studio-border)' },

    detail: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600 },
    fieldRow: { display: 'flex', flexDirection: 'column', gap: '2px' },
    fieldLabel: { fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-tertiary)', fontWeight: 500 },
    fieldValue: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-primary)', fontFamily: 'var(--studio-font-mono)', wordBreak: 'break-all' as const },
    selectBtn: { alignSelf: 'flex-start', padding: '7px 20px', background: 'var(--studio-text-primary)', color: 'var(--studio-text-inverse)', borderRadius: 'var(--studio-radius-sm)', fontWeight: 500, fontSize: 'var(--studio-font-size-sm)' },
    success: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-success)' },
};
