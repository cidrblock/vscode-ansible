import { describe, expect, it } from 'vitest';

import {
    normalizeWorkspacePath,
    pushRecent,
    toWorkspaceEntry,
    workspaceName,
    MAX_RECENTS,
} from '../src/main/workspaces';

describe('normalizeWorkspacePath', () => {
    it('resolves relative paths and strips trailing separators', () => {
        const normalized = normalizeWorkspacePath('/tmp/project/');
        expect(normalized).toBe('/tmp/project');
    });

    it('keeps the filesystem root intact', () => {
        expect(normalizeWorkspacePath('/')).toBe('/');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeWorkspacePath('  /tmp/project  ')).toBe('/tmp/project');
    });
});

describe('workspaceName', () => {
    it('uses the final path segment', () => {
        expect(workspaceName('/home/dev/ansible-playbooks')).toBe('ansible-playbooks');
    });

    it('falls back to the path when there is no basename', () => {
        expect(workspaceName('/')).toBe('/');
    });
});

describe('pushRecent', () => {
    const entry = (name: string, openedAt: number) => toWorkspaceEntry(`/tmp/${name}`, openedAt);

    it('puts the newest entry first', () => {
        const recents = pushRecent([entry('one', 1)], entry('two', 2));
        expect(recents.map((recent) => recent.name)).toEqual(['two', 'one']);
    });

    it('moves an existing entry to the front instead of duplicating it', () => {
        const recents = pushRecent([entry('one', 1), entry('two', 2)], entry('one', 3));
        expect(recents.map((recent) => recent.name)).toEqual(['one', 'two']);
    });

    it('caps the list', () => {
        const existing = Array.from({ length: MAX_RECENTS }, (_, index) =>
            entry(`p${String(index)}`, index),
        );
        const recents = pushRecent(existing, entry('newest', 99));
        expect(recents).toHaveLength(MAX_RECENTS);
        expect(recents[0].name).toBe('newest');
    });
});
