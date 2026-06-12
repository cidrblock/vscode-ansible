import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { SectionList } from '../components/SectionList';
import type { SectionDef } from '../components/SectionList';
import { AiAnalysis } from '../components/AiAnalysis';
import { navItem, navItemActive, navLabel, navMeta, navList, navMuted } from '../styles/navStyles';
import type { EEInfo, EEDetailInfo } from '../../shared/types';

// ---------------------------------------------------------------------------
// Column: EE list
// ---------------------------------------------------------------------------

interface EEListProps {
    selected: string | null;
    onSelect: (name: string) => void;
}

export function EEList({ selected, onSelect }: EEListProps): React.JSX.Element {
    const [ees, setEes] = useState<EEInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.listExecutionEnvironments().then((list) => {
            setEes(list);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={navMuted}>Scanning images...</div>;
    if (ees.length === 0) return <div style={navMuted}>No EE images found. Ensure podman or docker is available.</div>;

    return (
        <div style={navList}>
            {ees.map((ee) => (
                <button
                    key={ee.name}
                    style={{ ...navItem, ...(selected === ee.name ? navItemActive : {}) }}
                    onClick={() => onSelect(ee.name)}
                >
                    <span style={navLabel}>{ee.name}</span>
                    {ee.tag && <span style={navMeta}>{ee.tag}</span>}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Column: EE facets (overview, collections, python, system)
// ---------------------------------------------------------------------------

interface EEFacetsProps {
    eeName: string;
    selected: string | null;
    onSelect: (facet: string) => void;
}

export function EEFacets({ eeName, selected, onSelect }: EEFacetsProps): React.JSX.Element {
    const [details, setDetails] = useState<EEDetailInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        void api.getEEDetails(eeName).then((d) => {
            setDetails(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [eeName]);

    if (loading) return <div style={navMuted}>Inspecting {eeName}...</div>;
    if (!details) return <div style={navMuted}>Could not inspect this image.</div>;

    const sections: SectionDef[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'collections', label: 'Collections', badge: details.collections.length > 0 ? String(details.collections.length) : undefined },
        { id: 'python', label: 'Python Packages', badge: details.pythonPackages.length > 0 ? String(details.pythonPackages.length) : undefined },
        { id: 'system', label: 'System Packages', badge: details.systemPackages.length > 0 ? String(details.systemPackages.length) : undefined },
    ];

    return <SectionList sections={sections} activeId={selected} onSelect={onSelect} />;
}

// ---------------------------------------------------------------------------
// Column: EE facet detail content
// ---------------------------------------------------------------------------

interface EEFacetDetailProps {
    eeName: string;
    facetId: string;
}

export function EEFacetDetail({ eeName, facetId }: EEFacetDetailProps): React.JSX.Element {
    const [details, setDetails] = useState<EEDetailInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        void api.getEEDetails(eeName).then((d) => {
            setDetails(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [eeName]);

    if (loading) return <div style={navMuted}>Loading...</div>;
    if (!details) return <div style={navMuted}>No data available.</div>;

    switch (facetId) {
        case 'overview':
            return <EEOverview eeName={eeName} details={details} />;
        case 'collections':
            return <EECollectionList collections={details.collections} />;
        case 'python':
            return <EEPythonList packages={details.pythonPackages} />;
        case 'system':
            return <EESystemList packages={details.systemPackages} />;
        default:
            return <div style={navMuted}>Unknown section</div>;
    }
}

function EEOverview({ eeName, details }: { eeName: string; details: EEDetailInfo }): React.JSX.Element {
    const collectionNames = details.collections.map((c) => c.name).join(', ');
    return (
        <div style={styles.detail}>
            <code style={styles.detailTitle}>{eeName}</code>
            <AiAnalysis
                prompt={`Analyze this Ansible Execution Environment image. Describe its purpose, what automation use cases it's suited for, whether its collection set is complete for common tasks, and any recommendations for improvement.`}
                context={`Image: ${eeName}\nAnsible: ${details.ansibleVersion ?? 'unknown'}\nOS: ${details.osRelease ?? 'unknown'}\nCollections (${details.collections.length}): ${collectionNames}\nPython packages: ${details.pythonPackages.length}\nSystem packages: ${details.systemPackages.length}`}
                label="Analyze EE"
            />
            {details.imageName && (
                <div style={styles.fieldRow}>
                    <span style={styles.fieldLabel}>Image</span>
                    <code style={styles.fieldValue}>{details.imageName}</code>
                </div>
            )}
            {details.ansibleVersion && (
                <div style={styles.fieldRow}>
                    <span style={styles.fieldLabel}>Ansible</span>
                    <span style={styles.fieldValue}>{details.ansibleVersion}</span>
                </div>
            )}
            {details.osRelease && (
                <div style={styles.fieldRow}>
                    <span style={styles.fieldLabel}>OS</span>
                    <span style={styles.fieldValue}>{details.osRelease}</span>
                </div>
            )}
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Collections</span>
                <span style={styles.fieldValue}>{details.collections.length}</span>
            </div>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Python packages</span>
                <span style={styles.fieldValue}>{details.pythonPackages.length}</span>
            </div>
            <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>System packages</span>
                <span style={styles.fieldValue}>{details.systemPackages.length}</span>
            </div>
        </div>
    );
}

function EECollectionList({ collections }: { collections: EEDetailInfo['collections'] }): React.JSX.Element {
    if (collections.length === 0) return <div style={navMuted}>No collections installed.</div>;
    return (
        <div style={navList}>
            {collections.map((c) => (
                <div key={c.name} style={navItem}>
                    <span style={navLabel}>{c.name}</span>
                    <span style={navMeta}>{c.version}</span>
                </div>
            ))}
        </div>
    );
}

function EEPythonList({ packages }: { packages: EEDetailInfo['pythonPackages'] }): React.JSX.Element {
    if (packages.length === 0) return <div style={navMuted}>No Python packages found.</div>;
    return (
        <div style={navList}>
            {packages.map((p) => (
                <div key={p.name} style={navItem}>
                    <span style={navLabel}>{p.name}</span>
                    <span style={navMeta}>{p.version}</span>
                </div>
            ))}
        </div>
    );
}

function EESystemList({ packages }: { packages: EEDetailInfo['systemPackages'] }): React.JSX.Element {
    if (packages.length === 0) return <div style={navMuted}>No system packages found.</div>;
    return (
        <div style={navList}>
            {packages.map((p) => (
                <div key={p.name} style={navItem}>
                    <span style={navLabel}>{p.name}</span>
                    <span style={navMeta}>{p.version}</span>
                </div>
            ))}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    detail: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600, wordBreak: 'break-all' as const },
    fieldRow: { display: 'flex', flexDirection: 'column', gap: '2px' },
    fieldLabel: { fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-tertiary)', fontWeight: 500 },
    fieldValue: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-primary)' },
};
