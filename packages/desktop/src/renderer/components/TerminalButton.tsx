import type { JSX } from 'react';

import type { TerminalOpenResult } from '../../shared/ipc';
import { TerminalIcon } from './icons';

/**
 * Icon button that hands a command to the user's terminal.
 *
 * navita never runs the command itself: the terminal shows what was asked for,
 * keeps its output, and lets the user answer anything interactive.
 * @param props - Component properties.
 * @param props.label - Name echoed into the button's accessible label.
 * @param props.title - Tooltip text.
 * @param props.success - Toast shown once the terminal is up.
 * @param props.open - Starts the terminal, resolving to what navita ran.
 * @param props.onNotice - Shows the confirmation or the failure as a toast.
 * @returns The icon button element.
 */
export function TerminalButton(props: {
    label: string;
    title: string;
    success: string;
    open: () => Promise<TerminalOpenResult>;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { label, title, success, open, onNotice } = props;

    return (
        <button
            type="button"
            className="icon-button"
            title={title}
            aria-label={`${title} (${label})`}
            onClick={() => {
                open()
                    .then((result) => {
                        onNotice(
                            result.state === 'error'
                                ? (result.detail ?? 'Could not open a terminal.')
                                : success,
                        );
                    })
                    .catch((error: unknown) => {
                        onNotice(error instanceof Error ? error.message : String(error));
                    });
            }}
        >
            <TerminalIcon />
        </button>
    );
}
