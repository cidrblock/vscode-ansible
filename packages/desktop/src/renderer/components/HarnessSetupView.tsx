import { useCallback, useEffect, useState, type JSX } from 'react';

import {
    HARNESSES,
    type HarnessConfigState,
    type HarnessConfigStatus,
    type HarnessId,
    type HarnessLaunch,
    type HarnessScope,
} from '../../shared/ipc';
import { ClipboardIcon } from './icons';
import { TerminalButton } from './TerminalButton';

export interface HarnessSetupViewProps {
    /** Copy the MCP snippet for one harness. */
    readonly onCopy: (harness: HarnessId) => void;
    /** Show a confirmation or a failure as a toast. */
    readonly onNotice: (message: string) => void;
}

/** Glyph that shows a scope button's state without colour alone. */
const STATE_GLYPH: Record<HarnessConfigState, string> = {
    installed: '✓',
    stale: '↻',
    absent: '+',
    unsupported: '–',
    error: '!',
};

/**
 * Human text for the scope button's tooltip.
 *
 * @param state - What the config file currently says.
 * @param path - Absolute config file, when there is one.
 * @param detail - Why the scope is unavailable.
 * @returns Sentence describing what clicking would do.
 */
function scopeTitle(
    state: HarnessConfigState,
    path: string | null,
    detail: string | undefined,
): string {
    if (state === 'unsupported') {
        return detail ?? 'This harness has no such config file.';
    }
    const file = path ?? 'this config file';
    switch (state) {
        case 'installed':
            return `Remove navita's MCP server from ${file}`;
        case 'stale':
            return `Update the entry in ${file} — it points at a different install`;
        case 'error':
            return detail ?? `Cannot read ${file}`;
        case 'absent':
        default:
            return `Add navita's MCP server to ${file}`;
    }
}

interface ScopeButtonProps {
    /** Scope this button edits. */
    readonly scope: HarnessScope;
    /** Current state of that scope's config file. */
    readonly status: HarnessConfigStatus | undefined;
    /** True while a write for this harness and scope is in flight. */
    readonly busy: boolean;
    /** Add or remove the entry. */
    readonly onToggle: (scope: HarnessScope, install: boolean) => void;
}

/**
 * One scope's install toggle: `+` writes the entry, `✓` removes it.
 * @param props - Component properties.
 * @returns The scope button.
 */
function ScopeButton(props: ScopeButtonProps): JSX.Element {
    const { scope, status, busy, onToggle } = props;
    const state = status?.state ?? 'unsupported';
    const disabled = busy || state === 'unsupported';
    const label = scope === 'workspace' ? 'Workspace' : 'Global';
    const base = scopeTitle(state, status?.path ?? null, status?.detail);
    const title = status?.warning === undefined ? base : `${base} — ${status.warning}`;
    return (
        <button
            type="button"
            className="scope-button"
            data-state={state}
            aria-pressed={state === 'installed'}
            aria-label={`${label} config: ${title}`}
            title={title}
            disabled={disabled}
            onClick={() => {
                onToggle(scope, state !== 'installed');
            }}
        >
            <span className="scope-glyph" aria-hidden="true">
                {busy ? '…' : STATE_GLYPH[state]}
            </span>
            {label}
        </button>
    );
}

/**
 * Snippets that point a harness at the MCP server navita ships.
 *
 * Each row offers three things: the two config files navita can write for that
 * harness (this workspace and the user's own), starting the harness in a
 * terminal on this workspace, and the snippet for harnesses navita cannot
 * configure itself.
 * @param props - Component properties.
 * @returns The harness setup pane.
 */
