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
    /** Opens the Settings section; the gear is only drawn when this is given. */
    readonly onOpenSettings?: () => void;
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
    const { crumbs, canGoBack, onBack, onOpenSettings } = props;
    return (
        <div className="view-header">
            {canGoBack && (
                <button
                    className="icon-button back-button"
                    title="Back (Alt+Left)"
                    aria-label="Back"
                    onClick={onBack}
                >
                    ←
                </button>
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
            {onOpenSettings !== undefined && (
                <button
                    className="icon-button settings-button"
                    title="Settings"
                    aria-label="Settings"
                    onClick={onOpenSettings}
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
