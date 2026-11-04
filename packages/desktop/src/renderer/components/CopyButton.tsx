import type { JSX } from 'react';

/**
 * Icon button that copies a prompt to the clipboard.
 * @param props - Component properties.
 * @param props.label - Name echoed back after the copy, for the toast.
 * @param props.prompt - Text placed on the clipboard.
 * @param props.onCopied - Called with the label once the copy attempt finishes.
 * @returns The icon button element.
 */
export function CopyButton(props: {
    label: string;
    prompt: string;
    onCopied: (label: string) => void;
}): JSX.Element {
    const { label, prompt, onCopied } = props;

    return (
        <button
            type="button"
            className="icon-button"
            title="Copy prompt"
            aria-label={`Copy prompt for ${label}`}
            onClick={() => {
                window.navita
                    .copyText(prompt)
                    .then(() => {
                        onCopied(label);
                    })
                    .catch(() => {
                        onCopied(`could not copy ${label}`);
                    });
            }}
        >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                    d="M6 2.5h4a1 1 0 0 1 1 1V4h1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1v-.5a1 1 0 0 1 1-1Zm4 1.5V3H6v1h4ZM4 5v8h8V5H4Z"
                    fill="currentColor"
                />
            </svg>
        </button>
    );
}
