import type { JSX } from 'react';

import type { AppState } from '../../shared/ipc';
import { StatusPill } from './StatusPill';

export interface ServicesViewProps {
    readonly state: AppState;
    readonly onTest: () => void;
}

/**
 * Health of the two stdio servers navita ships and supervises.
 * @param props - Component properties.
 * @param props.state - Application state carrying both server statuses.
 * @param props.onTest - Called when the user asks for a live handshake.
 * @returns The services pane.
 */
export function ServicesView(props: ServicesViewProps): JSX.Element {
    const { state, onTest } = props;
    return (
        <section className="card">
            <h2>Servers</h2>
            <dl className="status-list">
                <dt>MCP server</dt>
                <dd>
                    <StatusPill state={state.mcp.state} />
                    {state.mcp.detail !== undefined && (
                        <span className="muted">{state.mcp.detail}</span>
                    )}
                </dd>
                <dt>Language server</dt>
                <dd>
                    <StatusPill state={state.lsp.state} />
                    {state.lsp.detail !== undefined && (
                        <span className="muted">{state.lsp.detail}</span>
                    )}
                </dd>
            </dl>
            <button
                className="ghost"
                onClick={() => {
                    onTest();
                }}
            >
                Test connection
            </button>
        </section>
    );
}
