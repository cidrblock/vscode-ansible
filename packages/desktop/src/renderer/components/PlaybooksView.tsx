import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { groupByFolder } from '../../shared/playbooks';
import type { PlaybooksResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useGroupedFilter } from '../filter';
import { CopyButton } from './CopyButton';
import { TerminalButton } from './TerminalButton';

/**
 * Playbooks section, ported from `ansiblePlaybooks`.
 * @param props - Component properties.
 * @param props.workspacePath - Open workspace, scanned for playbooks.
 * @param props.onCopied - Called with a label once a prompt is copied.
 * @param props.onNotice - Shows a confirmation or a failure as a toast.
 * @returns The playbooks panel.
 */
export function PlaybooksView(props: {
    workspacePath: string;
    onCopied: (label: string) => void;
    onNotice: (message: string) => void;
}): JSX.Element {
    const { workspacePath, onCopied, onNotice } = props;
    const [result, setResult] = useState<PlaybooksResult | null>(null);
    const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getPlaybooks(workspacePath)
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    playbooks: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, [workspacePath]);

    useEffect(() => {
        load();
    }, [load]);

    const groups = useMemo(
        () => (result === null ? [] : groupByFolder(result.playbooks)),
        [result],
    );
    const filter = useGroupedFilter(
        groups,
        (group) => group.playbooks,
        (playbook) => `${playbook.name} ${playbook.relativePath}`,
    );

    const toggle = (playbookPath: string): void => {
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(playbookPath)) {
                next.delete(playbookPath);
            } else {
                next.add(playbookPath);
            }
            return next;
        });
    };

    return (
        <section className="card">
            <div className="card-header">
                <h2>Playbooks</h2>
                <FilterBox
                    label="Filter playbooks"
                    value={filter.query}
                    onChange={filter.setQuery}
                />
                <span className="muted">
                    {result === null
                        ? '…'
                        : filter.active
                          ? `${String(filter.matches)} of ${String(filter.total)} playbooks`
                          : `${String(result.playbooks.length)} playbooks`}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Scanning the workspace for playbooks…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'Could not read playbooks.'}</p>
            ) : groups.length === 0 ? (
                <p className="muted">
                    No playbooks found. A playbook is a YAML file whose top level is a list of plays
                    with hosts.
                </p>
            ) : filter.active && filter.groups.length === 0 ? (
                <p className="muted">No playbooks match “{filter.query}”.</p>
            ) : (
                <>
                    {filter.groups.map(({ group, items }) => (
                        <div key={group.folder} className="playbook-group">
                            <h3 className="group-label">{group.folder}</h3>
                            <ul className="item-list">
                                {items.map((playbook) => {
                                    const open = expanded.has(playbook.path);
                                    return (
                                        <li key={playbook.path} className="playbook-item">
                                            <div className="item-row">
                                                <button
                                                    type="button"
                                                    className="disclosure"
                                                    aria-expanded={open}
                                                    aria-label={`${open ? 'Hide' : 'Show'} plays in ${playbook.name}`}
                                                    onClick={() => {
                                                        toggle(playbook.path);
                                                    }}
                                                >
                                                    <svg
                                                        viewBox="0 0 16 16"
                                                        width="12"
                                                        height="12"
                                                        aria-hidden="true"
                                                        className={
                                                            open ? 'chevron open' : 'chevron'
                                                        }
                                                    >
                                                        <path
                                                            d="M6 3.5 10.5 8 6 12.5"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.6"
                                                            strokeLinecap="round"
                                                        />
                                                    </svg>
                                                </button>
                                                <div className="item-main">
                                                    <span className="item-title">
                                                        {playbook.name}
                                                    </span>
                                                    <span className="item-description">
                                                        {playbook.relativePath}
                                                    </span>
                                                </div>
                                                <span className="item-tag">
                                                    {String(playbook.playCount)} play
                                                    {playbook.playCount === 1 ? '' : 's'}
                                                </span>
                                                <TerminalButton
                                                    label={playbook.name}
                                                    title="Run in terminal"
                                                    success={`Running ${playbook.name} in a terminal.`}
                                                    open={() =>
                                                        window.navita.runPlaybookInTerminal(
                                                            playbook.relativePath,
                                                        )
                                                    }
                                                    onNotice={onNotice}
                                                />
                                                <CopyButton
                                                    label={playbook.name}
                                                    prompt={playbook.prompt}
                                                    onCopied={onCopied}
                                                />
                                            </div>
                                            {open && (
                                                <ul className="play-list">
                                                    {playbook.plays.map((play, index) => (
                                                        <li
                                                            key={`${playbook.path}:${String(index)}`}
                                                            className="play-row"
                                                        >
                                                            <span className="item-title">
                                                                {play.name}
                                                            </span>
                                                            <span className="item-description">
                                                                hosts: {play.hosts} · line{' '}
                                                                {String(play.lineNumber)}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                    <CapNotice
                        shown={filter.groups.reduce(
                            (count, entry) => count + entry.items.length,
                            0,
                        )}
                        matches={filter.matches}
                    />
                </>
            )}
        </section>
    );
}
