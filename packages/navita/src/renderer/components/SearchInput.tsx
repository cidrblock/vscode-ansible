import React, { useRef, useEffect } from 'react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    autoFocus = false,
}: SearchInputProps): React.JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    return (
        <div style={styles.wrapper}>
            <span style={styles.icon}>/</span>
            <input
                ref={inputRef}
                style={styles.input}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
            {value && (
                <button style={styles.clear} onClick={() => onChange('')} title="Clear">
                    ×
                </button>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        background: 'var(--navita-bg-tertiary)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-md)',
        transition: 'var(--navita-transition)',
    },
    icon: {
        fontSize: 'var(--navita-font-size-sm)',
        fontFamily: 'var(--navita-font-mono)',
        color: 'var(--navita-text-tertiary)',
        flexShrink: 0,
        width: '14px',
        textAlign: 'center' as const,
    },
    input: {
        flex: 1,
        background: 'none',
        border: 'none',
        outline: 'none',
        color: 'var(--navita-text-primary)',
        fontSize: 'var(--navita-font-size-base)',
    },
    clear: {
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-lg)',
        lineHeight: 1,
        cursor: 'pointer',
        padding: '0 2px',
    },
};
