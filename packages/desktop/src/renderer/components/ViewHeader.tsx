import { Fragment, type JSX } from 'react';

/** One breadcrumb; the last one is the page being shown. */
export interface CrumbLink {
    readonly label: string;
    /** Omitted for the current page. */
    readonly onClick?: () => void;
}

export interface ViewHeaderProps {
    /** Trail from the overview down to the current page. */
    readonly crumbs: readonly CrumbLink[];
    /** Whether there is anywhere to go back to. */
    readonly canGoBack: boolean;
    /** Go one level up. */
    readonly onBack: () => void;
}

/**
 * The app bar: breadcrumbs and the single Back control every view shares.
 *
 * Depth is expressed once, here, so a new drill-down view only has to push a
 * crumb rather than invent its own back button. It sits above the sidebar and
 * the pane rather than inside the pane, so the trail is the same wherever you
 * are in the window.
 * @param props - Component properties.
 * @returns The app bar contents.
 */
export function ViewHeader(props: ViewHeaderProps): JSX.Element {
    const { crumbs, canGoBack, onBack } = props;
    return (
        <div className="view-header">
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
                {crumbs.map((crumb, index) => (
                    <Fragment key={`${crumb.label}-${String(index)}`}>
                        {index > 0 && (
                            <span className="crumb-separator" aria-hidden="true">
                                /
                            </span>
                        )}
                        {crumb.onClick === undefined ? (
                            <span className="crumb crumb-current" aria-current="page">
                                {crumb.label}
                            </span>
                        ) : (
                            <button className="crumb" onClick={crumb.onClick}>
                                {crumb.label}
                            </button>
                        )}
                    </Fragment>
                ))}
            </nav>
        </div>
    );
}
