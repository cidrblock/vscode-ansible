import React from 'react';

interface EmptyColumnProps {
    message?: string;
}

export function EmptyColumn({ message }: EmptyColumnProps): React.JSX.Element {
    return (
        <div style={styles.container}>
            <span style={styles.text}>{message ?? 'Select an item'}</span>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '20px',
    },
    text: {
        fontSize: 'var(--studio-font-size-sm)',
        color: 'var(--studio-text-tertiary)',
    },
};
