import { useCallback, useEffect, useState, type JSX } from 'react';

import {
    SECTION_GROUPS,
    type Section,
    type SectionId,
    type WorkspaceEntry,
} from '../../shared/ipc';

export interface SidebarProps {
    sections: readonly Section[];
    activeSection: SectionId;
    onSelect: (section: SectionId) => void;
    workspace: WorkspaceEntry | null;
    recents: readonly WorkspaceEntry[];
    onOpenWorkspace: () => void;
    onActivateWorkspace: (workspacePath: string) => void;
    onRescanWorkspace: () => void;
}

/** Renderer storage key for collapsed sidebar groups. */
const STORAGE_KEY = 'navita.sidebar.groups';

/** Group id of the workspace switcher, which is not a section. */
const WORKSPACE_GROUP = 'workspace';

/**
 * Every group the sidebar can collapse, workspace switcher included.
 * @returns Group ids accepted from storage.
 */
function groupIds(): readonly string[] {
    return [WORKSPACE_GROUP, ...SECTION_GROUPS.map((group) => group.id)];
}

/**
 * Read the groups the user collapsed in a previous session.
 * @returns Group ids to start collapsed, ignoring missing or malformed storage.
 */
function readCollapsed(): ReadonlySet<string> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return new Set();
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return new Set();
        }
        const known = groupIds();
        return new Set(parsed.filter((value): value is string => known.includes(String(value))));
    } catch {
        return new Set();
    }
}

/**
 * Persist the collapsed groups for the next launch.
 * @param collapsed - Group ids currently collapsed.
 */
function persistCollapsed(collapsed: ReadonlySet<string>): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
    } catch {
        // Losing the preference is preferable to breaking navigation.
    }
}

/**
 * Accordion of the Ansible views the extension contributes.
 *
 * Sections stay one click from the pane; the groups themselves collapse, which
 * is what the menu-driven navigation expands when it selects a hidden section.
 * The workspace switcher is a group of its own: it replaces the workspace, so
 * it belongs beside the views rather than above them.
 * @param props - Component properties.
 * @returns The sidebar navigation element.
 */
export function Sidebar(props: SidebarProps): JSX.Element {
    const {
        sections,
        activeSection,
        onSelect,
        workspace,
        recents,
        onOpenWorkspace,
        onActivateWorkspace,
        onRescanWorkspace,
    } = props;
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(readCollapsed);

    const toggleGroup = useCallback((group: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(group)) {
                next.delete(group);
            } else {
                next.add(group);
            }
            persistCollapsed(next);
            return next;
        });
    }, []);

    useEffect(() => {
        const group = sections.find((section) => section.id === activeSection)?.group;
        if (group === undefined) {
            return;
        }
        setCollapsed((current) => {
            if (!current.has(group)) {
                return current;
            }
            const next = new Set(current);
            next.delete(group);
            persistCollapsed(next);
            return next;
        });
    }, [activeSection, sections]);

    const workspaceOpen = !collapsed.has(WORKSPACE_GROUP);

    return (
        <nav className="sidebar" aria-label="Ansible views">
            {sections
                .filter((section) => section.group === 'home')
                .map((section) => (
                    <button
                        key={section.id}
                        className={
                            section.id === activeSection
                                ? 'nav-item nav-home nav-item-active'
                                : 'nav-item nav-home'
                        }
                        aria-current={section.id === activeSection ? 'page' : undefined}
                        onClick={() => {
                            onSelect(section.id);
                        }}
                    >
                        {section.label}
                    </button>
                ))}
            <div className="nav-group">
                <button
                    className="nav-group-header"
                    aria-expanded={workspaceOpen}
                    aria-controls="nav-group-workspace"
                    onClick={() => {
                        toggleGroup(WORKSPACE_GROUP);
                    }}
                >
                    <span className="caret" aria-hidden="true">
                        {workspaceOpen ? '▾' : '▸'}
                    </span>
                    Workspace
                </button>
                {workspaceOpen && (
                    <div id="nav-group-workspace">
                        {recents.length === 0 ? (
                            <p className="nav-empty">No recent workspaces.</p>
                        ) : (
                            <div
                                className="nav-workspaces"
                                role="radiogroup"
                                aria-label="Workspaces"
                            >
                                {recents.map((recent) => {
                                    const current = recent.path === workspace?.path;
                                    return (
                                        <button
                                            key={recent.path}
                                            role="radio"
                                            aria-checked={current}
                                            className={
                                                current
                                                    ? 'nav-workspace nav-workspace-current'
                                                    : 'nav-workspace'
                                            }
                                            title={recent.path}
                                            disabled={current}
                                            onClick={() => {
                                                onActivateWorkspace(recent.path);
                                            }}
                                        >
                                            <span className="nav-check" aria-hidden="true">
                                                {current ? '●' : '○'}
                                            </span>
                                            <span className="nav-workspace-body">
                                                <span className="nav-workspace-name">
                                                    {recent.name}
                                                </span>
                                                <span className="nav-workspace-path">
                                                    {recent.path}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        <button
                            className="nav-action"
                            onClick={() => {
                                onOpenWorkspace();
                            }}
                        >
                            Open Workspace…
                            <span className="nav-shortcut">Ctrl+O</span>
                        </button>
                        {workspace !== null && (
                            <button
                                className="nav-action"
                                onClick={() => {
                                    onRescanWorkspace();
                                }}
                            >
                                Rescan Workspace
                                <span className="nav-shortcut">Ctrl+R</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {SECTION_GROUPS.map((group) => {
                const grouped = sections.filter((section) => section.group === group.id);
                if (grouped.length === 0) {
                    return null;
                }
                const open = !collapsed.has(group.id);
                return (
                    <div className="nav-group" key={group.id}>
                        <button
                            className="nav-group-header"
                            aria-expanded={open}
                            aria-controls={`nav-group-${group.id}`}
                            onClick={() => {
                                toggleGroup(group.id);
                            }}
                        >
                            <span className="caret" aria-hidden="true">
                                {open ? '▾' : '▸'}
                            </span>
                            {group.label}
                        </button>
                        {open && (
                            <ul className="nav-list" id={`nav-group-${group.id}`}>
                                {grouped.map((section) => (
                                    <li key={section.id}>
                                        <button
                                            className={
                                                section.id === activeSection
                                                    ? 'nav-item nav-item-active'
                                                    : 'nav-item'
                                            }
                                            aria-current={
                                                section.id === activeSection ? 'page' : undefined
                                            }
                                            title={section.sourceView}
                                            onClick={() => {
                                                onSelect(section.id);
                                            }}
                                        >
                                            {section.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
