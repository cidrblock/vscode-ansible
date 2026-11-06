import { describe, expect, it } from 'vitest';

import { describeServices, parseAdtTools, parseAnsibleVersion } from '../src/main/diagnostics';

describe('parseAnsibleVersion', () => {
    it('reads the core version out of the banner', () => {
        const banner = [
            'ansible [core 2.17.4]',
            '  config file = /home/user/.ansible.cfg',
            '  python version = 3.12.5',
        ].join('\n');
        expect(parseAnsibleVersion(banner)).toBe('2.17.4');
    });

    it('keeps a pre-release suffix attached', () => {
        expect(parseAnsibleVersion('ansible [core 2.18.0b1]')).toBe('2.18.0b1');
    });

    it('returns undefined when ansible printed something else', () => {
        expect(parseAnsibleVersion('command not found')).toBeUndefined();
    });
});

describe('parseAdtTools', () => {
    it('parses name/version lines and skips ansible-core', () => {
        const output = [
            'ansible-core 2.17.4',
            'ansible-builder 3.0.1',
            'ansible-lint 24.9.2',
            'molecule 24.2.0',
        ].join('\n');
        expect(parseAdtTools(output)).toEqual([
            { name: 'ansible-builder', version: '3.0.1' },
            { name: 'ansible-lint', version: '24.9.2' },
            { name: 'molecule', version: '24.2.0' },
        ]);
    });

    it('ignores blank lines and prose adt may print', () => {
        expect(parseAdtTools('\n(ansible-dev-tools)\nansible-creator 24.9.1\n')).toEqual([
            { name: 'ansible-creator', version: '24.9.1' },
        ]);
    });

    it('returns nothing when adt is missing', () => {
        expect(parseAdtTools("Tool 'adt' not found. Install ansible-dev-tools first.")).toEqual([]);
    });
});

describe('describeServices', () => {
    it('reports servers in the vocabulary the view renders', () => {
        expect(describeServices({ state: 'ready', toolCount: 48 }, { state: 'ready' })).toEqual([
            { name: 'Language Server', status: 'running' },
            { name: 'MCP Server', status: 'running' },
        ]);
    });

    it('reports anything not ready as stopped', () => {
        expect(describeServices({ state: 'error' }, { state: 'starting' })).toEqual([
            { name: 'Language Server', status: 'stopped' },
            { name: 'MCP Server', status: 'stopped' },
        ]);
    });
});
