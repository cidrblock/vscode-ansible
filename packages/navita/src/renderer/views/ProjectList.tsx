import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { navItem, navItemActive, navItemStacked, navLabel, navMeta, navList, navMuted } from '../styles/navStyles';
import type { ProjectEntry } from '../../shared/types';

interface ProjectListProps {
    selected: string | null;
    onSelect: (projectPath: string) => void;
    onProjectChanged?: () => void;
}

export function ProjectList({ selected, onSelect, onProjectChanged }: ProjectListProps): React.JSX.Element {
    const [projects, setProjects] = useState<ProjectEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadProjects = useCallback(async () => {
        const p = await api.getRecentProjects();
        setProjects(p);
        setLoading(false);
    }, []);

    useEffect(() => { void loadProjects(); }, [loadProjects]);

    const handleAdd = async () => {
        const entry = await api.addProject();
        if (entry) {
            await loadProjects();
            onProjectChanged?.();
            onSelect(entry.path);
        }
    };

    const handleSelect = async (projectPath: string) => {
        await api.switchProject(projectPath);
        await loadProjects();
        onProjectChanged?.();
        onSelect(projectPath);
    };

    const handleRemove = async (e: React.MouseEvent, projectPath: string) => {
        e.stopPropagation();
        await api.removeProject(projectPath);
        await loadProjects();
    };

    if (loading) return <div style={navMuted}>Loading projects...</div>;

    return (
        <div style={navList}>
            <button style={styles.addBtn} onClick={() => void handleAdd()}>
                + Open folder
            </button>
            {projects.length === 0 && (
                <div style={navMuted}>No recent projects</div>
            )}
            {projects.map((p) => (
                <div
                    key={p.path}
                    role="button"
                    tabIndex={0}
                    style={{
                        ...navItemStacked,
                        ...(selected === p.path ? navItemActive : {}),
                        cursor: 'pointer',
                    }}
                    onClick={() => void handleSelect(p.path)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSelect(p.path); }}
                >
                    <span style={navLabel}>{p.name}</span>
                    <div style={styles.pathRow}>
                        <span style={navMeta}>{shortenPath(p.path)}</span>
                        <button
                            style={styles.removeBtn}
                            onClick={(e) => void handleRemove(e, p.path)}
                            title="Remove from list"
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function shortenPath(p: string): string {
    const homeMatch = p.match(/^\/home\/[^/]+/);
    if (homeMatch) {
        return '~' + p.slice(homeMatch[0].length);
    }
    return p;
}

const styles: Record<string, React.CSSProperties> = {
    addBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-secondary)',
        borderBottom: '1px solid var(--navita-border)',
        textAlign: 'left' as const,
    },
    pathRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    removeBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '16px',
        height: '16px',
        borderRadius: '3px',
        fontSize: '13px',
        color: 'var(--navita-text-tertiary)',
        flexShrink: 0,
        lineHeight: 1,
    },
};
