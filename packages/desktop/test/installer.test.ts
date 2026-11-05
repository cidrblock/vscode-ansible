import { describe, expect, it } from 'vitest';

import { DEV_TOOLS_PACKAGE, installCommand } from '../src/main/installer';

describe('installCommand', () => {
    it('installs with pip inside the resolved interpreter', () => {
        expect(installCommand('/venv/bin/python3')).toEqual({
            command: '/venv/bin/python3',
            args: ['-m', 'pip', 'install', DEV_TOOLS_PACKAGE],
        });
    });

    it('accepts an explicit package list', () => {
        expect(installCommand('/usr/bin/python3', ['ansible-lint']).args).toEqual([
            '-m',
            'pip',
            'install',
            'ansible-lint',
        ]);
    });
});
