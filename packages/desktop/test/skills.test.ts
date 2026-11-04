import { describe, expect, it } from 'vitest';

import { buildSkillGroups } from '../src/main/skills';

const base = {
    module: 'sdlc',
    description: 'Does a thing',
    prompt: 'Use the skill',
};

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
