import React from 'react';
import { usePluginDoc } from '../hooks/useCollections';
import { AiAnalysis } from '../components/AiAnalysis';

interface PluginDocPanelProps {
    pluginName: string;
    pluginType: string;
    onBack?: () => void;
}

interface OptionEntry {
    name: string;
    description?: string[];
    type?: string;
    default?: unknown;
    required?: boolean;
    choices?: unknown[];
    aliases?: string[];
}

interface ReturnEntry {
    name: string;
    description?: string;
    type?: string;
    returned?: string;
    sample?: unknown;
}

export function PluginDocPanel({
    pluginName,
    pluginType,
    onBack,
}: PluginDocPanelProps): React.JSX.Element {
    const { doc, loading } = usePluginDoc(pluginName, pluginType);

    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading documentation...</div>
            </div>
        );
    }

    if (!doc) {
        return (
            <div style={styles.container}>
                <div style={styles.empty}>No documentation available for {pluginName}</div>
            </div>
        );
    }

    const docData = doc.doc as Record<string, unknown> | undefined;
    const shortDesc = (docData?.short_description as string) ?? '';
    const description = (docData?.description as string[]) ?? [];
    const options = (docData?.options as Record<string, Record<string, unknown>>) ?? {};
    const examples = (doc.examples as string) ?? '';
    const returnVals = (doc.return as Record<string, Record<string, unknown>>) ?? {};

    const optionEntries: OptionEntry[] = Object.entries(options).map(([name, opt]) => ({
        name,
        description: opt.description as string[] | undefined,
        type: opt.type as string | undefined,
        default: opt.default,
        required: opt.required as boolean | undefined,
        choices: opt.choices as unknown[] | undefined,
        aliases: opt.aliases as string[] | undefined,
    }));

    const returnEntries: ReturnEntry[] = Object.entries(returnVals).map(([name, ret]) => ({
        name,
        description: (ret.description as string) ?? '',
        type: ret.type as string | undefined,
        returned: ret.returned as string | undefined,
        sample: ret.sample,
    }));

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>{pluginName}</h2>
                <span style={styles.typeBadge}>{pluginType}</span>
            </div>

            {shortDesc && <p style={styles.shortDesc}>{shortDesc}</p>}

            <AiAnalysis
                prompt={`Explain the Ansible ${pluginType} plugin "${pluginName}". Describe what it does, common use cases, key parameters to know, and any gotchas or best practices. Keep it concise and practical for an automation engineer.`}
                context={`Plugin: ${pluginName}\nType: ${pluginType}\nDescription: ${shortDesc}\nParameters: ${optionEntries.map((o) => o.name).join(', ')}`}
                label="Explain this plugin"
            />

            {description.length > 0 && (
                <div style={styles.section}>
                    {description.map((line, i) => (
                        <p key={i} style={styles.descLine}>
                            {line}
                        </p>
                    ))}
                </div>
            )}

            {optionEntries.length > 0 && (
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Parameters</h3>
                    <div style={styles.optionsTable}>
                        {optionEntries.map((opt) => (
                            <div key={opt.name} style={styles.optionRow}>
                                <div style={styles.optionHeader}>
                                    <code style={styles.optionName}>{opt.name}</code>
                                    {opt.required && (
                                        <span style={styles.requiredBadge}>required</span>
                                    )}
                                    {opt.type && (
                                        <span style={styles.typeMeta}>{opt.type}</span>
                                    )}
                                </div>
                                {opt.description && (
                                    <div style={styles.optionDesc}>
                                        {opt.description.join(' ')}
                                    </div>
                                )}
                                <div style={styles.optionMeta}>
                                    {opt.default !== undefined && (
                                        <span>
                                            Default: <code>{JSON.stringify(opt.default)}</code>
                                        </span>
                                    )}
                                    {opt.choices && opt.choices.length > 0 && (
                                        <span>
                                            Choices:{' '}
                                            {opt.choices.map((c, i) => (
                                                <React.Fragment key={i}>
                                                    {i > 0 && ', '}
                                                    <code>{JSON.stringify(c)}</code>
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    )}
                                    {opt.aliases && opt.aliases.length > 0 && (
                                        <span>Aliases: {opt.aliases.join(', ')}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {examples && (
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Examples</h3>
                    <pre style={styles.codeBlock}>{examples}</pre>
                </div>
            )}

            {returnEntries.length > 0 && (
                <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>Return Values</h3>
                    <div style={styles.optionsTable}>
                        {returnEntries.map((ret) => (
                            <div key={ret.name} style={styles.optionRow}>
                                <div style={styles.optionHeader}>
                                    <code style={styles.optionName}>{ret.name}</code>
                                    {ret.type && (
                                        <span style={styles.typeMeta}>{ret.type}</span>
                                    )}
                                </div>
                                {ret.description && (
                                    <div style={styles.optionDesc}>{ret.description}</div>
                                )}
                                {ret.returned && (
                                    <div style={styles.optionMeta}>
                                        Returned: {ret.returned}
                                    </div>
                                )}
                                {ret.sample !== undefined && (
                                    <pre style={styles.sampleBlock}>
                                        {typeof ret.sample === 'string'
                                            ? ret.sample
                                            : JSON.stringify(ret.sample, null, 2)}
                                    </pre>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxWidth: '900px',
        padding: '12px 20px',
    },
    backBtn: {
        alignSelf: 'flex-start',
        padding: '6px 12px',
        borderRadius: 'var(--navita-radius-md)',
        color: 'var(--navita-text-secondary)',
        fontSize: 'var(--navita-font-size-sm)',
        transition: 'var(--navita-transition)',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    title: {
        fontSize: 'var(--navita-font-size-xl)',
        fontWeight: 600,
        fontFamily: 'var(--navita-font-mono)',
    },
    typeBadge: {
        padding: '2px 8px',
        borderRadius: 'var(--navita-radius-sm)',
        background: 'var(--navita-bg-active)',
        color: 'var(--navita-text-secondary)',
        fontSize: 'var(--navita-font-size-xs)',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        fontFamily: 'var(--navita-font-mono)',
    },
    shortDesc: {
        fontSize: 'var(--navita-font-size-md)',
        color: 'var(--navita-text-secondary)',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    sectionTitle: {
        fontSize: 'var(--navita-font-size-lg)',
        fontWeight: 600,
        paddingBottom: '4px',
        borderBottom: '1px solid var(--navita-border)',
    },
    descLine: {
        color: 'var(--navita-text-secondary)',
        lineHeight: 1.6,
    },
    optionsTable: {
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-md)',
        overflow: 'hidden',
    },
    optionRow: {
        padding: '10px 14px',
        borderBottom: '1px solid var(--navita-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    optionHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    optionName: {
        fontFamily: 'var(--navita-font-mono)',
        fontSize: 'var(--navita-font-size-sm)',
        fontWeight: 600,
        color: 'var(--navita-text-primary)',
    },
    requiredBadge: {
        fontSize: 'var(--navita-font-size-xs)',
        padding: '1px 5px',
        borderRadius: '3px',
        background: 'var(--navita-error-subtle)',
        color: 'var(--navita-error)',
        fontWeight: 600,
    },
    typeMeta: {
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-tertiary)',
        fontFamily: 'var(--navita-font-mono)',
    },
    optionDesc: {
        fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-secondary)',
        lineHeight: 1.5,
    },
    optionMeta: {
        display: 'flex',
        gap: '16px',
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-tertiary)',
    },
    codeBlock: {
        padding: '14px',
        background: 'var(--navita-bg-tertiary)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-md)',
        overflow: 'auto',
        fontSize: 'var(--navita-font-size-sm)',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap' as const,
        userSelect: 'text',
    },
    sampleBlock: {
        padding: '8px 10px',
        background: 'var(--navita-bg-tertiary)',
        borderRadius: 'var(--navita-radius-sm)',
        fontSize: 'var(--navita-font-size-xs)',
        overflow: 'auto',
        maxHeight: '150px',
        userSelect: 'text',
    },
    loading: {
        padding: '40px',
        textAlign: 'center' as const,
        color: 'var(--navita-text-secondary)',
    },
    empty: {
        padding: '40px',
        textAlign: 'center' as const,
        color: 'var(--navita-text-secondary)',
    },
};
