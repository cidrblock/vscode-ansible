import { describe, expect, it } from 'vitest';

import { buildToolGroups } from '../src/main/tools';

describe('buildToolGroups', () => {
    it('groups tools into the shared categories in display order', () => {
        const groups = buildToolGroups([
            { name: 'search_ansible_plugins', description: 'Search installed plugins' },
            { name: 'generate_ansible_tasks', description: 'Generate tasks for a play' },
            { name: 'get_agent_onboarding', description: 'Onboarding help' },
        ]);

        expect(groups.map((group) => group.id)).toEqual([
            'getting_started',
            'discovery',
            'generation',
        ]);
        expect(groups.map((group) => group.label)).toEqual([
            'Getting Started',
            'Discovery',
            'Task Generation',
        ]);
    });

    it('keeps every tool in exactly one group', () => {
        const groups = buildToolGroups([
            { name: 'list_ansible_collections' },
            { name: 'list_source_collections' },
            { name: 'ee_validate' },
        ]);
        const names = groups.flatMap((group) => group.tools.map((tool) => tool.name));

        expect(names).toHaveLength(3);
        expect(new Set(names).size).toBe(3);
        expect(groups.find((group) => group.id === 'execution')?.tools[0]?.name).toBe(
            'ee_validate',
        );
    });

    it('builds a copyable prompt for each tool, even without a description', () => {
        const groups = buildToolGroups([{ name: 'skill_list' }]);
        const prompt = groups[0]?.tools[0]?.prompt ?? '';

        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt).toContain('skill_list');
    });

    it('omits empty descriptions from the renderer model', () => {
        const groups = buildToolGroups([{ name: 'skill_list' }]);

        expect(groups[0]?.tools[0]).not.toHaveProperty('description');
    });

    it('drops categories that have no tools', () => {
        const groups = buildToolGroups([{ name: 'get_agent_onboarding' }]);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.id).toBe('getting_started');
    });
});
