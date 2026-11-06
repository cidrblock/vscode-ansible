import { describe, expect, it } from 'vitest';

import {
    DEFAULT_GITHUB_ORGS,
    DEFAULT_SETTINGS,
    MAX_GITHUB_ORGS,
    mergeSettings,
    normalizeOrgs,
    normalizeSettings,
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
