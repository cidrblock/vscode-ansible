import type { JSX } from 'react';

/**
 * Makes a whole row one navigation target, with a chevron as its affordance.
 *
 * The row itself cannot be a button, because rows that also copy a prompt hold
 * a second button. Instead this renders a transparent button covering the row
 * and a decorative chevron on the right; the row's other controls sit above the
 * overlay, so they keep their own clicks and focus.
 * @param props - Component properties.
 * @param props.label - Item being opened, used for the accessible name.
 * @param props.onOpen - Goes one level deeper into the item.
 * @param props.title - Hover text; defaults to "Open <label>".
 * @returns The chevron and the row-wide button.
 */
export function DrillLink(props: {
    label: string;
    onOpen: () => void;
    title?: string;
}): JSX.Element {
    const { label, onOpen, title } = props;
    const text = title ?? `Open ${label}`;

    return (
        <>
            <span className="drill-chevron" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="15" height="15">
                    <path
                        d="M6 3.2 10.8 8 6 12.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </span>
            <button
                type="button"
                className="row-hit"
                title={text}
                aria-label={text}
                onClick={onOpen}
            />
        </>
    );
}
