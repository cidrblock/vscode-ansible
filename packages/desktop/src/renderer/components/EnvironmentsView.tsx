import { useCallback, useEffect, useState, type JSX } from 'react';

import type { EnvironmentGroupsResult } from '../../shared/ipc';

/**
 * Environment Managers section: Python interpreters navita discovered without
 * any VS Code extension, ported from `ansibleDevToolsEnvManagers`.
 * @param props - Component properties.
 * @param props.workspacePath - Workspace whose local virtual environments are scanned.
 * @returns The environments panel.
 */
export function EnvironmentsView(props: { workspacePath: string | null }): JSX.Element {
    const [result, setResult] = useState<EnvironmentGroupsResult | null>(null);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getEnvironments(props.workspacePath)
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    groups: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, [props.workspacePath]);

    useEffect(() => {
        load();
    }, [load]);

    const empty = result !== null && result.groups.length === 0;

    return (
        <section className="card">
            <div className="card-header">
                <h2>Environment Managers</h2>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Looking for Python environments…</p>
            ) : empty ? (
                <p className="muted">
                    {result.state === 'error'
                        ? (result.detail ?? 'Discovery failed.')
                        : 'No Python environments found on PATH or in this workspace.'}
                </p>
            ) : (
                result.groups.map((group) => (
                    <div key={group.id} className="env-group">
                        <h3>{group.label}</h3>
                        <ul className="item-list">
                            {group.environments.map((environment) => (
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
                                    {environment.active && (
                                        <span className="pill pill-ready">active</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
}
