import { useCallback, useEffect, useState, type JSX } from 'react';

import type { DevToolsResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useListFilter } from '../filter';

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

    const filter = useListFilter(
        result?.packages ?? [],
        (entry) => `${entry.name} ${entry.location ?? ''}`,
    );

    return (
        <section className="card">
            <div className="card-header">
                <h2>Developer tools</h2>
                <FilterBox
                    label="Filter packages"
                    value={filter.query}
                    onChange={filter.setQuery}
                />
                <span className="muted">
                    {result === null
                        ? '…'
                        : filter.active
                          ? `${String(filter.matches)} of ${String(filter.total)} packages`
                          : `${String(result.packages.length)} packages`}
                </span>
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
            ) : filter.active && filter.items.length === 0 ? (
                <p className="muted">No packages match “{filter.query}”.</p>
            ) : (
                <>
                    <ul className="item-list">
                        {filter.items.map((entry) => (
                            <li key={entry.name} className="item-row">
                                <div className="item-main">
                                    <span className="item-title">{entry.name}</span>
                                    {entry.location !== undefined && (
                                        <span className="item-description">{entry.location}</span>
                                    )}
                                </div>
                                <span className="item-tag">{entry.version}</span>
                            </li>
                        ))}
                    </ul>
                    <CapNotice shown={filter.items.length} matches={filter.matches} />
                </>
            )}
        </section>
    );
}
