import { useCallback, useEffect, useState, type JSX } from 'react';

import type { DevToolsInstallResult, DevToolsResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useListFilter } from '../filter';

export interface DevToolsViewProps {
    /** Shows a short confirmation or failure as a toast. */
    readonly onNotice: (message: string) => void;
}

/**
 * Ansible Dev Tools section: the developer packages found in the active
 * Python environment, ported from the `ansibleDevToolsPackages` view.
 *
 * The extension puts Install, Upgrade and Refresh in this view's title bar, so
 * the same three actions live here; Install only appears when the environment
 * has nothing, which is the only time it can change the list.
 * @param props - Component properties.
 * @returns The dev tools panel.
 */
export function DevToolsView(props: DevToolsViewProps): JSX.Element {
    const { onNotice } = props;
    const [result, setResult] = useState<DevToolsResult | null>(null);
    const [busy, setBusy] = useState<'install' | 'upgrade' | null>(null);
    const [action, setAction] = useState<DevToolsInstallResult | null>(null);

    const load = useCallback((quiet = false) => {
        if (!quiet) {
            setResult(null);
        }
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

    /**
     * Run one of the two package actions, then re-read the list.
     * @param kind - Which action the user pressed.
     */
    const runAction = useCallback(
        (kind: 'install' | 'upgrade') => {
            setBusy(kind);
            setAction(null);
            const request =
                kind === 'install'
                    ? window.navita.installDevTools()
                    : window.navita.upgradeDevTools();
            request
                .then((outcome) => {
                    setAction(outcome);
                    onNotice(
                        outcome.state === 'ready'
                            ? `${kind === 'install' ? 'Installed' : 'Upgraded'} — ${String(outcome.packageCount)} packages in the active environment.`
                            : `${kind === 'install' ? 'Install' : 'Upgrade'} failed.`,
                    );
                    load(true);
                })
                .catch((error: unknown) => {
                    setAction({
                        state: 'error',
                        exitCode: 1,
                        output: error instanceof Error ? error.message : String(error),
                        packageCount: 0,
                    });
                })
                .finally(() => {
                    setBusy(null);
                });
        },
        [load, onNotice],
    );

    const filter = useListFilter(
        result?.packages ?? [],
        (entry) => `${entry.name} ${entry.location ?? ''}`,
    );
    const hasPackages = (result?.packages.length ?? 0) > 0;

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
                {hasPackages && (
                    <button
                        className="ghost"
                        disabled={busy !== null}
                        onClick={() => {
                            runAction('upgrade');
                        }}
                    >
                        {busy === 'upgrade' ? 'Upgrading…' : 'Upgrade'}
                    </button>
                )}
                <button
                    className="ghost"
                    disabled={busy !== null}
                    onClick={() => {
                        load();
                    }}
                >
                    Refresh
                </button>
            </div>
            {action?.state === 'error' && <pre className="install-output">{action.output}</pre>}
            {result === null ? (
                <p className="muted">Reading installed packages…</p>
            ) : result.packages.length === 0 ? (
                <>
                    <p className="muted">
                        {result.state === 'error'
                            ? (result.detail ?? 'Discovery failed.')
                            : 'No Ansible developer tools found in the active Python environment.'}
                    </p>
                    <button
                        className="ghost"
                        disabled={busy !== null}
                        onClick={() => {
                            runAction('install');
                        }}
                    >
                        {busy === 'install' ? 'Installing…' : 'Install ansible-dev-tools (pip)'}
                    </button>
                </>
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
