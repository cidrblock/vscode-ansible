import { useEffect, useState, type JSX } from 'react';

import { HARNESSES, type HarnessId, type HarnessLaunch } from '../../shared/ipc';
import { ClipboardIcon } from './icons';
import { TerminalButton } from './TerminalButton';

export interface HarnessSetupViewProps {
    /** Copy the MCP snippet for one harness. */
    readonly onCopy: (harness: HarnessId) => void;
    /** Show a confirmation or a failure as a toast. */
    readonly onNotice: (message: string) => void;
}

/**
 * Snippets that point a harness at the MCP server navita ships.
 *
 * Each row also offers to start that harness in a terminal on this workspace:
 * the snippet is only useful once the harness is running in the project that
 * has it, and navita does not embed the harness itself.
 * @param props - Component properties.
 * @returns The harness setup pane.
 */
export function HarnessSetupView(props: HarnessSetupViewProps): JSX.Element {
    const { onCopy, onNotice } = props;
    const [launches, setLaunches] = useState<readonly HarnessLaunch[]>([]);

    useEffect(() => {
        let cancelled = false;
        window.navita
            .getHarnessLaunches()
            .then((result) => {
                if (!cancelled) {
                    setLaunches(result);
                }
            })
            .catch(() => {
                // Not knowing what is installed only hides the launcher buttons;
                // copying a snippet must keep working either way.
                if (!cancelled) {
                    setLaunches([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <section className="card">
            <h2>Harness setup</h2>
            <p className="muted">
                navita ships the MCP server. Paste this snippet into your harness&apos;s config,
                then start the harness in this workspace.
            </p>
            <ul className="item-list">
                {HARNESSES.map((harness) => {
                    const launch = launches.find((entry) => entry.id === harness.id);
                    const bin = harness.argv[0];
                    return (
                        <li key={harness.id} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{harness.label}</span>
                                <span className="item-description">{harness.configPath}</span>
                            </div>
                            {launch === undefined ? null : launch.detected ? (
                                <TerminalButton
                                    label={harness.label}
                                    title={harness.action}
                                    success={`${harness.action}.`}
                                    open={() => window.navita.openTerminal({ argv: launch.argv })}
                                    onNotice={onNotice}
                                />
                            ) : (
                                <span
                                    className="item-tag"
                                    title={`${bin} is not on PATH, so navita cannot start it.`}
                                >
                                    no {bin}
                                </span>
                            )}
                            <button
                                type="button"
                                className="icon-button"
                                title="Copy MCP snippet"
                                aria-label={`Copy MCP snippet for ${harness.label}`}
                                onClick={() => {
                                    onCopy(harness.id);
                                }}
                            >
                                <ClipboardIcon />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
