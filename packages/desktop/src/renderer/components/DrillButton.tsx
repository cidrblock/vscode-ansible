import type { JSX } from 'react';

/**
 * Trailing chevron on a row that goes one level deeper.
 *
 * Drilling in is a navigation, not an action on the item, so the control is an
 * arrow rather than a verb. Rows that also carry a clipboard button keep their
 * actions on the same right edge, with the chevron last.
 * @param props - Component properties.
 * @param props.label - Item being opened, used for the accessible name.
 * @param props.onOpen - Goes one level deeper into the item.
 * @param props.title - Hover text; defaults to "Open <label>".
 * @returns The icon button element.
 */
export function DrillButton(props: {
    label: string;
    onOpen: () => void;
    title?: string;
}): JSX.Element {
    const { label, onOpen, title } = props;

    return (
        <button
            type="button"
            className="icon-button drill-button"
            title={title ?? `Open ${label}`}
            aria-label={title ?? `Open ${label}`}
            onClick={onOpen}
        >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                    d="M6 3.2 10.8 8 6 12.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </button>
    );
}
