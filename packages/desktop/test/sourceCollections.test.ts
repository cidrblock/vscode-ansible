import { describe, expect, it } from 'vitest';

import { toSourceTypes } from '../src/main/sourceCollections';

describe('toSourceTypes', () => {
    it('orders plugin types and attaches an explanation prompt per row', () => {
        const types = toSourceTypes({
            module: [
                {
                    name: 'acl',
                    fullName: 'ansible.posix.acl',
                    shortDescription: 'Set and retrieve file ACL information.',
                },
            ],
            action: [{ name: 'mount', fullName: 'ansible.posix.mount', shortDescription: 'Mount' }],
        });

        expect(types.map((group) => group.type)).toEqual(['action', 'module']);
        expect(types[1].plugins[0]).toMatchObject({
            name: 'acl',
            fullName: 'ansible.posix.acl',
            shortDescription: 'Set and retrieve file ACL information.',
        });
        expect(types[1].plugins[0].prompt).toContain('ansible.posix.acl');
    });

    it('returns no groups for an empty docs blob', () => {
        expect(toSourceTypes({})).toEqual([]);
    });
});
