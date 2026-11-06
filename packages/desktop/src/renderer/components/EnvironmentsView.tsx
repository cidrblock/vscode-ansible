import { useCallback, useEffect, useState, type JSX } from 'react';

import type { EnvironmentGroupsResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useGroupedFilter } from '../filter';

export interface EnvironmentsViewProps {
    /** Workspace whose local virtual environments are scanned. */
    readonly workspacePath: string | null;
}

/**
 * Environment Managers section: Python interpreters navita discovered without
 * any VS Code extension, ported from `ansibleDevToolsEnvManagers`.
 *
 * The interpreter marked `in use` is the one every service runs commands in.
 * Picking another row pins it for this workspace, which respawns the MCP and
 * language servers with the new PATH; `Automatic` returns to discovery order.
 * @param props - Component properties.
 * @returns The environments panel.
 */
export function EnvironmentsView(props: EnvironmentsViewProps): JSX.Element {
    const { workspacePath } = props;
    const [result, setResult] = useState<EnvironmentGroupsResult | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getEnvironments(workspacePath)
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    groups: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, [workspacePath]);

    useEffect(() => {
        load();
    }, [load]);

    const choose = useCallback(
        (pythonPath: string | null) => {
            setBusy(true);
            window.navita
                .selectEnvironment(pythonPath)
                .then(() => {
                    load();
                })
                .catch((error: unknown) => {
                    setResult({
                        state: 'error',
                        groups: [],
                        detail: error instanceof Error ? error.message : String(error),
                    });
                })
                .finally(() => {
                    setBusy(false);
                });
        },
        [load],
    );

    const empty = result !== null && result.groups.length === 0;
    const pinned = result?.selection ?? null;
    const filter = useGroupedFilter(
        result?.groups ?? [],
        (group) => group.environments,
        (environment) => `${environment.name} ${environment.pythonPath}`,
    );
    const shown = filter.groups.reduce((count, entry) => count + entry.items.length, 0);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Python environment</h2>
                <FilterBox
                    label="Filter environments"
                    value={filter.query}
                    onChange={filter.setQuery}
                />
                <div className="header-actions">
                    {pinned !== null && (
                        <button
                            className="ghost"
                            disabled={busy}
                            onClick={() => {
                                choose(null);
                            }}
                        >
                            Automatic
                        </button>
                    )}
                    <button className="ghost" disabled={busy} onClick={load}>
                        Refresh
                    </button>
                </div>
            </div>
            {result === null ? (
                <p className="muted">Looking for Python environments…</p>
            ) : empty ? (
                <p className="muted">
                    {result.state === 'error'
                        ? (result.detail ?? 'Discovery failed.')
                        : 'No Python environments found on PATH or in this workspace.'}
                </p>
            ) : filter.active && filter.groups.length === 0 ? (
                <p className="muted">No environments match “{filter.query}”.</p>
            ) : (
                <>
                    {filter.groups.map(({ group, items }) => (
                        <div key={group.id} className="env-group">
                            <h3>{group.label}</h3>
                            <ul className="item-list">
                                {items.map((environment) => (
                                    <li key={environment.pythonPath} className="item-row">
                                        <div className="item-main">
                                            <span className="item-title">{environment.name}</span>
                                            <span className="item-description">
                                                {environment.pythonPath}
                                            </span>
                                        </div>
                                        {environment.version !== undefined && (
                                            <span className="item-tag">{environment.version}</span>
                                        )}
                                        {environment.active ? (
                                            <span className="pill pill-ready">in use</span>
                                        ) : (
                                            <button
                                                className="ghost"
                                                disabled={busy}
                                                title={`Run Ansible commands with ${environment.pythonPath}`}
                                                onClick={() => {
                                                    choose(environment.pythonPath);
                                                }}
                                            >
                                                Use
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    <CapNotice shown={shown} matches={filter.matches} />
                </>
            )}
        </section>
    );
}
