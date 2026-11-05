import { describe, expect, it } from 'vitest';

import { pickEnvironment } from '../src/main/environment';
import type { LocalEnvironment } from '@ansible/developer-services';

interface EnvironmentOptions {
    readonly active?: boolean;
    readonly kind?: LocalEnvironment['kind'];
}

const environment = (
    name: string,
    binDir: string,
    { active = false, kind = 'venv' }: EnvironmentOptions = {},
): LocalEnvironment => ({ name, pythonPath: `${binDir}/python3`, binDir, kind, active });

const capable = (value: LocalEnvironment): boolean => value.name === 'with-tools';

describe('pickEnvironment', () => {
    it('prefers an environment that ships the ansible tools', () => {
        const system = environment('system', '/usr/bin', { active: true, kind: 'system' });
        const tools = environment('with-tools', '/home/me/venv/bin');

        expect(pickEnvironment([system, tools], capable)).toBe(tools);
    });

    it('prefers the active environment among the capable ones', () => {
        const first = environment('with-tools', '/opt/one/bin');
        const second = environment('with-tools', '/opt/two/bin', { active: true });

        expect(pickEnvironment([first, second], capable)).toBe(second);
    });

    it('falls back to the active environment when none has the tools', () => {
        const inactive = environment('inactive', '/opt/a/bin');
        const active = environment('active', '/usr/bin', { active: true, kind: 'system' });

        expect(pickEnvironment([inactive, active], capable)).toBe(active);
    });

    it('falls back to the first environment when nothing is active', () => {
        const first = environment('first', '/opt/a/bin');

        expect(pickEnvironment([first], capable)).toBe(first);
    });

    it('returns undefined when nothing was discovered', () => {
        expect(pickEnvironment([], capable)).toBeUndefined();
    });
});
