import React from 'react';

export function PlatformTab(): React.JSX.Element {
    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <span style={styles.label}>Platform</span>
                <h2 style={styles.heading}>Ansible Automation Platform</h2>
                <p style={styles.description}>
                    Connect to an AAP Controller to browse inventories, launch job templates,
                    and stream live execution events.
                </p>
                <p style={styles.hint}>
                    Configure a controller URL in Settings to get started.
                </p>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '420px',
        textAlign: 'center',
        padding: '40px',
    },
    label: {
        fontSize: 'var(--studio-font-size-xs)',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        color: 'var(--studio-text-tertiary)',
    },
    heading: {
        fontSize: 'var(--studio-font-size-xl)',
        fontWeight: 600,
        color: 'var(--studio-text-primary)',
    },
    description: {
        fontSize: 'var(--studio-font-size-md)',
        color: 'var(--studio-text-secondary)',
        lineHeight: 1.6,
    },
    hint: {
        fontSize: 'var(--studio-font-size-sm)',
        color: 'var(--studio-text-tertiary)',
        marginTop: '8px',
    },
};
