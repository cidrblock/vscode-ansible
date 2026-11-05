import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import type { CreatorCommandEntry, CreatorResult } from '../../shared/ipc';
import { CopyButton } from './CopyButton';

/**
 * Group creator commands by their top-level command.
 * @param commands - Command catalog reported by the main process.
 * @returns Group label and its commands, ordered by label.
 */
function groupCommands(
    commands: readonly CreatorCommandEntry[],
): { group: string; commands: CreatorCommandEntry[] }[] {
    const groups = new Map<string, CreatorCommandEntry[]>();
    for (const command of commands) {
        const bucket = groups.get(command.group);
        if (bucket === undefined) {
            groups.set(command.group, [command]);
        } else {
            bucket.push(command);
        }
    }
    return [...groups.entries()]
        .map(([group, entries]) => ({ group, commands: entries }))
        .sort((left, right) => left.group.localeCompare(right.group));
}

/**
 * Creator section, ported from `ansibleCreator`.
 * @param props - Component properties.
 * @param props.onCopied - Called with a label once a command is copied.
 * @returns The creator panel.
 */
export function CreatorView(props: { onCopied: (label: string) => void }): JSX.Element {
    const { onCopied } = props;
    const [result, setResult] = useState<CreatorResult | null>(null);

    const load = useCallback(() => {
        setResult(null);
        window.navita
            .getCreator()
            .then(setResult)
            .catch((error: unknown) => {
                setResult({
                    state: 'error',
                    status: 'unknown',
                    commands: [],
                    detail: error instanceof Error ? error.message : String(error),
                });
            });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groups = useMemo(() => (result === null ? [] : groupCommands(result.commands)), [result]);

    return (
        <section className="card">
            <div className="card-header">
                <h2>Creator</h2>
                <span className="muted">
                    {result === null
                        ? '…'
                        : result.state === 'ready'
                          ? `${String(result.commands.length)} commands${result.version === undefined ? '' : ` · ${result.version}`}`
                          : 'unavailable'}
                </span>
                <button className="ghost" onClick={load}>
                    Refresh
                </button>
            </div>
            {result === null ? (
                <p className="muted">Reading the ansible-creator schema…</p>
            ) : result.state === 'error' ? (
                <p className="muted">{result.detail ?? 'ansible-creator is unavailable.'}</p>
            ) : groups.length === 0 ? (
                <p className="muted">This ansible-creator version exposes no commands.</p>
            ) : (
                groups.map((group) => (
                    <div key={group.group} className="playbook-group">
                        <h3 className="group-label">ansible-creator {group.group}</h3>
                        <ul className="item-list">
                            {group.commands.map((command) => (
                                <li key={command.path} className="item-row">
                                    <div className="item-main">
                                        <span className="item-title">{command.name}</span>
                                        {command.description !== undefined && (
                                            <span className="item-description">
                                                {command.description}
                                            </span>
                                        )}
                                        <code className="command-template">{command.command}</code>
                                    </div>
                                    {command.required.length > 0 && (
                                        <span className="item-tag">
                                            {String(command.required.length)} required
                                        </span>
                                    )}
                                    <CopyButton
                                        label={command.path}
                                        prompt={command.command}
                                        onCopied={onCopied}
                                    />
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </section>
    );
}
