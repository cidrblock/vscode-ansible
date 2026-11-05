import { Fragment, type JSX } from 'react';

import type { Crumb } from '../navigation';

export interface ViewHeaderProps {
    /** Label of the section this view belongs to. */
    readonly label: string;
    /** Depth inside the section, newest last. */
    readonly trail: readonly Crumb[];
    /** Go one level up. */
    readonly onBack: () => void;
    /** Cut the trail back to a depth, for breadcrumb clicks. */
    readonly onCrumb: (depth: number) => void;
}

/**
 * Breadcrumbs and the single Back control every view shares.
 *
 * Depth is expressed once, here, so a new drill-down view only has to push a
 * crumb rather than invent its own back button.
 * @param props - Component properties.
 * @returns The pane header element.
 */
export function ViewHeader(props: ViewHeaderProps): JSX.Element {
    const { label, trail, onBack, onCrumb } = props;
    const canGoBack = trail.length > 0;
    return (
        <header className="view-header">
            {canGoBack ? (
                <button
                    className="icon-button back-button"
                    title="Back (Alt+Left)"
                    aria-label="Back"
                    onClick={onBack}
                >
                    ←
                </button>
            ) : (
                <span className="back-spacer" aria-hidden="true" />
            )}
            <nav className="breadcrumbs" aria-label="Breadcrumb">
                <button
                    className="crumb"
                    disabled={!canGoBack}
                    onClick={() => {
                        onCrumb(0);
                    }}
                >
                    {label}
                </button>
                {trail.map((crumb, index) => (
                    <Fragment key={`${crumb.id}-${String(index)}`}>
                        <span className="crumb-separator" aria-hidden="true">
                            /
                        </span>
                        <button
                            className="crumb"
                            disabled={index === trail.length - 1}
                            onClick={() => {
                                onCrumb(index + 1);
                            }}
                        >
                            {crumb.label}
                        </button>
                    </Fragment>
                ))}
            </nav>
        </header>
    );
}
