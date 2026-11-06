import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';

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
import { DiagnosticsPage } from './components/DiagnosticsPage';
import { LogsView } from './components/LogsView';
import { SettingsView } from './components/SettingsView';
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
    // Source the Logs page should open filtered to; reset when leaving it so a
    // menu visit does not inherit the filter a diagnostics action asked for.
    const [logSource, setLogSource] = useState<'all' | 'app' | 'lsp'>('all');

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

    // Entering a section always starts at its root. The trail of the section
    // being left is untouched, but nothing renders it until you come back
    // through here again.
    const navigate = useCallback(
        (section: SectionId) => {
            if (section !== 'logs') {
                setLogSource('all');
            }
            setTrails((current) => truncateTrail(current, section, 0));
            run(() => window.navita.showSection(section));
        },
        [run],
    );

    const openLogs = useCallback(
        (source: 'app' | 'lsp') => {
            setLogSource(source);
            navigate('logs');
        },
        [navigate],
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

    // Depth drives the page transition. The previous page is kept in state so
    // the direction is already known when the new page mounts, which is what
    // lets its slide start on first paint instead of one frame late.
    const pageKey = `${activeSection ?? ''}:${trail.map((crumb) => crumb.id).join('>')}`;
    const [previousPage, setPreviousPage] = useState<{
        key: string;
        section: SectionId | undefined;
        depth: number;
        move: 'forward' | 'back';
    }>({ key: pageKey, section: activeSection, depth: trail.length, move: 'forward' });
    if (previousPage.key !== pageKey) {
        const deeper = previousPage.section === activeSection && trail.length < previousPage.depth;
        const toOverview = activeSection === 'overview' && previousPage.section !== 'overview';
        setPreviousPage({
            key: pageKey,
            section: activeSection,
            depth: trail.length,
            move: deeper || toOverview ? 'back' : 'forward',
        });
    }
    const pageMove = previousPage.move;

    // The page is animated here rather than through a keyed remount, so a view
    // keeps its own state (filter text, open form) when the trail moves. Keys
    // would restart the animation but throw that state away on every step.
    const pageRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const element = pageRef.current;
        if (element === null || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        element.animate(
            [
                {
                    opacity: 0,
                    transform: `translateX(${pageMove === 'forward' ? '12px' : '-12px'})`,
                },
                { opacity: 1, transform: 'translateX(0)' },
            ],
            { duration: 170, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
    }, [pageKey, pageMove]);

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

    // The View menu asks for a section rather than applying it, so it takes the
    // same path as the sidebar and resets depth on the way in.
    useEffect(() => window.navita.onSectionRequested(navigate), [navigate]);

    if (state === null) {
        return <div className="loading">Starting navita…</div>;
    }

    return (
        <NavigationProvider value={navigation}>
            <div className="app">
                {state.workspace !== null && (
                    <header className="topbar">
                        <ViewHeader
                            crumbs={crumbs}
                            canGoBack={canGoBack}
                            onBack={back}
                            onOpenSettings={() => {
                                navigate('settings');
                            }}
                        />
                    </header>
                )}

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
                                    onSelect={navigate}
                                    workspace={state.workspace}
                                    recents={state.recents}
                                    onActivateWorkspace={(workspacePath) => {
                                        run(() => window.navita.activateWorkspace(workspacePath));
                                    }}
                                />
                            )}
                            <main className="pane">
                                <div className="page" ref={pageRef}>
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

                                    {state.activeSection === 'dev-tools' && (
                                        <DevToolsView onNotice={setNotice} />
                                    )}

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
                                        <CollectionsView
                                            onCopied={handleCopied}
                                            onNotice={setNotice}
                                        />
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

                                    {state.activeSection === 'diagnostics' && (
                                        <DiagnosticsPage
                                            onNotice={setNotice}
                                            onNavigate={navigate}
                                            onOpenLogs={openLogs}
                                        />
                                    )}

                                    {state.activeSection === 'logs' && (
                                        <LogsView onNotice={setNotice} initialSource={logSource} />
                                    )}

                                    {state.activeSection === 'settings' && (
                                        <SettingsView state={state} onNotice={setNotice} />
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
                                </div>
                            </main>
                        </>
                    )}
                </div>

                <footer className="statusbar">
                    <button
                        type="button"
                        className="status-link"
                        title="Open diagnostics"
                        onClick={() => {
                            navigate('diagnostics');
                        }}
                    >
                        MCP: <StatusPill state={state.mcp.state} />
                    </button>
                    <button
                        type="button"
                        className="status-link"
                        title="Open diagnostics"
                        onClick={() => {
                            navigate('diagnostics');
                        }}
                    >
                        LSP: <StatusPill state={state.lsp.state} />
                    </button>
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
