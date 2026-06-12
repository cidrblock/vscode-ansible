import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { EnvironmentInfo, AbbenayConnectionState } from '../../shared/types';

interface StatusBarProps {
    refreshKey?: number;
}

export function StatusBar({ refreshKey }: StatusBarProps): React.JSX.Element {
    const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);
    const [mcpRunning, setMcpRunning] = useState(false);
    const [mcpToolCount, setMcpToolCount] = useState(0);
    const [lspRunning, setLspRunning] = useState(false);
    const [abbenayState, setAbbenayState] = useState<AbbenayConnectionState>('disconnected');

    useEffect(() => {
        void api.getEnvironmentInfo().then(setEnvInfo);
        void api.getMcpStatus().then((s) => { setMcpRunning(s.running); setMcpToolCount(s.toolCount); });
        void api.getLspStatus().then((s) => setLspRunning(s.running));
        void api.abbenayStatus().then((s) => setAbbenayState(s.state));
    }, [refreshKey]);

    return (
        <div style={styles.bar}>
            <span style={styles.item}>
                <span style={styles.dot(!!envInfo?.pythonPath)} />
                {envInfo?.displayName ?? envInfo?.pythonPath ?? 'No Python'}
            </span>

            <span style={styles.item}>
                <span style={styles.dot(mcpRunning)} />
                MCP {mcpRunning ? `(${mcpToolCount})` : 'off'}
            </span>

            <span style={styles.item}>
                <span style={styles.dot(lspRunning)} />
                LSP
            </span>

            <span style={styles.item}>
                <span style={styles.dot(abbenayState === 'connected')} />
                AI {abbenayState === 'connected' ? '' : `(${abbenayState})`}
            </span>

            <div style={styles.spacer} />

            {envInfo?.workspaceRoot && (
                <span style={styles.item}>{shortenPath(envInfo.workspaceRoot)}</span>
            )}
        </div>
    );
}

function shortenPath(p: string): string {
    const parts = p.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p;
}

const styles = {
    bar: {
        display: 'flex',
        alignItems: 'center',
        height: '26px',
        padding: '0 12px',
        background: 'var(--navita-bg-tertiary)',
        borderTop: '1px solid var(--navita-border)',
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-tertiary)',
        gap: '14px',
        flexShrink: 0,
    } as React.CSSProperties,
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'var(--navita-font-mono)',
    } as React.CSSProperties,
    dot: (active: boolean): React.CSSProperties => ({
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        background: active ? 'var(--navita-success)' : 'var(--navita-text-tertiary)',
        flexShrink: 0,
    }),
    spacer: {
        flex: 1,
    } as React.CSSProperties,
};
