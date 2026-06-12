import React, { useState, useMemo } from 'react';
import type {
    PlayState,
    TaskState,
    HostResult,
    PlaybookStats,
} from '../hooks/usePlaybookEvents';

interface PlaybookProgressProps {
    plays: PlayState[];
    stats: PlaybookStats | null;
    duration: number | null;
    isRunning: boolean;
}

type DetailTarget =
    | { kind: 'task'; play: PlayState; task: TaskState }
    | { kind: 'host'; play: PlayState; task: TaskState; hostResult: HostResult }
    | null;

export function PlaybookProgress({
    plays,
    stats,
    duration,
    isRunning,
}: PlaybookProgressProps): React.JSX.Element {
    const [expandedPlays, setExpandedPlays] = useState<Set<string>>(new Set());
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
    const [detail, setDetail] = useState<DetailTarget>(null);

    const togglePlay = (uuid: string) => {
        setExpandedPlays((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const toggleTask = (uuid: string) => {
        setExpandedTasks((prev) => {
            const next = new Set(prev);
            if (next.has(uuid)) next.delete(uuid);
            else next.add(uuid);
            return next;
        });
    };

    const totals = useMemo(() => {
        if (!stats) return null;
        const t = { ok: 0, changed: 0, failures: 0, skipped: 0, unreachable: 0 };
        for (const hostStats of Object.values(stats)) {
            t.ok += hostStats.ok;
            t.changed += hostStats.changed;
            t.failures += hostStats.failures;
            t.skipped += hostStats.skipped;
            t.unreachable += hostStats.unreachable;
        }
        return t;
    }, [stats]);

    return (
        <div style={styles.wrapper}>
            <div style={styles.treePanel}>
                <div style={styles.treePanelHeader}>
                    <span style={styles.treePanelTitle}>Execution Tree</span>
                    {isRunning && <span style={styles.runningDot} />}
                </div>
                <div style={styles.treeScroll}>
                    {plays.map((play) => (
                        <div key={play.uuid}>
                            <button
                                style={styles.playNode}
                                onClick={() => togglePlay(play.uuid)}
                            >
                                <span style={styles.nodeChevron}>
                                    {expandedPlays.has(play.uuid) ? '▾' : '▸'}
                                </span>
                                <span style={styles.playIcon}>▷</span>
                                <span style={styles.playLabel}>{play.name}</span>
                            </button>
                            {expandedPlays.has(play.uuid) &&
                                play.tasks.map((task) => (
                                    <div key={task.uuid} style={styles.taskGroup}>
                                        <button
                                            style={styles.taskNode}
                                            onClick={() => {
                                                toggleTask(task.uuid);
                                                setDetail({ kind: 'task', play, task });
                                            }}
                                        >
                                            <span style={styles.nodeChevron}>
                                                {expandedTasks.has(task.uuid) ? '▾' : '▸'}
                                            </span>
                                            <TaskStatusIcon results={task.hostResults} />
                                            <span style={styles.taskLabel}>{task.name}</span>
                                            <span style={styles.taskAction}>{task.action}</span>
                                        </button>
                                        {expandedTasks.has(task.uuid) &&
                                            task.hostResults.map((hr, i) => (
                                                <button
                                                    key={`${hr.host}-${i}`}
                                                    style={styles.hostNode}
                                                    onClick={() =>
                                                        setDetail({
                                                            kind: 'host',
                                                            play,
                                                            task,
                                                            hostResult: hr,
                                                        })
                                                    }
                                                >
                                                    <StatusDot status={hr.status} />
                                                    <span style={styles.hostName}>{hr.host}</span>
                                                    {hr.duration != null && (
                                                        <span style={styles.hostDuration}>
                                                            {hr.duration.toFixed(1)}s
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                ))}
                        </div>
                    ))}
                    {plays.length === 0 && isRunning && (
                        <div style={styles.treeEmpty}>Waiting for events...</div>
                    )}
                </div>
            </div>

            <div style={styles.detailPanel}>
                {detail?.kind === 'task' && (
                    <TaskDetail task={detail.task} play={detail.play} />
                )}
                {detail?.kind === 'host' && (
                    <HostDetail
                        hostResult={detail.hostResult}
                        task={detail.task}
                    />
                )}
                {!detail && stats && <StatsDetail stats={stats} />}
                {!detail && !stats && (
                    <div style={styles.detailEmpty}>
                        Select a task or host from the tree to view details.
                    </div>
                )}
            </div>

            {(totals || isRunning) && (
                <div style={styles.footer}>
                    {totals && (
                        <>
                            <FooterStat
                                label="ok"
                                value={totals.ok}
                                color="var(--navita-success)"
                            />
                            <FooterStat
                                label="changed"
                                value={totals.changed}
                                color="var(--navita-warning)"
                            />
                            <FooterStat
                                label="failed"
                                value={totals.failures}
                                color="var(--navita-error)"
                            />
                            <FooterStat
                                label="skipped"
                                value={totals.skipped}
                                color="var(--navita-text-tertiary)"
                            />
                            <FooterStat
                                label="unreachable"
                                value={totals.unreachable}
                                color="var(--navita-error)"
                            />
                        </>
                    )}
                    <div style={{ flex: 1 }} />
                    {duration != null && (
                        <span style={styles.footerDuration}>{duration.toFixed(1)}s</span>
                    )}
                    {isRunning && <span style={styles.footerRunning}>Running...</span>}
                </div>
            )}
        </div>
    );
}

// --- Sub-components ---

function TaskStatusIcon({ results }: { results: HostResult[] }): React.JSX.Element {
    if (results.length === 0) return <span style={styles.statusIcon}>◌</span>;
    const hasFailed = results.some((r) => r.status === 'failed' && !r.ignoreErrors);
    const hasChanged = results.some((r) => r.status === 'changed');
    const allSkipped = results.every((r) => r.status === 'skipped');

    if (hasFailed) return <span style={{ ...styles.statusIcon, color: 'var(--navita-error)' }}>✗</span>;
    if (hasChanged) return <span style={{ ...styles.statusIcon, color: 'var(--navita-warning)' }}>●</span>;
    if (allSkipped) return <span style={{ ...styles.statusIcon, color: 'var(--navita-text-tertiary)' }}>◍</span>;
    return <span style={{ ...styles.statusIcon, color: 'var(--navita-success)' }}>✓</span>;
}

function StatusDot({ status }: { status: HostResult['status'] }): React.JSX.Element {
    const colorMap: Record<string, string> = {
        ok: 'var(--navita-success)',
        changed: 'var(--navita-warning)',
        failed: 'var(--navita-error)',
        skipped: 'var(--navita-text-tertiary)',
        unreachable: 'var(--navita-error)',
    };
    return (
        <span
            style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: colorMap[status] ?? 'var(--navita-text-tertiary)',
                flexShrink: 0,
            }}
        />
    );
}

function TaskDetail({
    task,
    play,
}: {
    task: TaskState;
    play: PlayState;
}): React.JSX.Element {
    return (
        <div style={styles.detailContent}>
            <h3 style={styles.detailTitle}>{task.name}</h3>
            <div style={styles.detailMeta}>
                <span>Action: <code>{task.action}</code></span>
                <span>Play: {play.name}</span>
                {task.path && <span>Source: <code>{task.path}</code></span>}
                {task.isHandler && <span style={styles.handlerBadge}>handler</span>}
            </div>
            <h4 style={styles.detailSubtitle}>
                Host Results ({task.hostResults.length})
            </h4>
            <div style={styles.resultsList}>
                {task.hostResults.map((hr, i) => (
                    <div key={`${hr.host}-${i}`} style={styles.resultRow}>
                        <StatusDot status={hr.status} />
                        <span style={styles.resultHost}>{hr.host}</span>
                        <span style={styles.resultStatus}>{hr.status}</span>
                        {hr.duration != null && (
                            <span style={styles.resultDuration}>
                                {hr.duration.toFixed(1)}s
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function HostDetail({
    hostResult,
    task,
}: {
    hostResult: HostResult;
    task: TaskState;
}): React.JSX.Element {
    return (
        <div style={styles.detailContent}>
            <h3 style={styles.detailTitle}>
                {hostResult.host} — {task.name}
            </h3>
            <div style={styles.detailMeta}>
                <span>
                    Status: <StatusDot status={hostResult.status} />{' '}
                    {hostResult.status}
                </span>
                <span>Action: <code>{task.action}</code></span>
                {hostResult.duration != null && (
                    <span>Duration: {hostResult.duration.toFixed(2)}s</span>
                )}
                {hostResult.changed && <span>Changed: yes</span>}
            </div>
            <h4 style={styles.detailSubtitle}>Result</h4>
            <pre style={styles.resultJson}>
                {JSON.stringify(hostResult.result, null, 2)}
            </pre>
        </div>
    );
}

function StatsDetail({ stats }: { stats: PlaybookStats }): React.JSX.Element {
    return (
        <div style={styles.detailContent}>
            <h3 style={styles.detailTitle}>Playbook Complete</h3>
            <div style={styles.statsGrid}>
                {Object.entries(stats).map(([host, s]) => (
                    <div key={host} style={styles.statsRow}>
                        <span style={styles.statsHost}>{host}</span>
                        <span style={{ color: 'var(--navita-success)' }}>ok={s.ok}</span>
                        <span style={{ color: 'var(--navita-warning)' }}>
                            changed={s.changed}
                        </span>
                        <span style={{ color: 'var(--navita-error)' }}>
                            failed={s.failures}
                        </span>
                        <span>skipped={s.skipped}</span>
                        <span style={{ color: 'var(--navita-error)' }}>
                            unreachable={s.unreachable}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FooterStat({
    label,
    value,
    color,
}: {
    label: string;
    value: number;
    color: string;
}): React.JSX.Element {
    return (
        <span style={{ ...styles.footerStat, color }}>
            {label}: {value}
        </span>
    );
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1px',
        background: 'var(--navita-border)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-md)',
        overflow: 'hidden',
        minHeight: '400px',
        maxHeight: '70vh',
    },
    treePanel: {
        width: '320px',
        minWidth: '280px',
        background: 'var(--navita-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
    },
    treePanelHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderBottom: '1px solid var(--navita-border)',
    },
    treePanelTitle: {
        fontSize: 'var(--navita-font-size-sm)',
        fontWeight: 600,
        color: 'var(--navita-text-secondary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
    },
    runningDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: 'var(--navita-success)',
        animation: 'pulse 1.5s ease-in-out infinite',
    },
    treeScroll: {
        flex: 1,
        overflowY: 'auto' as const,
        padding: '4px 0',
    },
    treeEmpty: {
        padding: '20px',
        textAlign: 'center' as const,
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-sm)',
    },
    playNode: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '6px 10px',
        textAlign: 'left' as const,
        fontSize: 'var(--navita-font-size-sm)',
        fontWeight: 600,
        color: 'var(--navita-text-primary)',
    },
    taskGroup: {
        paddingLeft: '12px',
    },
    taskNode: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '4px 10px',
        textAlign: 'left' as const,
        fontSize: 'var(--navita-font-size-sm)',
    },
    taskLabel: {
        flex: 1,
        color: 'var(--navita-text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
    },
    taskAction: {
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-tertiary)',
        fontFamily: 'var(--navita-font-mono)',
        flexShrink: 0,
    },
    hostNode: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        width: '100%',
        padding: '3px 10px 3px 36px',
        textAlign: 'left' as const,
        fontSize: 'var(--navita-font-size-xs)',
    },
    hostName: {
        flex: 1,
        color: 'var(--navita-text-secondary)',
        fontFamily: 'var(--navita-font-mono)',
    },
    hostDuration: {
        color: 'var(--navita-text-tertiary)',
        fontFamily: 'var(--navita-font-mono)',
    },
    nodeChevron: {
        width: '14px',
        color: 'var(--navita-text-tertiary)',
        fontSize: '10px',
        textAlign: 'center' as const,
        flexShrink: 0,
    },
    playIcon: {
        color: 'var(--navita-text-tertiary)',
        fontSize: '10px',
    },
    statusIcon: {
        fontSize: '12px',
        width: '14px',
        textAlign: 'center' as const,
        flexShrink: 0,
    },
    detailPanel: {
        flex: 1,
        minWidth: '300px',
        background: 'var(--navita-bg-primary)',
        overflowY: 'auto' as const,
    },
    detailEmpty: {
        padding: '40px',
        textAlign: 'center' as const,
        color: 'var(--navita-text-tertiary)',
    },
    detailContent: {
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    detailTitle: {
        fontSize: 'var(--navita-font-size-lg)',
        fontWeight: 600,
    },
    detailSubtitle: {
        fontSize: 'var(--navita-font-size-md)',
        fontWeight: 600,
        paddingTop: '8px',
    },
    detailMeta: {
        display: 'flex',
        flexWrap: 'wrap' as const,
        gap: '12px',
        fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-secondary)',
    },
    handlerBadge: {
        padding: '1px 6px',
        borderRadius: '3px',
        background: 'var(--navita-info-subtle)',
        color: 'var(--navita-info)',
        fontSize: 'var(--navita-font-size-xs)',
    },
    resultsList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    resultRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 8px',
        borderRadius: 'var(--navita-radius-sm)',
        fontSize: 'var(--navita-font-size-sm)',
    },
    resultHost: {
        flex: 1,
        fontFamily: 'var(--navita-font-mono)',
    },
    resultStatus: {
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-xs)',
    },
    resultDuration: {
        color: 'var(--navita-text-tertiary)',
        fontFamily: 'var(--navita-font-mono)',
        fontSize: 'var(--navita-font-size-xs)',
    },
    resultJson: {
        padding: '12px',
        background: 'var(--navita-bg-tertiary)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-md)',
        overflow: 'auto',
        maxHeight: '400px',
        fontSize: 'var(--navita-font-size-xs)',
        lineHeight: 1.5,
        userSelect: 'text' as const,
    },
    statsGrid: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    statsRow: {
        display: 'flex',
        gap: '12px',
        padding: '6px 10px',
        background: 'var(--navita-bg-secondary)',
        borderRadius: 'var(--navita-radius-sm)',
        fontSize: 'var(--navita-font-size-sm)',
        fontFamily: 'var(--navita-font-mono)',
    },
    statsHost: {
        fontWeight: 600,
        minWidth: '120px',
        color: 'var(--navita-text-primary)',
    },
    footer: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        width: '100%',
        padding: '8px 14px',
        background: 'var(--navita-bg-tertiary)',
        fontSize: 'var(--navita-font-size-xs)',
        fontFamily: 'var(--navita-font-mono)',
    },
    footerStat: {
        fontWeight: 500,
    },
    footerDuration: {
        color: 'var(--navita-text-secondary)',
    },
    footerRunning: {
        color: 'var(--navita-success)',
        fontWeight: 600,
    },
};
