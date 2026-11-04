import { describe, expect, it } from 'vitest';

import { toEnvironmentEntries } from '../src/main/executionEnvironments';

describe('toEnvironmentEntries', () => {
    it('maps image fields and sorts by name', () => {
        const entries = toEnvironmentEntries([
            {
                created: '2026-10-01',
                execution_environment: true,
                full_name: 'quay.io/ansible/creator-ee:v1',
                image_id: 'abc123',
            },
            {
                created: '2026-09-01',
                execution_environment: true,
                full_name: 'quay.io/ansible/de-minimal-ee:latest',
                image_id: 'def456',
            },
        ]);

        expect(entries.map((entry) => entry.fullName)).toEqual([
            'quay.io/ansible/creator-ee:v1',
            'quay.io/ansible/de-minimal-ee:latest',
        ]);
        expect(entries[0]).toEqual({
            fullName: 'quay.io/ansible/creator-ee:v1',
            imageId: 'abc123',
            created: '2026-10-01',
        });
    });

    it('returns an empty list when no EE images exist', () => {
        expect(toEnvironmentEntries([])).toEqual([]);
    });
});
