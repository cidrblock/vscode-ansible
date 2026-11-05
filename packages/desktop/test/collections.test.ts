import { describe, expect, it } from 'vitest';

import {
    loadCollectionPlugins,
    loadCollections,
    MISSING_ANSIBLE_DOC,
    toCollectionEntries,
} from '../src/main/collections';

const collection = (
    name: string,
    version: string,
    plugins: number,
): {
    info: { name: string; version: string; authors: string[]; description: string; path?: string };
    pluginTypes: Map<string, { name: string; fullName: string; shortDescription: string }[]>;
} => ({
    info: {
        name,
        version,
        authors: ['Ansible'],
        description: name === 'ansible.builtin' ? 'Core modules' : '',
    },
    pluginTypes: new Map([
        [
            'module',
            Array.from({ length: plugins }, (_value, index) => ({
                name: `plugin_${String(index)}`,
                fullName: `${name}.plugin_${String(index)}`,
                shortDescription: 'A plugin',
            })),
        ],
    ]),
});

describe('toCollectionEntries', () => {
    it('sorts collections by name and counts plugins', () => {
        const entries = toCollectionEntries([
            collection('ansible.posix', '2.0.0', 3),
            collection('ansible.builtin', '2.22.0', 5),
        ]);

        expect(entries.map((entry) => entry.name)).toEqual(['ansible.builtin', 'ansible.posix']);
        expect(entries.map((entry) => entry.pluginCount)).toEqual([5, 3]);
    });

    it('keeps versions and drops empty descriptions', () => {
        const entries = toCollectionEntries([
            collection('ansible.builtin', '2.22.0', 1),
            collection('ansible.posix', '2.0.0', 1),
        ]);

        expect(entries[0]).toMatchObject({ version: '2.22.0', description: 'Core modules' });
        expect(entries[1]).not.toHaveProperty('description');
    });

    it('returns an empty list when nothing is installed', () => {
        expect(toCollectionEntries([])).toEqual([]);
    });

    it('reports plugin types with their counts, ordered by name', () => {
        const entries = toCollectionEntries([
            {
                info: {
                    name: 'ansible.builtin',
                    version: '2.22.0',
                    authors: ['Ansible'],
                    description: 'Core modules',
                },
                pluginTypes: new Map([
                    [
                        'module',
                        [{ name: 'copy', fullName: 'ansible.builtin.copy', shortDescription: 'd' }],
                    ],
                    [
                        'filter',
                        [
                            {
                                name: 'b64decode',
                                fullName: 'ansible.builtin.b64decode',
                                shortDescription: 'd',
                            },
                        ],
                    ],
                    [
                        'test',
                        [
                            {
                                name: 'match',
                                fullName: 'ansible.builtin.match',
                                shortDescription: 'd',
                            },
                            {
                                name: 'search',
                                fullName: 'ansible.builtin.search',
                                shortDescription: 'd',
                            },
                        ],
                    ],
                ]),
            },
        ]);

        expect(entries[0].pluginTypes).toEqual([
            { type: 'filter', count: 1 },
            { type: 'module', count: 1 },
            { type: 'test', count: 2 },
        ]);
    });
});

describe('loadCollections', () => {
    it('reports a missing ansible-doc instead of loading empty data', async () => {
        const result = await loadCollections(() => Promise.resolve(null));

        expect(result.state).toBe('error');
        expect(result.collections).toEqual([]);
        expect(result.detail).toBe(MISSING_ANSIBLE_DOC);
    });
});

describe('loadCollectionPlugins', () => {
    it('reports an error instead of an empty list when the collection is not loaded', () => {
        const result = loadCollectionPlugins('no.such', 'module');

        expect(result.state).toBe('error');
        expect(result.plugins).toEqual([]);
        expect(result.detail).toContain('no.such');
    });
});
