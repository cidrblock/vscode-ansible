import { describe, expect, it } from 'vitest';

import { toDevToolEntries } from '../src/main/devtools';

describe('toDevToolEntries', () => {
    it('keeps name and version', () => {
        expect(toDevToolEntries([{ name: 'ansible-lint', version: '26.10.1' }])).toEqual([
            { name: 'ansible-lint', version: '26.10.1' },
        ]);
    });

    it('keeps the install location when present', () => {
        expect(
            toDevToolEntries([
                { name: 'ansible-core', version: '2.22.0', location: '/venv/bin/ansible-core' },
            ]),
        ).toEqual([
            { name: 'ansible-core', version: '2.22.0', location: '/venv/bin/ansible-core' },
        ]);
    });

    it('returns an empty list for an empty environment', () => {
        expect(toDevToolEntries([])).toEqual([]);
    });
});
