import { describe, expect, it } from 'vitest';

import type { SkillRegistry } from '@ansible/developer-services';

import { buildSkillGroups, buildSkillSources, describeSkillSources } from '../src/main/skills';

const base = {
    module: 'sdlc',
    description: 'Does a thing',
    prompt: 'Use the skill',
};

describe('buildSkillSources', () => {
    it('puts the bundled directory first and keeps the configured order', () => {
        const sources = buildSkillSources('/opt/navita/dist/skills', [
            {
                id: 'ai-forge',
                type: 'github',
                url: 'https://github.com/acme/skills',
                trust: 'community',
            },
            { id: 'team', type: 'local', url: '/srv/skills', trust: 'private', refreshInterval: 6 },
        ]);
        expect(sources.map((source) => source.id)).toEqual(['bundled', 'ai-forge', 'team']);
        expect(sources[2]).toEqual({
            id: 'team',
            type: 'local',
            url: '/srv/skills',
            trust: 'private',
            refreshInterval: 6,
        });
    });

    it('still loads the bundled directory with nothing configured', () => {
        expect(buildSkillSources('/opt/navita/dist/skills')).toEqual([
            { id: 'bundled', type: 'local', url: '/opt/navita/dist/skills', trust: 'certified' },
        ]);
    });
});

describe('buildSkillGroups', () => {
    it('groups skills by source in first-seen order', () => {
        const groups = buildSkillGroups([
            { ...base, id: 'bundled/sdlc/commit', name: 'commit', source: 'bundled' },
            { ...base, id: 'user/sdlc/lint', name: 'lint', source: 'user' },
            { ...base, id: 'bundled/sdlc/review', name: 'review', source: 'bundled' },
        ]);

        expect(groups.map((group) => group.id)).toEqual(['bundled', 'user']);
        expect(groups[0]?.skills.map((skill) => skill.name)).toEqual(['commit', 'review']);
    });

    it('returns no groups when no skills loaded', () => {
        expect(buildSkillGroups([])).toEqual([]);
    });
});

describe('describeSkillSources', () => {
    const fakeRegistry = (ids: readonly string[], skills: readonly { source: string }[]) =>
        ({
            getAllSkills: () => skills,
            getSources: () =>
                ids.map((id) => ({ id, type: 'local', url: `/src/${id}`, trust: 'community' })),
            getSourceError: () => undefined,
        }) as unknown as SkillRegistry;

    it('hides the bundled directory once it duplicates the built-in copy', () => {
        const statuses = describeSkillSources(
            fakeRegistry(
                ['builtin', 'bundled', 'ai-forge'],
                [{ source: 'builtin' }, { source: 'ai-forge' }],
            ),
        );

        expect(statuses.map((source) => source.id)).toEqual(['builtin', 'ai-forge']);
    });

    it('keeps a configured source that returned nothing', () => {
        const statuses = describeSkillSources(
            fakeRegistry(['builtin', 'bundled', 'team'], [{ source: 'builtin' }]),
        );

        expect(statuses.map((source) => [source.id, source.count])).toEqual([
            ['builtin', 1],
            ['team', 0],
        ]);
    });

    it('keeps bundled when it does contribute a skill of its own', () => {
        const statuses = describeSkillSources(
            fakeRegistry(['builtin', 'bundled'], [{ source: 'builtin' }, { source: 'bundled' }]),
        );

        expect(statuses.map((source) => source.id)).toEqual(['builtin', 'bundled']);
    });
});
