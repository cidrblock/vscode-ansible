import { describe, expect, it } from 'vitest';

import {
    executionEnvironmentCrumb,
    executionEnvironmentPackageLabel,
    executionEnvironmentPackagesCrumb,
    parseExecutionEnvironmentTrail,
} from '../src/renderer/executionEnvironmentPath';

describe('executionEnvironmentPath', () => {
    it('round-trips an image name that contains a registry path and a tag', () => {
        const name = 'quay.io/ansible/ansible-runner:latest';
        const trail = [executionEnvironmentCrumb(name)];

        expect(trail[0]?.label).toBe(name);
        expect(parseExecutionEnvironmentTrail(trail)).toEqual({ level: 'image', fullName: name });
    });

    it('keeps the image name when a package inventory is opened', () => {
        const name = 'localhost:5000/team/ee:1.2.3';
        const trail = [
            executionEnvironmentCrumb(name),
            executionEnvironmentPackagesCrumb(name, 'python'),
        ];

        expect(trail[1]?.label).toBe('Python packages');
        expect(parseExecutionEnvironmentTrail(trail)).toEqual({
            level: 'packages',
            fullName: name,
            kind: 'python',
        });
    });

    it('labels each inventory', () => {
        expect(executionEnvironmentPackageLabel('collections')).toBe('Ansible collections');
        expect(executionEnvironmentPackageLabel('system')).toBe('System packages');
    });

    it('reports the list level for an empty trail', () => {
        expect(parseExecutionEnvironmentTrail([])).toBeUndefined();
    });

    it('ignores a crumb that belongs to another section', () => {
        expect(
            parseExecutionEnvironmentTrail([{ id: 'collection:ansible.builtin', label: 'x' }]),
        ).toBeUndefined();
    });

    it('ignores a package crumb naming an inventory that does not exist', () => {
        expect(
            parseExecutionEnvironmentTrail([{ id: 'ee#gems:quay.io/x/y:1', label: 'x' }]),
        ).toBeUndefined();
    });
});
