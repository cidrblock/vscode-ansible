import { useCallback, useEffect, useState, type JSX } from 'react';

import {
    SECTION_GROUPS,
    type Section,
    type SectionGroupId,
    type SectionId,
} from '../../shared/ipc';

export interface SidebarProps {
    sections: readonly Section[];
    activeSection: SectionId;
    onSelect: (section: SectionId) => void;
}

/** Renderer storage key for collapsed sidebar groups. */
const STORAGE_KEY = 'navita.sidebar.groups';

/**
 * Read the groups the user collapsed in a previous session.
 * @returns Group ids to start collapsed, ignoring missing or malformed storage.
 */
function readCollapsed(): ReadonlySet<SectionGroupId> {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return new Set();
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return new Set();
        }
        return new Set(
            parsed.filter((value): value is SectionGroupId =>
                SECTION_GROUPS.some((group) => group.id === value),
            ),
        );
    } catch {
        return new Set();
    }
}

/**
 * Persist the collapsed groups for the next launch.
 * @param collapsed - Group ids currently collapsed.
 */
function persistCollapsed(collapsed: ReadonlySet<SectionGroupId>): void {
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
 * @param props - Component properties.
 * @param props.sections - Sections to render, in display order.
 * @param props.activeSection - Section currently shown in the pane.
 * @param props.onSelect - Called with the section the user clicked.
 * @returns The sidebar navigation element.
 */
export function Sidebar(props: SidebarProps): JSX.Element {
    const { sections, activeSection, onSelect } = props;
    const [collapsed, setCollapsed] = useState<ReadonlySet<SectionGroupId>>(readCollapsed);

    const toggleGroup = useCallback((group: SectionGroupId) => {
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

    return (
        <nav className="sidebar" aria-label="Ansible views">
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
