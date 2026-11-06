import { afterEach, describe, expect, it } from 'vitest';

import {
    resolveGitHubToken,
    toGalaxyEntries,
    toGitHubEntries,
} from '../src/main/collectionSources';

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

describe('toGitHubEntries', () => {
    it('keeps the repository metadata and attaches the summary prompt', () => {
        const entries = toGitHubEntries([
            {
                namespace: 'community',
                name: 'general',
                version: '12.0.0',
                description: 'A collection of modules.',
                repository: 'ansible-collections/community.general',
                org: 'ansible-collections',
                htmlUrl: 'https://github.com/ansible-collections/community.general',
                installUrl: 'git+https://github.com/ansible-collections/community.general.git',
            },
        ]);

        expect(entries[0].name).toBe('community.general');
        expect(entries[0].description).toBe('A collection of modules.');
        expect(entries[0].htmlUrl).toContain('community.general');
        expect(entries[0].installUrl).toBe(
            'git+https://github.com/ansible-collections/community.general.git',
        );
        expect(entries[0].prompt).toContain('Collection: community.general');
    });

    it('carries a spec ade install accepts for every repository', () => {
        const [entry] = toGitHubEntries([
            {
                namespace: 'ansible',
                name: 'posix',
                version: '2.1.0',
                description: '',
                repository: 'ansible-collections/ansible.posix',
                org: 'ansible-collections',
                htmlUrl: 'https://github.com/ansible-collections/ansible.posix',
                installUrl: 'git+https://github.com/ansible-collections/ansible.posix.git',
            },
        ]);
        expect(entry.installUrl.startsWith('git+https://')).toBe(true);
    });

    it('handles an organization with no cached collections', () => {
        expect(toGitHubEntries([])).toEqual([]);
    });
});

describe('resolveGitHubToken', () => {
    const saved = process.env.GH_TOKEN;

    afterEach(() => {
        if (saved === undefined) {
            delete process.env.GH_TOKEN;
        } else {
            process.env.GH_TOKEN = saved;
        }
    });

    it('prefers GH_TOKEN from the environment over any stored credential', async () => {
        process.env.GH_TOKEN = 'env-token';
        await expect(resolveGitHubToken()).resolves.toBe('env-token');
    });
});
