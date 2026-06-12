import React from 'react';
import { navItem, navItemActive, navLabel, navMeta, navList } from '../styles/navStyles';

export interface SectionDef {
    id: string;
    label: string;
    badge?: string;
}

interface SectionListProps {
    sections: SectionDef[];
    activeId: string | null;
    onSelect: (id: string) => void;
}

export function SectionList({ sections, activeId, onSelect }: SectionListProps): React.JSX.Element {
    return (
        <div style={navList}>
            {sections.map((s) => (
                <button
                    key={s.id}
                    style={{
                        ...navItem,
                        ...(activeId === s.id ? navItemActive : {}),
                    }}
                    onClick={() => onSelect(s.id)}
                >
                    <span style={navLabel}>{s.label}</span>
                    {s.badge && <span style={navMeta}>{s.badge}</span>}
                </button>
            ))}
        </div>
    );
}
