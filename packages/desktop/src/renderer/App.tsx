import { useCallback, useEffect, useState, type JSX } from 'react';

import { HARNESSES, SECTIONS, type AppState, type HarnessId, type SectionId } from '../shared/ipc';
import { DevToolsView } from './components/DevToolsView';
import { Sidebar } from './components/Sidebar';
import { Welcome } from './components/Welcome';

/**
 * Render an unknown thrown value as a human readable message.
 * @param error - Value caught from a promise rejection or throw.
 * @returns The error message, or the value coerced to a string.
 */
function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Root component: shows the workspace welcome screen or the section shell.
 * @returns The application element.
 */
export function App(): JSX.Element {
    const [state, setState] = useState<AppState | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        window.navita
            .getState()
            .then((next) => {
                if (active) {
                    setState(next);
                }
            })
            .catch((error: unknown) => {
                setNotice(errorMessage(error));
            });
        const offState = window.navita.onStateChanged(setState);
        const offToggle = window.navita.onToggleSidebar(() => {
            setSidebarOpen((open) => !open);
        });
        return () => {
            active = false;
            offState();
            offToggle();
        };
    }, []);

    useEffect(() => {
        if (notice === null) {
            return undefined;
        }
        const timer = setTimeout(() => {
            setNotice(null);
        }, 4000);
        return () => {
            clearTimeout(timer);
        };
    }, [notice]);

    const run = useCallback((action: () => Promise<AppState | string>) => {
        action()
            .then((result) => {
                if (typeof result !== 'string') {
                    setState(result);
                }
            })
            .catch((error: unknown) => {
                setNotice(errorMessage(error));
            });
    }, []);

    const selectSection = useCallback(
        (section: SectionId) => {
            run(() => window.navita.showSection(section));
        },
        [run],
    );

    const copySnippet = useCallback((harness: HarnessId) => {
        window.navita
            .copySnippet(harness)
            .then(() => {
                setNotice('MCP snippet copied to clipboard.');
            })
            .catch((error: unknown) => {
                setNotice(errorMessage(error));
            });
    }, []);

    if (state === null) {
        return <div className="loading">Starting navita…</div>;
    }

    return (
        <div className="app">
            <header className="topbar">
                <span className="brand">navita</span>
                {state.workspace !== null ? (
                    <button
                        className="chip"
                        title={state.workspace.path}
                        onClick={() => {
                            run(() => window.navita.openWorkspace());
                        }}
                    >
                        {state.workspace.name}
                        <span className="chip-path">{state.workspace.path}</span>
                    </button>
                ) : (
                    <span className="chip chip-empty">No workspace</span>
                )}
                <span className="spacer" />
                {state.workspace !== null && (
                    <button
                        className="ghost"
                        onClick={() => {
                            run(() => window.navita.rescanWorkspace());
                        }}
                    >
                        Rescan
                    </button>
                )}
            </header>

            <div className="body">
                {state.workspace === null ? (
                    <Welcome
                        recents={state.recents}
                        onOpen={() => {
                            run(() => window.navita.openWorkspace());
                        }}
                        onActivate={(workspacePath) => {
                            run(() => window.navita.activateWorkspace(workspacePath));
                        }}
                    />
                ) : (
                    <>
                        {sidebarOpen && (
                            <Sidebar
                                sections={SECTIONS}
                                activeSection={state.activeSection}
                                onSelect={selectSection}
                            />
                        )}
                        <main className="pane">
                            <h1>{state.workspace.name}</h1>
                            <p className="muted">{state.workspace.path}</p>

                            {state.activeSection === 'dev-tools' && <DevToolsView />}

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
                                        run(() => window.navita.testConnection());
                                    }}
                                >
                                    Test connection
                                </button>
                            </section>

                            <section className="card">
                                <h2>Harness setup</h2>
                                <p className="muted">
                                    navita ships the MCP server. Paste this snippet into your
                                    harness&apos;s config:
                                </p>
                                <div className="harness-grid">
                                    {HARNESSES.map((harness) => (
                                        <button
                                            key={harness.id}
                                            className="ghost"
                                            onClick={() => {
                                                copySnippet(harness.id);
                                            }}
                                        >
                                            {harness.label}
                                            <span className="chip-path">{harness.configPath}</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </main>
                    </>
                )}
            </div>

            <footer className="statusbar">
                <span>
                    MCP: <StatusPill state={state.mcp.state} />
                </span>
                <span>
                    LSP: <StatusPill state={state.lsp.state} />
                </span>
                <span className="spacer" />
                <span className="muted">0.0.1</span>
            </footer>

            {notice !== null && <div className="toast">{notice}</div>}
        </div>
    );
}

/**
 * Small coloured badge for a server state.
 * @param props - Component properties.
 * @param props.state - Server state name used as the badge label and modifier.
 * @returns The badge element.
 */
function StatusPill(props: { state: string }): JSX.Element {
    return <span className={`pill pill-${props.state}`}>{props.state}</span>;
}
