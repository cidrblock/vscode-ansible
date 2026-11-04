import { useCallback, useEffect, useState, type JSX } from 'react';

import type { DevToolsResult } from '../../shared/ipc';

/**
 * Ansible Dev Tools section: the developer packages found in the active
 * Python environment, ported from the `ansibleDevToolsPackages` view.
 * @returns The dev tools panel.
 */
export function DevToolsView(): JSX.Element {
    const [result, setResult] = useState<DevToolsResult | null>(null);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getDevTools()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    packages: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Ansible Dev Tools</h2>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Reading installed packages…</p>
            ) : result.packages.length === 0 ? (
                <p className="muted">
                    {result.state === 'error'
                        ? (result.detail ?? 'Discovery failed.')
                        : 'No Ansible developer tools found on PATH.'}
                </p>
            ) : (
                <ul className="package-list">
                    {result.packages.map((entry) => (
                        <li key={entry.name}>
                            <span className="package-name">{entry.name}</span>
                            <span className="muted">{entry.version}</span>
                            {entry.location !== undefined && (
                                <span className="chip-path">{entry.location}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
