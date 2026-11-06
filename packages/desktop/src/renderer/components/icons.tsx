import type { JSX } from 'react';

/**
 * Clipboard glyph used by every copy action.
 * @returns The icon element.
 */
export function ClipboardIcon(): JSX.Element {
    return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
                d="M6 2.5h4a1 1 0 0 1 1 1V4h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1v-.5a1 1 0 0 1 1-1Zm4 1.5V3H6v1h4ZM4 5v8h8V5H4Z"
                fill="currentColor"
            />
        </svg>
    );
}

/**
 * Terminal glyph: a window frame with a prompt inside.
 * @returns The icon element.
 */
export function TerminalIcon(): JSX.Element {
    return (
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <rect
                x="1.75"
                y="2.75"
                width="12.5"
                height="10.5"
                rx="1.6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
            />
            <path
                d="M4.6 6.2 6.4 8l-1.8 1.8M8.6 9.9h2.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
