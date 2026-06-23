import React, { useEffect, useState } from 'react';
import { SectionList } from '../components/SectionList';
import type { SectionDef } from '../components/SectionList';
import { api } from '../api';

interface ProjectFacetsProps {
    selected: string | null;
    onSelect: (id: string) => void;
}

export function ProjectFacets({ selected, onSelect }: ProjectFacetsProps): React.JSX.Element {
    const [badges, setBadges] = useState<Record<string, string>>({});

    useEffect(() => {
        void loadBadges();
    }, []);

    const loadBadges = async () => {
        const [env, devTools, collections, playbooks, mcpStatus, skills] = await Promise.all([
            api.getEnvironmentInfo().catch(() => null),
            api.getDevToolsPackages().catch(() => []),
            api.getCollections().catch(() => []),
            api.getPlaybooks().catch(() => []),
            api.getMcpStatus().catch(() => ({ running: false, toolCount: 0 })),
            api.getSkills().catch(() => []),
        ]);
        setBadges({
            env: env?.displayName ?? env?.pythonPath ?? '',
            devtools: devTools.length > 0 ? String(devTools.length) : '',
            collections: collections.length > 0 ? String(collections.length) : '',
            playbooks: playbooks.length > 0 ? String(playbooks.length) : '',
            'ai-tools': mcpStatus.running ? String(mcpStatus.toolCount) : '',
            skills: skills.length > 0 ? String(skills.length) : '',
        });
    };

    const sections: SectionDef[] = [
        { id: 'env', label: 'Environment', badge: badges.env || undefined },
        { id: 'devtools', label: 'Dev Tools', badge: badges.devtools || undefined },
        { id: 'collections', label: 'Collections', badge: badges.collections || undefined },
        { id: 'sources', label: 'Sources' },
        { id: 'creator', label: 'Creator' },
        { id: 'playbooks', label: 'Playbooks', badge: badges.playbooks || undefined },
        { id: 'ai-tools', label: 'AI Tools', badge: badges['ai-tools'] || undefined },
        { id: 'skills', label: 'AI Skills', badge: badges.skills || undefined },
    ];

    return <SectionList sections={sections} activeId={selected} onSelect={onSelect} />;
}
