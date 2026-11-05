import { describe, expect, it } from 'vitest';

import { toPlaybookEntry } from '../src/main/playbooks';
import { groupByFolder } from '../src/shared/playbooks';
import type { PlaybookEntry } from '../src/shared/ipc';

const playbook = (relativePath: string, name = relativePath): PlaybookEntry => ({
    name,
    path: `/work/${relativePath}`,
    relativePath,
    playCount: 0,
    plays: [],
    prompt: '',
});

describe('toPlaybookEntry', () => {
    it('keeps the plays and counts them', () => {
        const entry = toPlaybookEntry({
            name: 'site',
            path: '/work/site.yml',
            relativePath: 'site.yml',
            plays: [
                { name: 'web', hosts: 'webservers', lineNumber: 1 },
                { name: 'db', hosts: 'databases', lineNumber: 12 },
            ],
        });

        expect(entry.playCount).toBe(2);
        expect(entry.plays[1]).toEqual({ name: 'db', hosts: 'databases', lineNumber: 12 });
    });

    it('carries the AI summary prompt for the playbook', () => {
        const entry = toPlaybookEntry({
            name: 'site',
            path: '/work/deploy/site.yml',
            relativePath: 'deploy/site.yml',
            plays: [],
        });

        expect(entry.prompt).toContain('Playbook: site');
        expect(entry.prompt).toContain('Path: deploy/site.yml');
    });
});

describe('groupByFolder', () => {
    it('groups by the containing folder', () => {
        const groups = groupByFolder([
            playbook('site.yml'),
            playbook('deploy/web.yml'),
            playbook('deploy/db.yml'),
        ]);

        expect(groups.map((group) => group.folder)).toEqual(['.', 'deploy']);
        expect(groups[1].playbooks.map((entry) => entry.name)).toEqual([
            'deploy/db.yml',
            'deploy/web.yml',
        ]);
    });

    it('returns nothing for an empty workspace', () => {
        expect(groupByFolder([])).toEqual([]);
    });
});
