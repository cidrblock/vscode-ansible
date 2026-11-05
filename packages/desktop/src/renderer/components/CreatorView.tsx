import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { buildPreviewString } from '@ansible/common';
import { BridgeProvider, CreatorFormView, type SchemaNode } from '@ansible/ui';

import type { CreatorCommandEntry, CreatorResult } from '../../shared/ipc';
import { CapNotice, FilterBox, useGroupedFilter } from '../filter';
import { useTrail } from '../navigation';
import { CopyButton } from './CopyButton';
import { createCreatorBridge } from './creatorBridge';

export interface CreatorViewProps {
    /** Workspace the forms pre-fill path fields from. */
    readonly workspacePath: string | null;
    /** Called with a label once a command template is copied. */
    readonly onCopied: (label: string) => void;
    /** Called with a message the form wants surfaced. */
    readonly onNotice: (message: string) => void;
}

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
 * Walk the creator schema to the node a catalog row describes.
 * @param schema - Root of the `ansible-creator schema` tree.
 * @param path - Command path as shown in the catalog, for example `init collection`.
 * @returns The command node, or null when the schema does not describe it.
 */
function commandNode(schema: SchemaNode | null | undefined, path: string): SchemaNode | null {
    if (schema === null || schema === undefined) {
        return null;
    }
    let node: SchemaNode | undefined = schema;
    for (const segment of path.split(' ')) {
        node = node.subcommands?.[segment];
        if (node === undefined) {
            return null;
        }
    }
    return node;
}

/**
 * Creator section, ported from `ansibleCreator`.
 *
 * The dynamic form is the extension's own `CreatorFormView` from
 * `@ansible/ui`, rendered straight into the pane; navita supplies the bridge.
 * @param props - Component properties.
 * @returns The creator panel.
 */
export function CreatorView(props: CreatorViewProps): JSX.Element {
    const { workspacePath, onCopied, onNotice } = props;
    const [result, setResult] = useState<CreatorResult | null>(null);
    const { trail, push, reset } = useTrail('creator');

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
    const filter = useGroupedFilter(
        groups,
        (group) => group.commands,
        (command) => `${command.name} ${command.description ?? ''} ${command.command}`,
    );

    const bridge = useMemo(
        () =>
            createCreatorBridge({
                workspacePath: workspacePath ?? '',
                showToast: onNotice,
                cancel: reset,
            }),
        [workspacePath, onNotice, reset],
    );

    // The trail, not local state, says whether a form is open: Back and the
    // breadcrumbs are shared by every view.
    const open = trail.at(-1);
    const schema = open === undefined ? null : commandNode(result?.schema, open.id);

    // A trail from a previous schema (an upgrade removed the command) would
    // otherwise strand the user on a form that cannot be built.
    useEffect(() => {
        if (open !== undefined && result?.state === 'ready' && schema === null) {
            reset();
        }
    }, [open, schema, result, reset]);

    if (open !== undefined) {
        if (schema === null) {
            return <p className="muted">Reading the creator schema…</p>;
        }
        const command = open.id.split(' ');
        return (
            <BridgeProvider value={bridge}>
                <CreatorFormView
                    commandPath={command}
                    schema={schema}
                    buildPreview={(values) => buildPreviewString(command, schema, values)}
                />
            </BridgeProvider>
        );
    }

    return (
        <section className="card">
            <div className="card-header">
                <h2>Creator</h2>
                <FilterBox
                    label="Filter commands"
                    value={filter.query}
                    onChange={filter.setQuery}
                />
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
            ) : filter.active && filter.groups.length === 0 ? (
                <p className="muted">No commands match “{filter.query}”.</p>
            ) : (
                <>
                    {filter.groups.map(({ group, items }) => (
                        <div key={group.group} className="playbook-group">
                            <h3 className="group-label">ansible-creator {group.group}</h3>
                            <ul className="item-list">
                                {items.map((command) => {
                                    const schema = commandNode(result.schema, command.path);
                                    return (
                                        <li key={command.path} className="item-row">
                                            <div className="item-main">
                                                <span className="item-title">{command.name}</span>
                                                {command.description !== undefined && (
                                                    <span className="item-description">
                                                        {command.description}
                                                    </span>
                                                )}
                                                <code className="command-template">
                                                    {command.command}
                                                </code>
                                            </div>
                                            {command.required.length > 0 && (
                                                <span className="item-tag">
                                                    {String(command.required.length)} required
                                                </span>
                                            )}
                                            <button
                                                className="ghost"
                                                disabled={schema === null}
                                                title={
                                                    schema === null
                                                        ? 'This command has no form schema'
                                                        : `Fill in ${command.path} and run it`
                                                }
                                                onClick={() => {
                                                    if (schema !== null) {
                                                        push({
                                                            id: command.path,
                                                            label: command.path,
                                                        });
                                                    }
                                                }}
                                            >
                                                Configure
                                            </button>
                                            <CopyButton
                                                label={command.path}
                                                prompt={command.command}
                                                onCopied={onCopied}
                                            />
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
