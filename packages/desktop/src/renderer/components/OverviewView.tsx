import { useEffect, useState, type JSX } from 'react';

import type { AppState, DevToolsResult, SectionId } from '../../shared/ipc';
import { StatusPill } from './StatusPill';

export interface OverviewViewProps {
    /** Application state: workspace, interpreter and both server statuses. */
    readonly state: AppState;
    /** Open the workspace picker. */
    readonly onOpenWorkspace: () => void;
    /** Rescan the open workspace. */
    readonly onRescanWorkspace: () => void;
    /** Jump to the view that owns a control. */
    readonly onGo: (section: SectionId) => void;
}

/**
 * Landing page: what navita is pointed at and whether it can do useful work.
 *
 * It reports and routes; the controls stay in the views that own them, so
 * there is one place to change each thing.
 * @param props - Component properties.
 * @returns The overview pane.
 */
export function OverviewView(props: OverviewViewProps): JSX.Element {
    const { state, onOpenWorkspace, onRescanWorkspace, onGo } = props;
    const [devTools, setDevTools] = useState<DevToolsResult | null>(null);

    useEffect(() => {
        window.navita
            .getDevTools()
            .then(setDevTools)
            .catch((error: unknown) => {
                setDevTools({
                    state: 'error',
                    packages: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    const core = devTools?.packages.find((entry) => entry.name === 'ansible-core');
    const packageCount = devTools?.packages.length ?? 0;

    return (
        <>
            <section className="card">
                <div className="card-header">
                    <h2>Workspace</h2>
                    <button className="ghost" onClick={onOpenWorkspace}>
                        Open Workspace…
                    </button>
                </div>
                {state.workspace === null ? (
                    <p className="muted">No workspace open. Pick a folder to start.</p>
                ) : (
                    <>
                        <p className="overview-value">{state.workspace.name}</p>
                        <p className="muted overview-path">{state.workspace.path}</p>
                        <button className="ghost" onClick={onRescanWorkspace}>
                            Rescan Workspace
                        </button>
                    </>
                )}
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Python environment</h2>
                    <button
                        className="ghost"
                        onClick={() => {
                            onGo('env-managers');
                        }}
                    >
                        Manage
                    </button>
                </div>
                {state.environment === null ? (
                    <p className="muted">
                        No interpreter resolved. Ansible tools will not run until one is found.
                    </p>
                ) : (
                    <>
                        <p className="overview-value">
                            {state.environment.name}
                            {state.environment.version !== undefined && (
                                <span className="item-tag">{state.environment.version}</span>
                            )}
                        </p>
                        <p className="muted overview-path">{state.environment.pythonPath}</p>
                    </>
                )}
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Ansible Dev Tools</h2>
                    <button
                        className="ghost"
                        onClick={() => {
                            onGo('dev-tools');
                        }}
                    >
                        Open Dev Tools
                    </button>
                </div>
                {devTools === null ? (
                    <p className="muted">Checking the Python environment…</p>
                ) : packageCount === 0 ? (
                    <p className="muted">
                        {devTools.detail ??
                            'ansible-dev-tools is not installed in this environment.'}
                    </p>
                ) : (
                    <p className="overview-value">
                        {String(packageCount)} packages
                        {core !== undefined && (
                            <span className="item-tag">core {core.version}</span>
                        )}
                    </p>
                )}
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Servers</h2>
                    <button
                        className="ghost"
                        onClick={() => {
                            onGo('services');
                        }}
                    >
                        Open Services
                    </button>
                </div>
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
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Harness</h2>
                    <button
                        className="ghost"
                        onClick={() => {
                            onGo('harness-setup');
                        }}
                    >
                        Open Harness Setup
                    </button>
                </div>
                <p className="muted">
                    navita ships the MCP server. Copy a snippet for Cursor, Claude Code, Codex or VS
                    Code.
                </p>
            </section>
        </>
    );
}
