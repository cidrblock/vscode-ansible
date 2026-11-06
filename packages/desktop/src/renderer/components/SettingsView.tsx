import { useCallback, useEffect, useState, type JSX } from 'react';

import {
    THEMES,
    type AppSettings,
    type AppState,
    type PlaybookExecutor,
    type TerminalInfo,
} from '../../shared/ipc';
import { MAX_GITHUB_ORGS, PLAYBOOK_EXECUTORS } from '../../shared/settings';
import { useTrail } from '../navigation';
import {
    parseSettingsTrail,
    SETTINGS_PAGES,
    settingsCrumb,
    type SettingsPage,
} from '../settingsPath';
import { DrillLink } from './DrillLink';

/**
 * Settings section: a root list of preference groups, and one page per group.
 *
 * The pages are crumbs rather than a second sidebar, so the app's own trail
 * carries the hierarchy and Back leaves Settings the same way it leaves any
 * other view.
 * @param props - Component properties.
 * @param props.state - Application state carrying the current preferences.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The settings panel.
 */
export function SettingsView(props: {
    state: AppState;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { state, onNotice } = props;
    const { trail, push } = useTrail('settings');
    const page = parseSettingsTrail(trail);

    if (page === 'appearance') {
        return <AppearancePage state={state} />;
    }

    if (page === 'workspace') {
        return <WorkspacePage state={state} onNotice={onNotice} />;
    }

    if (page === 'sources') {
        return <SourcesPage settings={state.settings} onNotice={onNotice} />;
    }

    if (page === 'playbooks') {
        return <PlaybooksPage settings={state.settings} onNotice={onNotice} />;
    }

    if (page === 'terminal') {
        return <TerminalPage settings={state.settings} onNotice={onNotice} />;
    }

    if (page === 'about') {
        return <AboutPage state={state} onNotice={onNotice} />;
    }

    return (
        <SettingsRoot
            onOpen={(next) => {
                push(settingsCrumb(next));
            }}
        />
    );
}

/**
 * The root list: one row per settings page.
 * @param props - Component properties.
 * @param props.onOpen - Opens the page the user picked.
 * @returns The settings root pane.
 */
function SettingsRoot(props: { onOpen: (page: SettingsPage) => void }): JSX.Element {
    const { onOpen } = props;
    return (
        <section className="card">
            <div className="card-header">
                <h2>Settings</h2>
                <span className="muted">{SETTINGS_PAGES.length} groups</span>
            </div>
            <ul className="item-list">
                {SETTINGS_PAGES.map((entry) => (
                    <li key={entry.id} className="item-row item-row-drill">
                        <div className="item-main">
                            <span className="item-title">{entry.title}</span>
                            <span className="item-description">{entry.description}</span>
                        </div>
                        <DrillLink
                            label={entry.title}
                            onOpen={() => {
                                onOpen(entry.id);
                            }}
                        />
                    </li>
                ))}
            </ul>
        </section>
    );
}

/**
 * Theme picker. The status-bar select stays as a shortcut.
 * @param props - Component properties.
 * @param props.state - Application state carrying the active theme.
 * @returns The appearance page.
 */
function AppearancePage(props: { state: AppState }): JSX.Element {
    const { state } = props;
    return (
        <section className="card">
            <div className="card-header">
                <h2>Appearance</h2>
            </div>
            <p className="muted">
                Follow System tracks the desktop preference; the named palettes pin one look.
            </p>
            <ul className="item-list">
                {THEMES.map((theme) => (
                    <ChoiceRow
                        key={theme.id}
                        title={theme.label}
                        selected={state.theme === theme.id}
                        onSelect={() => {
                            void window.navita.setTheme(theme.id);
                        }}
                    />
                ))}
            </ul>
        </section>
    );
}

/**
 * The open workspace, its interpreter pin, and the recent-workspace list.
 * @param props - Component properties.
 * @param props.state - Application state.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The workspace page.
 */
function WorkspacePage(props: {
    state: AppState;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { state, onNotice } = props;
    const pinned = state.pinnedEnvironment;
    return (
        <>
            <section className="card">
                <div className="card-header">
                    <h2>Workspace</h2>
                </div>
                <dl className="facts">
                    <dt>Path</dt>
                    <dd>{state.workspace?.path ?? 'No workspace open.'}</dd>
                    <dt>Python</dt>
                    <dd>
                        {pinned === null
                            ? 'Discovered automatically from the workspace and PATH.'
                            : `Pinned to ${pinned}`}
                    </dd>
                </dl>
                {pinned !== null && (
                    <button
                        className="ghost"
                        onClick={() => {
                            void window.navita.selectEnvironment(null).then(() => {
                                onNotice('Interpreter pin cleared; discovery takes over.');
                            });
                        }}
                    >
                        Clear pin
                    </button>
                )}
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Recent workspaces</h2>
                    <span className="muted">
                        {state.recents.length === 0
                            ? 'None yet'
                            : `${String(state.recents.length)} remembered`}
                    </span>
                    <button
                        className="ghost"
                        disabled={state.recents.length === 0}
                        onClick={() => {
                            void window.navita.clearRecents().then(() => {
                                onNotice('Recent workspaces cleared.');
                            });
                        }}
                    >
                        Clear
                    </button>
                </div>
                {state.recents.length === 0 ? (
                    <p className="muted">
                        Workspaces appear here after you open them from File › Open Workspace.
                    </p>
                ) : (
                    <ul className="item-list">
                        {state.recents.map((recent) => (
                            <li key={recent.path} className="item-row">
                                <div className="item-main">
                                    <span className="item-title">{recent.name}</span>
                                    <span className="item-description">{recent.path}</span>
                                </div>
                                {recent.path === state.workspace?.path ? (
                                    <span className="item-tag">open</span>
                                ) : (
                                    <button
                                        className="icon-button"
                                        title={`Forget ${recent.name}`}
                                        aria-label={`Remove ${recent.name} from recent workspaces`}
                                        onClick={() => {
                                            void window.navita
                                                .removeRecent(recent.path)
                                                .then(() => {
                                                    onNotice(`Forgot ${recent.name}.`);
                                                });
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}

/**
 * GitHub organizations Collection Sources scans.
 * @param props - Component properties.
 * @param props.settings - Current settings.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The collection sources page.
 */
function SourcesPage(props: {
    settings: AppSettings;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { settings, onNotice } = props;
    const [draft, setDraft] = useState('');

    const save = useCallback(
        (orgs: readonly string[]) => {
            void window.navita.updateSettings({ githubOrgs: orgs }).then((next) => {
                onNotice(`Scanning ${String(next.settings.githubOrgs.length)} organization(s).`);
            });
        },
        [onNotice],
    );

    const add = useCallback(() => {
        const org = draft.trim();
        if (org.length === 0) {
            return;
        }
        if (settings.githubOrgs.some((entry) => entry.toLowerCase() === org.toLowerCase())) {
            onNotice(`${org} is already in the list.`);
            return;
        }
        if (settings.githubOrgs.length >= MAX_GITHUB_ORGS) {
            onNotice(`A list of ${String(MAX_GITHUB_ORGS)} organizations is the limit.`);
            return;
        }
        save([...settings.githubOrgs, org]);
        setDraft('');
    }, [draft, onNotice, save, settings.githubOrgs]);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Collection Sources</h2>
                <span className="muted">
                    {settings.githubOrgs.length} of {MAX_GITHUB_ORGS} organizations
                </span>
            </div>
            <p className="muted">
                Each organization is scanned with the GitHub code search API, so every entry costs a
                handful of authenticated requests. Scans run from Collection Sources, not here.
            </p>
            <ul className="item-list">
                {settings.githubOrgs.map((org) => (
                    <li key={org} className="item-row">
                        <div className="item-main">
                            <span className="item-title">{org}</span>
                        </div>
                        <button
                            className="icon-button"
                            title={`Stop scanning ${org}`}
                            aria-label={`Remove ${org}`}
                            onClick={() => {
                                save(settings.githubOrgs.filter((entry) => entry !== org));
                            }}
                        >
                            ×
                        </button>
                    </li>
                ))}
            </ul>
            <form
                className="setting-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    add();
                }}
            >
                <input
                    className="filter-box setting-input"
                    aria-label="GitHub organization to add"
                    placeholder="organization"
                    value={draft}
                    onChange={(event) => {
                        setDraft(event.target.value);
                    }}
                />
                <button className="ghost" type="submit">
                    Add organization
                </button>
            </form>
        </section>
    );
}

/**
 * Playbook executor and navigator configuration.
 * @param props - Component properties.
 * @param props.settings - Current settings.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The playbooks settings page.
 */
function PlaybooksPage(props: {
    settings: AppSettings;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { settings, onNotice } = props;
    const [config, setConfig] = useState(settings.navigatorConfig);

    useEffect(() => {
        setConfig(settings.navigatorConfig);
    }, [settings.navigatorConfig]);

    const choose = useCallback(
        (executor: PlaybookExecutor) => {
            void window.navita.updateSettings({ playbookExecutor: executor }).then((next) => {
                onNotice(`Playbooks run with ${next.settings.playbookExecutor}.`);
            });
        },
        [onNotice],
    );

    return (
        <>
            <section className="card">
                <div className="card-header">
                    <h2>Runner</h2>
                </div>
                <ul className="item-list">
                    {PLAYBOOK_EXECUTORS.map((executor) => (
                        <ChoiceRow
                            key={executor.id}
                            title={executor.label}
                            description={executor.hint}
                            selected={settings.playbookExecutor === executor.id}
                            onSelect={() => {
                                choose(executor.id);
                            }}
                        />
                    ))}
                </ul>
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Navigator config</h2>
                </div>
                <p className="muted">
                    Path to an ansible-navigator configuration file. Leave empty to use the
                    project&apos;s own or the user default.
                </p>
                <form
                    className="setting-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void window.navita
                            .updateSettings({ navigatorConfig: config })
                            .then((next) => {
                                onNotice(
                                    next.settings.navigatorConfig.length === 0
                                        ? 'Navigator config cleared.'
                                        : `Navigator config set to ${next.settings.navigatorConfig}.`,
                                );
                            });
                    }}
                >
                    <input
                        className="filter-box setting-input"
                        aria-label="ansible-navigator config path"
                        placeholder="~/.ansible-navigator.yml"
                        value={config}
                        onChange={(event) => {
                            setConfig(event.target.value);
                        }}
                    />
                    <button className="ghost" type="submit">
                        Save
                    </button>
                </form>
            </section>
        </>
    );
}

/**
 * Which terminal navita opens, and the command line it uses to do it.
 *
 * Every desktop spells "run this in a new window" differently, so the setting
 * is a template rather than a binary: `{command}` is required and `{dir}` is
 * optional. The detected list is a shortcut, never a restriction.
 * @param props - Component properties.
 * @param props.settings - Current settings.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The terminal settings page.
 */
function TerminalPage(props: {
    settings: AppSettings;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { settings, onNotice } = props;
    const [info, setInfo] = useState<TerminalInfo | null>(null);
    const [draft, setDraft] = useState(settings.terminal);

    useEffect(() => {
        setDraft(settings.terminal);
    }, [settings.terminal]);

    const refresh = useCallback(() => {
        window.navita
            .getTerminalInfo()
            .then(setInfo)
            .catch(() => {
                setInfo(null);
            });
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const save = useCallback(
        (template: string) => {
            window.navita
                .updateSettings({ terminal: template })
                .then(() => {
                    onNotice(
                        template.length === 0
                            ? 'Using the detected terminal.'
                            : 'Terminal command saved.',
                    );
                    refresh();
                })
                .catch((error: unknown) => {
                    onNotice(error instanceof Error ? error.message : String(error));
                });
        },
        [onNotice, refresh],
    );

    const test = useCallback(() => {
        window.navita
            .openTerminal()
            .then((result) => {
                onNotice(
                    result.state === 'error'
                        ? `Could not open a terminal. ${result.detail ?? ''}`.trim()
                        : 'Opened a terminal in this workspace.',
                );
            })
            .catch((error: unknown) => {
                onNotice(error instanceof Error ? error.message : String(error));
            });
    }, [onNotice]);

    const effective = info?.template ?? null;

    return (
        <>
            <section className="card">
                <div className="card-header">
                    <h2>Terminal command</h2>
                    <button className="ghost" onClick={test}>
                        Test
                    </button>
                </div>
                <p className="muted">
                    A command line with <code>{'{command}'}</code> where the command goes and
                    optional <code>{'{dir}'}</code> for the workspace. Leave empty to use the first
                    detected terminal.
                </p>
                <form
                    className="setting-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        save(draft);
                    }}
                >
                    <input
                        className="filter-box setting-input"
                        aria-label="Terminal command template"
                        placeholder="ptyxis --working-directory {dir} -- {command}"
                        value={draft}
                        onChange={(event) => {
                            setDraft(event.target.value);
                        }}
                    />
                    <button className="ghost" type="submit">
                        Save
                    </button>
                    <button
                        className="ghost"
                        type="button"
                        disabled={draft.length === 0}
                        onClick={() => {
                            save('');
                        }}
                    >
                        Use detected
                    </button>
                </form>
                <pre className="install-output">
                    {effective ?? 'No known terminal found on PATH — set a command above.'}
                </pre>
            </section>

            <section className="card">
                <div className="card-header">
                    <h2>Detected terminals</h2>
                    <span className="muted">
                        {String(info?.candidates.filter((entry) => entry.detected).length ?? 0)}{' '}
                        found
                    </span>
                </div>
                <ul className="item-list">
                    {(info?.candidates ?? []).map((candidate) => (
                        <li key={candidate.bin} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{candidate.bin}</span>
                                <span className="item-description">{candidate.template}</span>
                            </div>
                            {candidate.detected ? (
                                <span className="item-tag">installed</span>
                            ) : (
                                <span className="muted">not installed</span>
                            )}
                            <button
                                className="ghost"
                                disabled={!candidate.detected}
                                onClick={() => {
                                    save(candidate.template);
                                }}
                            >
                                Use
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </>
    );
}

/**
 * Version, install location and state file.
 * @param props - Component properties.
 * @param props.state - Application state.
 * @param props.onNotice - Shows a short confirmation as a toast.
 * @returns The about page.
 */
function AboutPage(props: { state: AppState; onNotice: (message: string) => void }): JSX.Element {
    const { state, onNotice } = props;
    return (
        <section className="card">
            <div className="card-header">
                <h2>About</h2>
                <span className="item-tag version">{state.about.version}</span>
            </div>
            <dl className="facts">
                <dt>Install path</dt>
                <dd>{state.about.installPath}</dd>
                <dt>State file</dt>
                <dd>{state.about.statePath}</dd>
                <dt>MCP tools</dt>
                <dd>{state.mcp.detail ?? 'Server not started.'}</dd>
            </dl>
            <button
                className="ghost"
                onClick={() => {
                    void window.navita.openPath(state.about.statePath).catch(() => {
                        onNotice('Could not reveal the state file.');
                    });
                }}
            >
                Reveal state file
            </button>
        </section>
    );
}

/**
 * A row that picks one of a few values, for example a theme.
 * @param props - Component properties.
 * @param props.title - Value label.
 * @param props.description - What the value does, when it needs explaining.
 * @param props.selected - Whether this value is in effect.
 * @param props.onSelect - Called when the row is clicked.
 * @returns The choice row.
 */
function ChoiceRow(props: {
    title: string;
    description?: string;
    selected: boolean;
    onSelect: () => void;
}): JSX.Element {
    const { title, description, selected, onSelect } = props;
    return (
        <li className="item-row item-row-action">
            <div className="item-main">
                <span className="item-title">{title}</span>
                {description !== undefined && (
                    <span className="item-description">{description}</span>
                )}
            </div>
            <span className="nav-check" aria-hidden="true">
                {selected ? '●' : '○'}
            </span>
            <button
                className="row-hit"
                aria-label={`Use ${title}`}
                aria-pressed={selected}
                onClick={onSelect}
            />
        </li>
    );
}
