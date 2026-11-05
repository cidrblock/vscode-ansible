import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';

import { buildPreviewString } from '@ansible/common';
import { BridgeProvider, CreatorFormView, type SchemaNode } from '@ansible/ui';

import type { CreatorCommandEntry, CreatorResult } from '../../shared/ipc';
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
    const [open, setOpen] = useState<{ path: string[]; schema: SchemaNode } | null>(null);

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

    const bridge = useMemo(
        () =>
            createCreatorBridge({
                workspacePath: workspacePath ?? '',
                showToast: onNotice,
                cancel: () => {
                    setOpen(null);
                },
            }),
        [workspacePath, onNotice],
    );

    if (open !== null) {
        const command = open.path;
        const schema = open.schema;
        return (
            <div className="creator-form">
                <button
                    className="ghost"
                    onClick={() => {
                        setOpen(null);
                    }}
                >
                    ← Commands
                </button>
                <BridgeProvider value={bridge}>
                    <CreatorFormView
                        commandPath={command}
                        schema={schema}
                        buildPreview={(values) => buildPreviewString(command, schema, values)}
                    />
                </BridgeProvider>
            </div>
        );
    }

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
                            {group.commands.map((command) => {
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
                                                    setOpen({
                                                        path: command.path.split(' '),
                                                        schema,
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
                ))
            )}
        </section>
    );
}
