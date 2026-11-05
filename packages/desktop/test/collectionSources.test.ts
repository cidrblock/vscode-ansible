import { describe, expect, it } from 'vitest';

import { toGalaxyEntries } from '../src/main/collectionSources';

describe('toGalaxyEntries', () => {
    it('joins namespace and name into a fully qualified name', () => {
        const entries = toGalaxyEntries([
            {
                namespace: 'ansible',
                name: 'utils',
                version: '5.1.0',
                deprecated: false,
                downloadCount: 1234,
            },
        ]);

        expect(entries[0].name).toBe('ansible.utils');
        expect(entries[0].version).toBe('5.1.0');
        expect(entries[0].downloadCount).toBe(1234);
        expect(entries[0].deprecated).toBe(false);
    });

    it('attaches the collection summary prompt', () => {
        const entries = toGalaxyEntries([
            {
                namespace: 'cisco',
                name: 'nxos',
                version: '9.0.0',
                deprecated: true,
                downloadCount: 5,
            },
        ]);

        expect(entries[0].prompt).toContain('Collection: cisco.nxos');
        expect(entries[0].deprecated).toBe(true);
    });

    it('handles an empty catalog', () => {
        expect(toGalaxyEntries([])).toEqual([]);
    });
});
