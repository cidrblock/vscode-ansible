import type { JSX } from 'react';

import { HARNESSES, type HarnessId } from '../../shared/ipc';

export interface HarnessSetupViewProps {
    readonly onCopy: (harness: HarnessId) => void;
}

/**
 * Snippets that point a harness at the MCP server navita ships.
 * @param props - Component properties.
 * @param props.onCopy - Called with the harness whose snippet to copy.
 * @returns The harness setup pane.
 */
export function HarnessSetupView(props: HarnessSetupViewProps): JSX.Element {
    const { onCopy } = props;
    return (
        <section className="card">
            <h2>Harness setup</h2>
            <p className="muted">
                navita ships the MCP server. Paste this snippet into your harness&apos;s config:
            </p>
            <div className="harness-grid">
                {HARNESSES.map((harness) => (
                    <button
                        key={harness.id}
                        className="ghost"
                        onClick={() => {
                            onCopy(harness.id);
                        }}
                    >
                        {harness.label}
                        <span className="chip-path">{harness.configPath}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
