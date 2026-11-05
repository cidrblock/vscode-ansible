import { describe, expect, it } from 'vitest';

import {
    collectionCrumb,
    parseCollectionTrail,
    pluginCrumb,
    pluginTypeCrumb,
} from '../src/renderer/collectionPath';

describe('collectionPath', () => {
    it('builds a trail from a collection down to a plugin', () => {
        const trail = [
            collectionCrumb('ansible.builtin'),
            pluginTypeCrumb('ansible.builtin', 'module'),
            pluginCrumb('ansible.builtin.copy', 'module'),
        ];

        expect(trail.map((crumb) => crumb.label)).toEqual(['ansible.builtin', 'module', 'copy']);
        expect(parseCollectionTrail(trail)).toEqual({
            collection: 'ansible.builtin',
            pluginType: 'module',
            plugin: 'ansible.builtin.copy',
        });
    });

    it('reads the root when the trail is empty', () => {
        expect(parseCollectionTrail([])).toEqual({});
    });

    it('reports only the levels the trail reached', () => {
        expect(parseCollectionTrail([collectionCrumb('community.general')])).toEqual({
            collection: 'community.general',
        });
        expect(
            parseCollectionTrail([
                collectionCrumb('community.general'),
                pluginTypeCrumb('community.general', 'lookup'),
            ]),
        ).toEqual({ collection: 'community.general', pluginType: 'lookup' });
    });

    it('uses the deepest crumb after a breadcrumb jump back', () => {
        const trail = [
            collectionCrumb('community.general'),
            pluginTypeCrumb('community.general', 'lookup'),
            collectionCrumb('ansible.posix'),
        ];

        expect(parseCollectionTrail(trail)).toEqual({ collection: 'ansible.posix' });
    });

    it('ignores source crumbs so the same ids work from Collection Sources', () => {
        const trail = [
            { id: 'galaxy', label: 'Galaxy' },
            collectionCrumb('community.general'),
            pluginTypeCrumb('community.general', 'module'),
        ];

        expect(parseCollectionTrail(trail)).toEqual({
            collection: 'community.general',
            pluginType: 'module',
        });
    });

    it('ignores an organization crumb', () => {
        const trail = [{ id: 'github:ansible-collections', label: 'ansible-collections' }];

        expect(parseCollectionTrail(trail)).toEqual({});
    });
});
