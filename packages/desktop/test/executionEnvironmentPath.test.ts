import { describe, expect, it } from 'vitest';

import {
    executionEnvironmentCrumb,
    parseExecutionEnvironmentTrail,
} from '../src/renderer/executionEnvironmentPath';

describe('executionEnvironmentPath', () => {
    it('round-trips an image name that contains a registry path and a tag', () => {
        const name = 'quay.io/ansible/ansible-runner:latest';
        const trail = [executionEnvironmentCrumb(name)];

        expect(trail[0]?.label).toBe(name);
        expect(parseExecutionEnvironmentTrail(trail)).toBe(name);
    });

    it('reports the list level for an empty trail', () => {
        expect(parseExecutionEnvironmentTrail([])).toBeUndefined();
    });

    it('ignores a crumb that belongs to another section', () => {
        expect(
            parseExecutionEnvironmentTrail([{ id: 'collection:ansible.builtin', label: 'x' }]),
        ).toBeUndefined();
    });
});
