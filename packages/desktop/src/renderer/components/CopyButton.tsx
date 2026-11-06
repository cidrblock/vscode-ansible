import type { JSX } from 'react';

import { ClipboardIcon } from './icons';

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
            <ClipboardIcon />
        </button>
    );
}
