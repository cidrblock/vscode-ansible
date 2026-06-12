import React, { useState } from 'react';
import { usePlaybooks, usePlaybookExecution } from '../hooks/usePlaybookEvents';
import { PlaybookProgress } from './PlaybookProgress';
import { navItem, navItemActive, navItemStacked, navLabel, navMeta, navList, navMuted } from '../styles/navStyles';
import type { PlaybookConfig } from '../../shared/types';

interface PlaybookListProps {
    selected: string | null;
    onSelect: (path: string) => void;
}

export function PlaybookList({ selected, onSelect }: PlaybookListProps): React.JSX.Element {
    const { playbooks, loading } = usePlaybooks();

    return (
        <div style={navList}>
            {loading && <div style={navMuted}>Scanning...</div>}
            {playbooks.map((pb) => (
                <button
                    key={pb.path}
                    style={{
                        ...navItemStacked,
                        ...(selected === pb.path ? navItemActive : {}),
                    }}
                    onClick={() => onSelect(pb.path)}
                >
                    <span style={navLabel}>{pb.name}</span>
                    <span style={navMeta}>{pb.relativePath}</span>
                </button>
            ))}
            {!loading && playbooks.length === 0 && (
                <div style={navMuted}>No playbooks found in this project.</div>
            )}
        </div>
    );
}

interface PlaybookDetailProps {
    playbookPath: string;
}

export function PlaybookDetail({ playbookPath }: PlaybookDetailProps): React.JSX.Element {
    const execution = usePlaybookExecution();
    const [config, setConfig] = useState<PlaybookConfig>({});
    const [showConfig, setShowConfig] = useState(false);

    const handleRun = async (): Promise<void> => {
        await execution.run(playbookPath, config);
    };

    const fileName = playbookPath.split('/').pop() ?? playbookPath;

    if (execution.isRunning || execution.plays.length > 0) {
        return (
            <div style={styles.detailWrap}>
                {execution.isRunning && (
                    <div style={styles.runningBar}>
                        <span style={styles.runningLabel}>Running {fileName}</span>
                        <button style={styles.stopBtn} onClick={() => void execution.stop()}>Stop</button>
                    </div>
                )}
                <PlaybookProgress
                    plays={execution.plays}
                    stats={execution.stats}
                    duration={execution.duration}
                    isRunning={execution.isRunning}
                />
            </div>
        );
    }

    return (
        <div style={styles.detailWrap}>
            <code style={styles.detailTitle}>{fileName}</code>

            <button style={styles.configToggle} onClick={() => setShowConfig(!showConfig)}>
                {showConfig ? '\u25BE' : '\u25B8'} Run Options
            </button>

            {showConfig && (
                <div style={styles.configPanel}>
                    <ConfigField label="Limit" value={config.limit ?? ''} onChange={(v) => setConfig((c) => ({ ...c, limit: v || undefined }))} placeholder="host-pattern" />
                    <ConfigField label="Tags" value={config.tags ?? ''} onChange={(v) => setConfig((c) => ({ ...c, tags: v || undefined }))} placeholder="tag1,tag2" />
                    <ConfigField label="Skip Tags" value={config.skipTags ?? ''} onChange={(v) => setConfig((c) => ({ ...c, skipTags: v || undefined }))} placeholder="tag1,tag2" />
                    <div style={styles.configRow}>
                        <label style={styles.checkLabel}>
                            <input type="checkbox" checked={config.check ?? false} onChange={(e) => setConfig((c) => ({ ...c, check: e.target.checked || undefined }))} />
                            Check mode
                        </label>
                        <label style={styles.checkLabel}>
                            <input type="checkbox" checked={config.diff ?? false} onChange={(e) => setConfig((c) => ({ ...c, diff: e.target.checked || undefined }))} />
                            Diff
                        </label>
                    </div>
                    <div style={styles.configRow}>
                        <label style={styles.fieldLabel}>Verbosity</label>
                        <select style={styles.select} value={config.verbosity ?? 0} onChange={(e) => setConfig((c) => ({ ...c, verbosity: Number(e.target.value) || undefined }))}>
                            <option value="0">Normal</option>
                            <option value="1">-v</option>
                            <option value="2">-vv</option>
                            <option value="3">-vvv</option>
                            <option value="4">-vvvv</option>
                        </select>
                    </div>
                </div>
            )}

            <button style={styles.runBtn} onClick={() => void handleRun()}>Run Playbook</button>
        </div>
    );
}

function ConfigField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }): React.JSX.Element {
    return (
        <div style={styles.configField}>
            <label style={styles.fieldLabel}>{label}</label>
            <input style={styles.fieldInput} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    detailWrap: { display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600 },
    runningBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    runningLabel: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-secondary)' },
    stopBtn: { padding: '4px 12px', borderRadius: 'var(--studio-radius-sm)', background: 'var(--studio-error-subtle)', color: 'var(--studio-error)', fontWeight: 600, fontSize: 'var(--studio-font-size-xs)' },
    configToggle: { alignSelf: 'flex-start', color: 'var(--studio-text-secondary)', fontSize: 'var(--studio-font-size-sm)' },
    configPanel: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', background: 'var(--studio-bg-tertiary)', borderRadius: 'var(--studio-radius-md)' },
    configField: { display: 'flex', flexDirection: 'column', gap: '3px' },
    configRow: { display: 'flex', alignItems: 'center', gap: '14px' },
    fieldLabel: { fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-secondary)', fontWeight: 500 },
    fieldInput: { padding: '5px 8px', background: 'var(--studio-bg-primary)', border: '1px solid var(--studio-border)', borderRadius: 'var(--studio-radius-sm)', color: 'var(--studio-text-primary)', fontSize: 'var(--studio-font-size-sm)', outline: 'none' },
    select: { padding: '4px 8px', background: 'var(--studio-bg-primary)', border: '1px solid var(--studio-border)', borderRadius: 'var(--studio-radius-sm)', color: 'var(--studio-text-primary)', fontSize: 'var(--studio-font-size-sm)' },
    checkLabel: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-secondary)', cursor: 'pointer' },
    runBtn: { alignSelf: 'flex-start', padding: '7px 20px', borderRadius: 'var(--studio-radius-sm)', background: 'var(--studio-text-primary)', color: 'var(--studio-text-inverse)', fontWeight: 500, fontSize: 'var(--studio-font-size-sm)' },
};
