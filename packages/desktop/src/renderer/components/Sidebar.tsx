import type { JSX } from 'react';

import type { Section, SectionId } from '../../shared/ipc';

export interface SidebarProps {
    sections: readonly Section[];
    activeSection: SectionId;
    onSelect: (section: SectionId) => void;
}

/**
 * Accordion of the Ansible views the extension contributes.
 * @param props - Component properties.
 * @param props.sections - Sections to render, in display order.
 * @param props.activeSection - Section currently expanded.
 * @param props.onSelect - Called with the section the user clicked.
 * @returns The sidebar navigation element.
 */
export function Sidebar(props: SidebarProps): JSX.Element {
    const { sections, activeSection, onSelect } = props;
    return (
        <nav className="sidebar" aria-label="Ansible views">
            {sections.map((section) => {
                const active = section.id === activeSection;
                return (
                    <div key={section.id} className={active ? 'section section-active' : 'section'}>
                        <button
                            className="section-header"
                            aria-expanded={active}
                            onClick={() => {
                                onSelect(section.id);
                            }}
                        >
                            <span className="caret">{active ? '▾' : '▸'}</span>
                            {section.label}
                        </button>
                        {active && (
                            <div className="section-body">
                                <p className="muted">Ports {section.sourceView}</p>
                                <p className="muted">View not wired up yet.</p>
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
