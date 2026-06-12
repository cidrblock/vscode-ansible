import React from 'react';
import { SectionList } from '../components/SectionList';
import type { SectionDef } from '../components/SectionList';

const ROOT_SECTIONS: SectionDef[] = [
    { id: 'projects', label: 'Projects' },
    { id: 'platform', label: 'Platform' },
    { id: 'ee', label: 'Execution Environments' },
    { id: 'settings', label: 'Settings' },
];

interface RootNavProps {
    selected: string | null;
    onSelect: (id: string) => void;
}

export function RootNav({ selected, onSelect }: RootNavProps): React.JSX.Element {
    return <SectionList sections={ROOT_SECTIONS} activeId={selected} onSelect={onSelect} />;
}
