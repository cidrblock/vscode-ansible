import { describe, expect, it } from 'vitest';

import { SECTIONS, SECTION_GROUPS } from '../src/shared/ipc';

describe('SECTIONS', () => {
    it('keeps every drawer alphabetical', () => {
        for (const group of SECTION_GROUPS) {
            const labels = SECTIONS.filter((section) => section.group === group.id).map(
                (section) => section.label,
            );
            const sorted = [...labels].sort((left, right) => left.localeCompare(right));
            expect(labels).toEqual(sorted);
        }
    });

    it('gives every section a unique label', () => {
        const labels = SECTIONS.map((section) => section.label);
        expect(new Set(labels).size).toBe(labels.length);
    });
});
