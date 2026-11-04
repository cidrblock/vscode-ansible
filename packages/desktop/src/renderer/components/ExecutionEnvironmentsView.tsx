import { useCallback, useEffect, useState, type JSX } from 'react';

import type { ExecutionEnvironmentsResult } from '../../shared/ipc';

/**
 * Execution Environments section, ported from `ansibleExecutionEnvironments`.
 * @returns The execution environments panel.
 */
export function ExecutionEnvironmentsView(): JSX.Element {
    const [result, setResult] = useState<ExecutionEnvironmentsResult | null>(null);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getExecutionEnvironments()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    environments: [],
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
                <h2>Execution Environments</h2>
                <span className="muted">
                    {result === null ? '…' : `${String(result.environments.length)} images`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Asking podman or docker for EE images…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not list images.'}</p>
            ) : result.environments.length === 0 ? (
                <p className="muted">
                    No execution-environment images found. Build one with ansible-builder.
                </p>
            ) : (
                <ul className="item-list">
                    {result.environments.map((environment) => (
                        <li key={environment.fullName} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{environment.fullName}</span>
                                <span className="item-description">
                                    {environment.imageId} · created {environment.created}
                                </span>
                            </div>
                            <span className="item-tag">EE</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
