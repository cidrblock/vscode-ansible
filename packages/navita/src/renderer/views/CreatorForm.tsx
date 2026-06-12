import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { AiAnalysis } from '../components/AiAnalysis';
import { navItemStacked, navItemActive, navLabel, navList, navMuted } from '../styles/navStyles';
import type { CreatorCommand } from '../../shared/types';

interface CreatorCommandListProps {
    selected: string | null;
    onSelect: (name: string) => void;
}

export function CreatorCommandList({ selected, onSelect }: CreatorCommandListProps): React.JSX.Element {
    const [commands, setCommands] = useState<CreatorCommand[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        void api.getCreatorCommands().then((cmds) => {
            setCommands(cmds);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={navMuted}>Loading schema...</div>;
    if (commands.length === 0) return <div style={navMuted}>ansible-creator not available.</div>;

    return (
        <div style={navList}>
            {commands.map((cmd) => (
                <button
                    key={cmd.name}
                    style={{ ...navItemStacked, ...(selected === cmd.name ? navItemActive : {}) }}
                    onClick={() => onSelect(cmd.name)}
                >
                    <span style={navLabel}>{cmd.label}</span>
                    {cmd.description && <span style={styles.desc}>{cmd.description}</span>}
                </button>
            ))}
        </div>
    );
}

interface CreatorCommandFormProps {
    commandName: string;
}

export function CreatorCommandForm({ commandName }: CreatorCommandFormProps): React.JSX.Element {
    const [commands, setCommands] = useState<CreatorCommand[]>([]);
    const [params, setParams] = useState<Record<string, string>>({});
    const [running, setRunning] = useState(false);
    const [output, setOutput] = useState<string | null>(null);

    useEffect(() => {
        void api.getCreatorCommands().then(setCommands).catch(() => {});
    }, []);

    useEffect(() => {
        setParams({});
        setOutput(null);
    }, [commandName]);

    const selected = commands.find((c) => c.name === commandName);

    const handleRun = async () => {
        setRunning(true);
        setOutput(null);
        try {
            const result = await api.runCreatorCommand(commandName, params);
            setOutput(result);
        } catch (err) {
            setOutput(`Error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setRunning(false);
        }
    };

    if (!selected) return <div style={navMuted}>Loading...</div>;

    return (
        <div style={styles.detail}>
            <div style={styles.detailTitle}>{selected.label}</div>
            {selected.description && <div style={styles.detailDesc}>{selected.description}</div>}
            <AiAnalysis
                prompt={`Help me understand the ansible-creator "${commandName}" command. What does it scaffold, what are the key parameters I should pay attention to, and what best practices should I follow when using it?`}
                context={`Command: ${commandName}\nDescription: ${selected.description ?? ''}\nParameters: ${selected.parameters.map((p) => p.name).join(', ')}`}
                label="Help with this command"
            />
            <div style={styles.form}>
                {selected.parameters.map((p) => (
                    <div key={p.name} style={styles.field}>
                        <label style={styles.fieldLabel}>{p.name}{p.required ? ' *' : ''}</label>
                        {p.choices && p.choices.length > 0 ? (
                            <select style={styles.fieldInput} value={params[p.name] ?? p.defaultValue ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })}>
                                <option value="">Select...</option>
                                {p.choices.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                            </select>
                        ) : (
                            <input style={styles.fieldInput} type="text" value={params[p.name] ?? p.defaultValue ?? ''} onChange={(e) => setParams({ ...params, [p.name]: e.target.value })} placeholder={p.description} />
                        )}
                    </div>
                ))}
                <button style={styles.runBtn} onClick={() => void handleRun()} disabled={running}>
                    {running ? 'Running...' : 'Create'}
                </button>
            </div>
            {output && <pre style={styles.output}>{output}</pre>}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    desc: { fontSize: 'var(--navita-font-size-xs)', color: 'var(--navita-text-tertiary)' },

    detail: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px' },
    detailTitle: { fontFamily: 'var(--navita-font-mono)', fontSize: 'var(--navita-font-size-md)', fontWeight: 600 },
    detailDesc: { fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-secondary)' },
    form: { display: 'flex', flexDirection: 'column', gap: '8px' },
    field: { display: 'flex', flexDirection: 'column', gap: '3px' },
    fieldLabel: { fontSize: 'var(--navita-font-size-xs)', fontWeight: 500, color: 'var(--navita-text-secondary)' },
    fieldInput: { padding: '5px 8px', background: 'var(--navita-bg-primary)', border: '1px solid var(--navita-border)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-sm)', color: 'var(--navita-text-primary)', outline: 'none' },
    runBtn: { alignSelf: 'flex-start', padding: '6px 16px', background: 'var(--navita-text-primary)', color: 'var(--navita-text-inverse)', borderRadius: 'var(--navita-radius-sm)', fontWeight: 500, fontSize: 'var(--navita-font-size-sm)' },
    output: { padding: '8px', background: 'var(--navita-bg-primary)', borderRadius: 'var(--navita-radius-sm)', fontSize: 'var(--navita-font-size-xs)', fontFamily: 'var(--navita-font-mono)', color: 'var(--navita-text-secondary)', whiteSpace: 'pre-wrap' as const, maxHeight: '250px', overflowY: 'auto' as const, userSelect: 'text' },
};
