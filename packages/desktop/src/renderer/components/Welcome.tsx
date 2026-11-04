import type { JSX } from 'react';

import type { WorkspaceEntry } from '../../shared/ipc';

export interface WelcomeProps {
    recents: readonly WorkspaceEntry[];
    onOpen: () => void;
    onActivate: (workspacePath: string) => void;
}

/**
 * First-run screen shown when no workspace is open.
 * @param props - Component properties.
 * @param props.recents - Recently opened workspaces, most recent first.
 * @param props.onOpen - Opens the native directory picker.
 * @param props.onActivate - Opens the workspace at the given path.
 * @returns The welcome element.
 */
export function Welcome(props: WelcomeProps): JSX.Element {
    const { recents, onOpen, onActivate } = props;
    return (
        <div className="welcome">
            <h1>navita</h1>
            <p className="muted">
                Pick an Ansible project to inspect its environments, collections and skills.
            </p>
            <button className="primary" onClick={onOpen}>
                Open Workspace…
            </button>
            {recents.length > 0 && (
                <div className="recents">
                    <h2>Recent</h2>
                    <ul>
                        {recents.map((recent) => (
                            <li key={recent.path}>
                                <button
                                    className="link"
                                    onClick={() => {
                                        onActivate(recent.path);
                                    }}
                                >
                                    <span>{recent.name}</span>
                                    <span className="chip-path">{recent.path}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