export function HarnessSetupView(props: HarnessSetupViewProps): JSX.Element {
    const { onCopy, onNotice } = props;
    const [launches, setLaunches] = useState<readonly HarnessLaunch[]>([]);
    const [statuses, setStatuses] = useState<readonly HarnessConfigStatus[]>([]);
    const [pending, setPending] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        window.navita
            .getHarnessLaunches()
            .then((result) => {
                if (!cancelled) {
                    setLaunches(result);
                }
            })
            .catch(() => {
                // Not knowing what is installed only hides the launcher buttons;
                // copying a snippet must keep working either way.
                if (!cancelled) {
                    setLaunches([]);
                }
            });
        window.navita
            .getHarnessConfigs()
            .then((result) => {
                if (!cancelled) {
                    setStatuses(result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatuses([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggle = useCallback(
        (harness: HarnessId, scope: HarnessScope, install: boolean) => {
            setPending(`${harness}:${scope}`);
            window.navita
                .setHarnessConfig(harness, scope, install)
                .then((result) => {
                    setStatuses(result.statuses);
                    const name = HARNESSES.find((entry) => entry.id === harness)?.label ?? harness;
                    const where = scope === 'workspace' ? 'workspace' : 'user';
                    if (result.change !== undefined) {
                        const verb =
                            result.change.action === 'removed'
                                ? 'Removed the ansible server from'
                                : result.change.action === 'updated'
                                  ? 'Updated the ansible server in'
                                  : 'Added the ansible server to';
                        onNotice(`${verb} ${name}'s ${where} config.`);
                    }
                    if (result.error !== undefined) {
                        onNotice(result.error);
                    }
                })
                .catch((error: unknown) => {
                    onNotice(error instanceof Error ? error.message : String(error));
                })
                .finally(() => {
                    setPending(null);
                });
        },
        [onNotice],
    );

    return (
        <section className="card">
            <h2>Harness setup</h2>
            <p className="muted">
                navita ships the MCP server. Write it into a harness config here, or paste the
                snippet when navita cannot write that file. Written configs follow the
                harness&apos;s working directory, so moving a project does not break them.
            </p>
            <ul className="item-list">
                {HARNESSES.map((harness) => {
                    const launch = launches.find((entry) => entry.id === harness.id);
                    const bin = harness.argv[0];
                    const workspaceStatus = statuses.find(
                        (entry) => entry.harness === harness.id && entry.scope === 'workspace',
                    );
                    const globalStatus = statuses.find(
                        (entry) => entry.harness === harness.id && entry.scope === 'global',
                    );
                    return (
                        <li key={harness.id} className="item-row">
                            <div className="item-main">
                                <span className="item-title">{harness.label}</span>
                                <span className="item-subline">
                                    <span className="item-description">{harness.configPath}</span>
                                    {workspaceStatus?.warning === undefined ? null : (
                                        <span
                                            className="item-tag warn"
                                            title={workspaceStatus.warning}
                                        >
                                            needs trust
                                        </span>
                                    )}
                                </span>
                            </div>
                            <ScopeButton
                                scope="workspace"
                                status={workspaceStatus}
                                busy={pending === `${harness.id}:workspace`}
                                onToggle={(scope, install) => {
                                    toggle(harness.id, scope, install);
                                }}
                            />
                            <ScopeButton
                                scope="global"
                                status={globalStatus}
                                busy={pending === `${harness.id}:global`}
                                onToggle={(scope, install) => {
                                    toggle(harness.id, scope, install);
                                }}
                            />
                            {launch === undefined ? null : launch.detected ? (
                                <TerminalButton
                                    label={harness.label}
                                    title={harness.action}
                                    success={`${harness.action}.`}
                                    open={() => window.navita.openTerminal({ argv: launch.argv })}
                                    onNotice={onNotice}
                                />
                            ) : (
                                <span
                                    className="item-tag"
                                    title={`${bin} is not on PATH, so navita cannot start it.`}
                                >
                                    no {bin}
                                </span>
                            )}
                            <button
                                type="button"
                                className="icon-button"
                                title="Copy MCP snippet"
                                aria-label={`Copy MCP snippet for ${harness.label}`}
                                onClick={() => {
                                    onCopy(harness.id);
                                }}
                            >
                                <ClipboardIcon />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
