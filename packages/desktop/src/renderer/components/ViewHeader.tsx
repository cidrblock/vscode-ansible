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
                    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                        <path
                            fill="currentColor"
                            d="M8 10.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm0-1.2a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"
                        />
                        <path
                            fill="currentColor"
                            d="M7.1 1h1.8l.3 1.6c.5.1.9.3 1.3.6l1.5-.7 1 1.5-1.2 1.1c.1.3.1.6.1.9s0 .6-.1.9l1.2 1.1-1 1.5-1.5-.7c-.4.3-.8.5-1.3.6L8.9 15H7.1l-.3-1.6c-.5-.1-.9-.3-1.3-.6l-1.5.7-1-1.5 1.2-1.1A3.9 3.9 0 0 1 4.1 10c0-.3 0-.6.1-.9L3 8l1-1.5 1.5.7c.4-.3.8-.5 1.3-.6L7.1 1Zm.9 1.1-.1.9c-.7.1-1.4.4-1.9.8l-.9-.4-.4.6.7.6c-.2.4-.4 1-.4 1.4s.1 1 .4 1.4l-.7.6.4.6.9-.4c.5.4 1.2.7 1.9.8l.1.9h.9l.1-.9c.7-.1 1.4-.4 1.9-.8l.9.4.4-.6-.7-.6c.2-.4.4-1 .4-1.4s-.1-1-.4-1.4l.7-.6-.4-.6-.9.4c-.5-.4-1.2-.7-1.9-.8l-.1-.9h-.9Z"
                        />
                    </svg>
                </button>
            )}
        </div>
    );
}
