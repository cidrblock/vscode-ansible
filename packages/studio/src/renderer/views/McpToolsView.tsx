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

    useEffect(() => {
        void api.getMcpTools().then(setTools).catch(() => {});
    }, []);

    const tool = tools.find((t) => t.name === toolName);

    const handleCopy = (text: string) => {
        void navigator.clipboard.writeText(text);
    };

    if (!tool) return <div style={navMuted}>Loading...</div>;

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
            <button style={styles.copyBtn} onClick={() => handleCopy(`Use the ${tool.name} MCP tool`)}>
                Copy prompt
            </button>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    count: { padding: '7px 12px', fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-tertiary)', borderBottom: '1px solid var(--studio-border)' },

    detail: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--studio-font-mono)', fontSize: 'var(--studio-font-size-md)', fontWeight: 600 },
    desc: { fontSize: 'var(--studio-font-size-sm)', color: 'var(--studio-text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const },
    schemaSection: { display: 'flex', flexDirection: 'column', gap: '4px' },
    schemaLabel: { fontSize: 'var(--studio-font-size-xs)', fontWeight: 600, color: 'var(--studio-text-secondary)' },
    schema: { padding: '8px', background: 'var(--studio-bg-tertiary)', borderRadius: 'var(--studio-radius-sm)', fontSize: '10px', fontFamily: 'var(--studio-font-mono)', color: 'var(--studio-text-tertiary)', maxHeight: '250px', overflowY: 'auto' as const, userSelect: 'text' },
    copyBtn: { alignSelf: 'flex-start', padding: '4px 12px', background: 'var(--studio-bg-hover)', borderRadius: 'var(--studio-radius-sm)', fontSize: 'var(--studio-font-size-xs)', color: 'var(--studio-text-secondary)' },
};
