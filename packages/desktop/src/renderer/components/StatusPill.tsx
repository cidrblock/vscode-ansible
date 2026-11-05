import type { JSX } from 'react';

export interface StatusPillProps {
    /** Server state name, used as both the label and the modifier class. */
    readonly state: string;
}

/**
 * Small coloured badge for a server state.
 * @param props - Component properties.
 * @returns The badge element.
 */
export function StatusPill(props: StatusPillProps): JSX.Element {
    return <span className={`pill pill-${props.state}`}>{props.state}</span>;
}
