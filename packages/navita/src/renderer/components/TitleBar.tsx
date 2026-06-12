import React from 'react';
import { api } from '../api';

interface TitleBarProps {
    onChatToggle?: () => void;
}

export function TitleBar({ onChatToggle }: TitleBarProps): React.JSX.Element {
    return (
        <div style={styles.bar}>
            <div style={styles.brand}>
                <span style={styles.brandMark}>AS</span>
                <span style={styles.brandText}>Ansible Navita</span>
            </div>
            <div style={styles.dragArea} />
            <div style={styles.controls}>
                {onChatToggle && (
                    <button
                        style={styles.controlBtn}
                        onClick={onChatToggle}
                        title="Toggle AI Chat"
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" opacity="0.7" />
                            <path d="M12 9l.8 1.8L14.6 11.6l-1.8.8L12 14.2l-.8-1.8-1.8-.8 1.8-.8L12 9z" fill="currentColor" opacity="0.5" />
                        </svg>
                    </button>
                )}
                <button
                    style={styles.controlBtn}
                    onClick={() => void api.windowMinimize()}
                    title="Minimize"
                >
                    <svg width="10" height="1" viewBox="0 0 10 1">
                        <rect fill="currentColor" width="10" height="1" />
                    </svg>
                </button>
                <button
                    style={styles.controlBtn}
                    onClick={() => void api.windowMaximize()}
                    title="Maximize"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
                    </svg>
                </button>
                <button
                    style={{ ...styles.controlBtn, ...styles.closeBtn }}
                    onClick={() => void api.windowClose()}
                    title="Close"
                >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
                        <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    bar: {
        display: 'flex',
        alignItems: 'center',
        height: '38px',
        flexShrink: 0,
        background: 'var(--navita-bg-secondary)',
        borderBottom: '1px solid var(--navita-border)',
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 14px',
        flexShrink: 0,
        WebkitAppRegion: 'drag' as unknown as undefined,
    },
    brandMark: {
        fontSize: 'var(--navita-font-size-xs)',
        fontWeight: 700,
        fontFamily: 'var(--navita-font-mono)',
        color: 'var(--navita-text-tertiary)',
        letterSpacing: '1px',
    },
    brandText: {
        fontWeight: 500,
        fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-secondary)',
        letterSpacing: '0.2px',
    },
    dragArea: {
        flex: 1,
        height: '100%',
        WebkitAppRegion: 'drag' as unknown as undefined,
    },
    controls: {
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        flexShrink: 0,
    },
    controlBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '46px',
        height: '100%',
        color: 'var(--navita-text-tertiary)',
        transition: 'var(--navita-transition)',
        border: 'none',
        background: 'none',
    },
    closeBtn: {},
};
