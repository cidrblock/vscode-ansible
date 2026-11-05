import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { SECTIONS, type AppState, type HarnessId, type SectionId } from '../shared/ipc';
import { CollectionsView } from './components/CollectionsView';
import { HarnessSetupView } from './components/HarnessSetupView';
import { ServicesView } from './components/ServicesView';
import { DevToolsView } from './components/DevToolsView';
import { ExecutionEnvironmentsView } from './components/ExecutionEnvironmentsView';
import { PlaybooksView } from './components/PlaybooksView';
import { CreatorView } from './components/CreatorView';
import { CollectionSourcesView } from './components/CollectionSourcesView';
import { EnvironmentsView } from './components/EnvironmentsView';
import { SkillsView } from './components/SkillsView';
import { ToolsView } from './components/ToolsView';
import { Sidebar } from './components/Sidebar';
import { ViewHeader, type CrumbLink } from './components/ViewHeader';
import { OverviewView } from './components/OverviewView';
import { StatusPill } from './components/StatusPill';
import { Welcome } from './components/Welcome';
import {
    emptyTrails,
    NavigationProvider,
    popCrumb,
    trailFor,
    truncateTrail,
    type Trails,
} from './navigation';

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
    const [trails, setTrails] = useState<Trails>(emptyTrails);

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

    // `system` removes the attribute so the prefers-color-scheme blocks in
    // styles.css decide; every other theme pins one palette.
    const theme = state?.theme;
    useEffect(() => {
        if (theme === undefined || theme === 'system') {
            document.documentElement.removeAttribute('data-theme');
            return;
        }
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

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

    const handleCopied = useCallback((label: string) => {
        setNotice(`Prompt copied for ${label}.`);
    }, []);

    const activeSection = state?.activeSection;
    const trail = activeSection === undefined ? [] : trailFor(trails, activeSection);
    const sectionLabel =
        activeSection === undefined
            ? ''
            : (SECTIONS.find((section) => section.id === activeSection)?.label ?? '');

    const updateTrails = useCallback((change: (current: Trails) => Trails) => {
        setTrails(change);
    }, []);

    const navigation = useMemo(() => ({ trails, update: updateTrails }), [trails, updateTrails]);

    const navigate = useCallback(
        (section: SectionId) => {
            setTrails((current) => truncateTrail(current, section, 0));
            run(() => window.navita.showSection(section));
        },
        [run],
    );

    // Back walks the view's own trail first, then falls back to the overview.
    const back = useCallback(() => {
        if (activeSection === undefined) {
            return;
        }
        if (trail.length > 0) {
            setTrails((current) => popCrumb(current, activeSection));
            return;
        }
        if (activeSection !== 'overview') {
            navigate('overview');
        }
    }, [activeSection, navigate, trail.length]);

    const goToDepth = useCallback(
        (depth: number) => {
            if (activeSection === undefined) {
                return;
            }
            setTrails((current) => truncateTrail(current, activeSection, depth));
        },
        [activeSection],
    );

    const crumbs = useMemo((): readonly CrumbLink[] => {
        if (activeSection === undefined || activeSection === 'overview') {
            return [{ label: 'Overview' }];
        }
        return [
            {
                label: 'Overview',
                onClick: () => {
                    navigate('overview');
                },
            },
            {
                label: sectionLabel,
                ...(trail.length === 0
                    ? {}
                    : {
                          onClick: () => {
                              goToDepth(0);
                          },
                      }),
            },
            ...trail.map((crumb, index) => ({
                label: crumb.label,
                ...(index === trail.length - 1
                    ? {}
                    : {
                          onClick: () => {
                              goToDepth(index + 1);
                          },
                      }),
            })),
        ];
    }, [activeSection, goToDepth, navigate, sectionLabel, trail]);

    const canGoBack =
        activeSection !== undefined && (trail.length > 0 || activeSection !== 'overview');

    // A different workspace means every trail points at data that no longer exists.
    const workspacePath = state?.workspace?.path;
    useEffect(() => {
        setTrails(emptyTrails());
    }, [workspacePath]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return;
            }
            const target = event.target;
            const typing =
                target instanceof HTMLElement &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    target.isContentEditable);
            if (!typing) {
                back();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [back]);

    useEffect(() => window.navita.onNavigateBack(back), [back]);

    if (state === null) {
        return <div className="loading">Starting navita…</div>;
    }

    return (
        <NavigationProvider value={navigation}>
            <div className="app">
                <header className="topbar">
                    <span className="brand">navita</span>
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
                                    workspace={state.workspace}
                                    recents={state.recents}
                                    onOpenWorkspace={() => {
                                        run(() => window.navita.openWorkspace());
                                    }}
                                    onActivateWorkspace={(workspacePath) => {
                                        run(() => window.navita.activateWorkspace(workspacePath));
                                    }}
                                    onRescanWorkspace={() => {
                                        run(() => window.navita.rescanWorkspace());
                                    }}
                                />
                            )}
                            <main className="pane">
                                <ViewHeader crumbs={crumbs} canGoBack={canGoBack} onBack={back} />

                                {state.activeSection === 'overview' && (
                                    <OverviewView
                                        state={state}
                                        onOpenWorkspace={() => {
                                            run(() => window.navita.openWorkspace());
                                        }}
                                        onRescanWorkspace={() => {
                                            run(() => window.navita.rescanWorkspace());
                                        }}
                                        onGo={navigate}
                                    />
                                )}

                                {state.activeSection === 'dev-tools' && <DevToolsView />}

                                {state.activeSection === 'env-managers' && (
                                    <EnvironmentsView workspacePath={state.workspace.path} />
                                )}

                                {state.activeSection === 'ai-tools' && (
                                    <ToolsView onCopied={handleCopied} />
                                )}

                                {state.activeSection === 'ai-skills' && (
                                    <SkillsView onCopied={handleCopied} />
                                )}

                                {state.activeSection === 'execution-environments' && (
                                    <ExecutionEnvironmentsView />
                                )}

                                {state.activeSection === 'installed-collections' && (
                                    <CollectionsView onCopied={handleCopied} onNotice={setNotice} />
                                )}

                                {state.activeSection === 'playbooks' && (
                                    <PlaybooksView
                                        workspacePath={state.workspace.path}
                                        onCopied={handleCopied}
                                    />
                                )}

                                {state.activeSection === 'creator' && (
                                    <CreatorView
                                        workspacePath={state.workspace.path}
                                        onCopied={handleCopied}
                                        onNotice={setNotice}
                                    />
                                )}

                                {state.activeSection === 'collection-sources' && (
                                    <CollectionSourcesView
                                        onCopied={handleCopied}
                                        onNotice={setNotice}
                                    />
                                )}

                                {state.activeSection === 'harness-setup' && (
                                    <HarnessSetupView onCopy={copySnippet} />
                                )}

                                {state.activeSection === 'services' && (
                                    <ServicesView
                                        state={state}
                                        onTest={() => {
                                            run(() => window.navita.testConnection());
                                        }}
                                    />
                                )}
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
                    {state.workspace !== null && (
                        <span className="status-path" title={state.workspace.path}>
                            {state.workspace.path}
                        </span>
                    )}
                    {state.workspace !== null && (
                        <span
                            className="status-env"
                            title={
                                state.environment?.pythonPath ?? 'No Python environment resolved'
                            }
                        >
                            <span className="muted">Python</span>
                            {state.environment?.name ?? '—'}
                        </span>
                    )}
                    <span className="muted">0.0.1</span>
                </footer>

                {notice !== null && <div className="toast">{notice}</div>}
            </div>
        </NavigationProvider>
    );
}
