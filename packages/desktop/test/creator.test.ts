import { describe, expect, it } from 'vitest';

import type { SchemaNode } from '@ansible/common';

import { findSchemaNode } from '../src/main/creator';

const schema: SchemaNode = {
    name: 'ansible-creator',
    subcommands: {
        init: {
            name: 'init',
            subcommands: {
                collection: {
                    name: 'collection',
                    parameters: {
                        type: 'object',
                        properties: { collection: { type: 'string', description: 'Name' } },
                        required: ['collection'],
                    },
                },
            },
        },
    },
};

describe('findSchemaNode', () => {
    it('walks to the leaf the catalog row names', () => {
        expect(findSchemaNode(schema, ['init', 'collection'])?.name).toBe('collection');
    });

    it('returns the root for an empty path', () => {
        expect(findSchemaNode(schema, [])).toBe(schema);
    });

    it('returns undefined for a path the schema does not have', () => {
        expect(findSchemaNode(schema, ['init', 'playbook'])).toBeUndefined();
    });
});
