import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { navItem, navItemActive, navLabel, navList, navMuted, navBadge } from '../styles/navStyles';
import type { SkillInfo, SkillSourceInfo } from '../../shared/types';

interface SkillListProps {
    selected: string | null;
    onSelect: (id: string) => void;
}

export function SkillList({ selected, onSelect }: SkillListProps): React.JSX.Element {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [sources, setSources] = useState<SkillSourceInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void Promise.all([api.getSkills(), api.getSkillSources()])
            .then(([s, src]) => {
                setSkills(s);
                setSources(src);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleRefresh = () => {
        setLoading(true);
        void api.refreshSkills()
            .then(() => Promise.all([api.getSkills(), api.getSkillSources()]))
            .then(([s, src]) => {
                setSkills(s);
                setSources(src);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    if (loading) return <div style={navMuted}>Loading skills...</div>;
    if (skills.length === 0) {
        return (
            <div style={navList}>
                <div style={navMuted}>No skills available.</div>
                <button style={styles.refreshBtn} onClick={handleRefresh}>Refresh</button>
            </div>
        );
    }

    const grouped = groupBySource(skills, sources);

    return (
        <div style={navList}>
            <div style={styles.header}>
                <span style={styles.count}>{skills.length} skills</span>
                <button style={styles.refreshBtn} onClick={handleRefresh}>↻</button>
            </div>
            {grouped.map(({ source, modules }) => (
                <div key={source.id}>
                    <div style={styles.sourceHeader}>
                        <span style={styles.sourceIcon}>{trustIcon(source.trust)}</span>
                        <span style={styles.sourceLabel}>{source.id}</span>
                        <span style={navBadge}>{source.trust}</span>
                    </div>
                    {modules.map(({ module, skills: modSkills }) => (
                        <div key={`${source.id}/${module}`}>
                            {module && modules.length > 1 && (
                                <div style={styles.moduleHeader}>{module}</div>
                            )}
                            {modSkills.map((skill) => (
                                <button
                                    key={skill.id}
                                    style={{ ...navItem, ...styles.skillItem, ...(selected === skill.id ? navItemActive : {}) }}
                                    onClick={() => onSelect(skill.id)}
                                >
                                    <span style={navLabel}>{skill.name}</span>
                                    <span style={styles.category}>{skill.category}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

interface SkillDetailProps {
    skillId: string;
}

export function SkillDetail({ skillId }: SkillDetailProps): React.JSX.Element {
    const [skills, setSkills] = useState<SkillInfo[]>([]);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        void api.getSkills().then(setSkills).catch(() => {});
    }, []);

    const skill = skills.find((s) => s.id === skillId);

    const handleCopyPrompt = async () => {
        if (!skill) return;
        const prompt = await api.getSkillPrompt(skill.name, skill.id, skill.description, true);
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUseInChat = async () => {
        if (!skill) return;
        const prompt = await api.getSkillPrompt(skill.name, skill.id, skill.description, false);
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!skill) return <div style={navMuted}>Loading...</div>;

    return (
        <div style={styles.detail}>
            <div style={styles.detailTitle}>{skill.name}</div>
            <p style={styles.desc}>{skill.description}</p>

            <div style={styles.metaGrid}>
                <MetaRow label="Source" value={skill.source} />
                <MetaRow label="Module" value={skill.module} />
                <MetaRow label="Category" value={skill.category} />
                <MetaRow label="Trust" value={skill.trust} />
                {skill.domain && <MetaRow label="Domain" value={skill.domain} />}
            </div>

            {skill.triggers.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionLabel}>Triggers</div>
                    <div style={styles.tagList}>
                        {skill.triggers.map((t) => (
                            <span key={t} style={styles.tag}>{t}</span>
                        ))}
                    </div>
                </div>
            )}

            {skill.tags.length > 0 && (
                <div style={styles.section}>
                    <div style={styles.sectionLabel}>Tags</div>
                    <div style={styles.tagList}>
                        {skill.tags.map((t) => (
                            <span key={t} style={styles.tag}>{t}</span>
                        ))}
                    </div>
                </div>
            )}

            <div style={styles.section}>
                <div style={styles.sectionLabel}>MCP Tool Reference</div>
                <code style={styles.toolRef}>skill_get({'{'} skill_id: &quot;{skill.id}&quot; {'}'})</code>
            </div>

            <div style={styles.actions}>
                <button style={styles.actionBtn} onClick={() => void handleUseInChat()}>
                    {copied ? '✓ Copied' : 'Copy chat prompt'}
                </button>
                <button style={styles.actionBtnSecondary} onClick={() => void handleCopyPrompt()}>
                    Copy MCP prompt
                </button>
            </div>
        </div>
    );
}

function MetaRow({ label, value }: { label: string; value: string }): React.JSX.Element {
    return (
        <div style={styles.metaRow}>
            <span style={styles.metaLabel}>{label}</span>
            <span style={styles.metaValue}>{value}</span>
        </div>
    );
}

function trustIcon(trust: string): string {
    switch (trust) {
        case 'certified': return '✓';
        case 'partner': return '⚙';
        case 'private': return '🔒';
        default: return '●';
    }
}

interface SourceGroup {
    source: SkillSourceInfo;
    modules: { module: string; skills: SkillInfo[] }[];
}

function groupBySource(skills: SkillInfo[], sources: SkillSourceInfo[]): SourceGroup[] {
    const groups: SourceGroup[] = [];

    for (const source of sources) {
        const sourceSkills = skills.filter((s) => s.source === source.id);
        if (sourceSkills.length === 0) continue;

        const moduleMap = new Map<string, SkillInfo[]>();
        for (const skill of sourceSkills) {
            const existing = moduleMap.get(skill.module);
            if (existing) existing.push(skill);
            else moduleMap.set(skill.module, [skill]);
        }

        groups.push({
            source,
            modules: [...moduleMap.entries()].map(([mod, modSkills]) => ({
                module: mod,
                skills: modSkills,
            })),
        });
    }

    return groups;
}

const styles: Record<string, React.CSSProperties> = {
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderBottom: '1px solid var(--navita-border)' },
    count: { fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)' },
    refreshBtn: { background: 'none', border: 'none', color: 'var(--navita-text-secondary)', cursor: 'pointer', fontSize: 'var(--navita-font-size-sm)', padding: '2px 6px' },

    sourceHeader: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px 4px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-secondary)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
    sourceIcon: { fontSize: '10px' },
    sourceLabel: { flex: 1 },

    moduleHeader: { padding: '4px 12px 2px 20px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)', fontWeight: 500 },

    skillItem: { paddingLeft: '20px' },
    category: { fontSize: '10px', color: 'var(--navita-text-tertiary)', marginLeft: '8px', flexShrink: 0 },

    detail: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    detailTitle: { fontSize: 'var(--navita-font-size-md)', fontWeight: 600 },
    desc: { fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-secondary)', lineHeight: 1.5 },

    metaGrid: { display: 'flex', flexDirection: 'column', gap: '4px' },
    metaRow: { display: 'flex', gap: '8px', fontSize: 'var(--navita-font-size-xs)' },
    metaLabel: { color: 'var(--navita-text-tertiary)', width: '70px', flexShrink: 0 },
    metaValue: { color: 'var(--navita-text-primary)', fontFamily: 'var(--navita-font-mono)' },

    section: { display: 'flex', flexDirection: 'column', gap: '4px' },
    sectionLabel: { fontSize: 'var(--navita-font-size-xs)', fontWeight: 600, color: 'var(--navita-text-secondary)' },
    tagList: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
    tag: { padding: '2px 8px', background: 'var(--navita-bg-tertiary)', borderRadius: 'var(--navita-radius-sm)', fontSize: '10px', color: 'var(--navita-text-secondary)' },
    toolRef: { padding: '6px 10px', background: 'var(--navita-bg-tertiary)', borderRadius: 'var(--navita-radius-sm)', fontSize: '11px', fontFamily: 'var(--navita-font-mono)', color: 'var(--navita-text-secondary)' },

    actions: { display: 'flex', gap: '8px', paddingTop: '4px' },
    actionBtn: { padding: '6px 14px', background: 'var(--navita-accent)', color: 'var(--navita-accent-fg)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-xs)', fontWeight: 500, cursor: 'pointer', border: 'none' },
    actionBtnSecondary: { padding: '6px 14px', background: 'var(--navita-bg-hover)', color: 'var(--navita-text-secondary)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-xs)', fontWeight: 500, cursor: 'pointer', border: 'none' },
};
