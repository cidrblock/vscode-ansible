import { describe, expect, it } from 'vitest';

import {
    DEFAULT_GITHUB_ORGS,
    DEFAULT_SETTINGS,
    DEFAULT_SKILL_SOURCES,
    MAX_GITHUB_ORGS,
    MAX_SKILL_SOURCES,
    mergeSettings,
    normalizeOrgs,
    normalizeSettings,
    normalizeSkillSources,
} from '../src/shared/settings';

describe('normalizeOrgs', () => {
    it('trims, drops blanks and dedupes case-insensitively', () => {
        expect(normalizeOrgs([' ansible ', '', 'Ansible', 'redhat-cop'])).toEqual([
            'ansible',
            'redhat-cop',
        ]);
    });

    it('falls back to the default list when nothing usable is left', () => {
        expect(normalizeOrgs([])).toEqual([...DEFAULT_GITHUB_ORGS]);
        expect(normalizeOrgs('ansible')).toEqual([...DEFAULT_GITHUB_ORGS]);
    });

    it('caps the list so a state file cannot grow without bound', () => {
        const many = Array.from(
            { length: MAX_GITHUB_ORGS + 5 },
            (_, index) => `org${String(index)}`,
        );
        expect(normalizeOrgs(many)).toHaveLength(MAX_GITHUB_ORGS);
    });
});

describe('normalizeSkillSources', () => {
    it('keeps the extension defaults when the value is not a list', () => {
        expect(normalizeSkillSources(undefined)).toEqual([...DEFAULT_SKILL_SOURCES]);
        expect(normalizeSkillSources({ id: 'x' })).toEqual([...DEFAULT_SKILL_SOURCES]);
    });

    it('keeps an explicitly empty list', () => {
        expect(normalizeSkillSources([])).toEqual([]);
    });

    it('drops entries that could never load and dedupes ids', () => {
        const sources = normalizeSkillSources([
            { id: 'team', type: 'local', url: '/srv/skills', trust: 'private' },
            { id: 'TEAM', type: 'local', url: '/other', trust: 'private' },
            { id: '', type: 'local', url: '/blank', trust: 'private' },
            { id: 'bad-type', type: 'ftp', url: '/x', trust: 'private' },
            { id: 'bad-trust', type: 'local', url: '/x', trust: 'root' },
            { id: 'no-url', type: 'local', url: '   ', trust: 'private' },
            'nope',
        ]);
        expect(sources).toEqual([
            { id: 'team', type: 'local', url: '/srv/skills', trust: 'private' },
        ]);
    });

    it('carries a sane refresh interval and drops an absurd one', () => {
        const sources = normalizeSkillSources([
            {
                id: 'a',
                type: 'registry',
                url: 'https://example/skills.json',
                trust: 'partner',
                refreshInterval: 6,
            },
            {
                id: 'b',
                type: 'registry',
                url: 'https://example/b.json',
                trust: 'partner',
                refreshInterval: -1,
            },
        ]);
        expect(sources[0]?.refreshInterval).toBe(6);
        expect(sources[1]?.refreshInterval).toBeUndefined();
    });

    it('caps the list', () => {
        const many = Array.from({ length: MAX_SKILL_SOURCES + 3 }, (_, index) => ({
            id: `s${String(index)}`,
            type: 'local' as const,
            url: `/tmp/${String(index)}`,
            trust: 'private' as const,
        }));
        expect(normalizeSkillSources(many)).toHaveLength(MAX_SKILL_SOURCES);
    });
});

describe('normalizeSettings', () => {
    it('returns the defaults for a missing or malformed value', () => {
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
        expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    });

    it('rejects an executor the app cannot run', () => {
        expect(normalizeSettings({ playbookExecutor: 'ansible-runner' }).playbookExecutor).toBe(
            DEFAULT_SETTINGS.playbookExecutor,
        );
    });

    it('trims the navigator config path', () => {
        expect(normalizeSettings({ navigatorConfig: '  ~/nav.yml  ' }).navigatorConfig).toBe(
            '~/nav.yml',
        );
    });
});

describe('mergeSettings', () => {
    it('changes only the fields in the patch', () => {
        const merged = mergeSettings(
            { ...DEFAULT_SETTINGS, githubOrgs: ['ansible'] },
            { playbookExecutor: 'ansible-playbook' },
        );
        expect(merged.playbookExecutor).toBe('ansible-playbook');
        expect(merged.githubOrgs).toEqual(['ansible']);
    });

    it('replaces the skill source list when one is supplied', () => {
        const merged = mergeSettings(DEFAULT_SETTINGS, {
            skillSources: [{ id: 'team', type: 'local', url: '/srv/skills', trust: 'private' }],
        });
        expect(merged.skillSources).toEqual([
            { id: 'team', type: 'local', url: '/srv/skills', trust: 'private' },
        ]);
    });

    it('ignores unknown keys and invalid values', () => {
        const merged = mergeSettings(DEFAULT_SETTINGS, {
            playbookExecutor: 'rm -rf /',
            somethingElse: true,
        });
        expect(merged).toEqual(DEFAULT_SETTINGS);
    });

    it('leaves the settings untouched when the patch is not an object', () => {
        expect(mergeSettings(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
    });
});
