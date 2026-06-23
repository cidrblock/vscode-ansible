import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { navItem, navItemActive, navLabel, navList, navMuted } from '../styles/navStyles';
import type { McpToolInfo } from '../../shared/types';

interface McpToolListProps {
    selected: string | null;
    onSelect: (name: string) => void;
}

export function McpToolList({ selected, onSelect }: McpToolListProps): React.JSX.Element {
    const [tools, setTools] = useState<McpToolInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.getMcpTools().then((t) => {
            setTools(t);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={navMuted}>Loading tools...</div>;
    if (tools.length === 0) return <div style={navMuted}>No MCP tools available.</div>;

    return (
        <div style={navList}>
            <div style={styles.count}>{tools.length} tools</div>
            {tools.map((tool) => (
                <button
                    key={tool.name}
                    style={{ ...navItem, ...(selected === tool.name ? navItemActive : {}) }}
                    onClick={() => onSelect(tool.name)}
                >
                    <span style={navLabel}>{tool.name}</span>
                </button>
            ))}
        </div>
    );
}

interface McpToolDetailProps {
    toolName: string;
}

export function McpToolDetail({ toolName }: McpToolDetailProps): React.JSX.Element {
    const [tools, setTools] = useState<McpToolInfo[]>([]);
    const [result, setResult] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        void api.getMcpTools().then(setTools).catch(() => {});
        setResult(null);
    }, [toolName]);

    const tool = tools.find((t) => t.name === toolName);

    const handleCopy = (text: string) => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRun = async () => {
        setRunning(true);
        setResult(null);
        try {
            const output = await api.callMcpTool(toolName, {});
            setResult(output);
        } catch (err) {
            setResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setRunning(false);
        }
    };

    if (!tool) return <div style={navMuted}>Loading...</div>;

    const hasRequiredArgs = tool.inputSchema?.required && (tool.inputSchema.required as string[]).length > 0;

    return (
        <div style={styles.detail}>
            <code style={styles.detailTitle}>{tool.name}</code>
            {tool.description && <p style={styles.desc}>{tool.description}</p>}
            {tool.inputSchema && (
                <div style={styles.schemaSection}>
                    <div style={styles.schemaLabel}>Input Schema</div>
                    <pre style={styles.schema}>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </div>
            )}
            <div style={styles.actions}>
                {!hasRequiredArgs && (
                    <button style={styles.runBtn} onClick={() => void handleRun()} disabled={running}>
                        {running ? 'Running...' : 'Run (no args)'}
                    </button>
                )}
                <button style={styles.copyBtn} onClick={() => handleCopy(`Use the ${tool.name} MCP tool`)}>
                    {copied ? '✓ Copied' : 'Copy prompt'}
                </button>
            </div>
            {result !== null && (
                <div style={styles.schemaSection}>
                    <div style={styles.schemaLabel}>Result</div>
                    <pre style={styles.resultPre}>{result}</pre>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    count: { padding: '7px 12px', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)', borderBottom: '1px solid var(--navita-border)' },

    detail: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--navita-font-mono)', fontSize: 'var(--navita-font-size-md)', fontWeight: 600 },
    desc: { fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const },
    schemaSection: { display: 'flex', flexDirection: 'column', gap: '4px' },
    schemaLabel: { fontSize: 'var(--navita-font-size-xs)', fontWeight: 600, color: 'var(--navita-text-secondary)' },
    schema: { padding: '8px', background: 'var(--navita-bg-tertiary)', borderRadius: 'var(--navita-radius-sm)', fontSize: '10px', fontFamily: 'var(--navita-font-mono)', color: 'var(--navita-text-tertiary)', maxHeight: '250px', overflowY: 'auto' as const, userSelect: 'text' },
    actions: { display: 'flex', gap: '8px' },
    runBtn: { padding: '4px 12px', background: 'var(--navita-accent)', color: 'var(--navita-accent-fg)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-xs)', border: 'none', cursor: 'pointer' },
    copyBtn: { padding: '4px 12px', background: 'var(--navita-bg-hover)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-secondary)', border: 'none', cursor: 'pointer' },
    resultPre: { padding: '8px', background: 'var(--navita-bg-tertiary)', borderRadius: 'var(--navita-radius-sm)', fontSize: '11px', fontFamily: 'var(--navita-font-mono)', color: 'var(--navita-text-primary)', maxHeight: '400px', overflowY: 'auto' as const, whiteSpace: 'pre-wrap' as const, userSelect: 'text' },
};
