/**
 * Inline "sparkle button" that opens the chat sidebar and pushes a
 * structured prompt. All streaming happens in the ChatPanel.
 */

import React, { useCallback } from 'react';
import { useAi } from '../hooks/useAiContext';

interface AiAnalysisProps {
    prompt: string;
    context?: string;
    label?: string;
}

export function AiAnalysis({ prompt, context, label = 'Analyze with AI' }: AiAnalysisProps): React.JSX.Element {
    const { requestAnalysis } = useAi();

    const handleClick = useCallback(() => {
        requestAnalysis(prompt, context);
    }, [prompt, context, requestAnalysis]);

    return (
        <button style={styles.analyzeBtn} onClick={handleClick} title={label}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: '4px', flexShrink: 0 }}>
                <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor" opacity="0.7" />
                <path d="M12 9l.8 1.8L14.6 11.6l-1.8.8L12 14.2l-.8-1.8-1.8-.8 1.8-.8L12 9z" fill="currentColor" opacity="0.5" />
            </svg>
            {label}
        </button>
    );
}

const styles: Record<string, React.CSSProperties> = {
    analyzeBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        background: 'var(--studio-bg-tertiary)',
        border: '1px solid var(--studio-border)',
        borderRadius: 'var(--studio-radius-sm)',
        fontSize: 'var(--studio-font-size-xs)',
        color: 'var(--studio-text-secondary)',
        cursor: 'pointer',
        fontFamily: 'var(--studio-font-sans)',
        transition: 'var(--studio-transition)',
    },
};
