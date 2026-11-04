import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_STATE, parseState, StateStore } from '../src/main/store';

const cleanup: string[] = [];

/**
 * Create a throwaway state file path inside a fresh temporary directory.
 * @returns Path the test may write state to.
 */
function temporaryStateFile(): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'navita-state-'));
    cleanup.push(directory);
    return path.join(directory, 'state.json');
}

afterEach(() => {
    while (cleanup.length > 0) {
        const directory = cleanup.pop();
        if (directory !== undefined) {
            fs.rmSync(directory, { recursive: true, force: true });
        }
    }
});

describe('parseState', () => {
    it('returns defaults for garbage', () => {
        expect(parseState(null)).toEqual(DEFAULT_STATE);
        expect(parseState('nope')).toEqual(DEFAULT_STATE);
    });

    it('drops malformed recents but keeps valid ones', () => {
        const state = parseState({
            recents: [{ path: '/tmp/ok', openedAt: 5 }, { path: 42 }, null],
            activeSection: 'ai-skills',
            lastWorkspace: '/tmp/ok',
        });
        expect(state.recents).toHaveLength(1);
        expect(state.recents[0].name).toBe('ok');
        expect(state.activeSection).toBe('ai-skills');
        expect(state.lastWorkspace).toBe('/tmp/ok');
    });

    it('falls back to the default section for unknown ids', () => {
        expect(parseState({ activeSection: 'nope' }).activeSection).toBe('dev-tools');
    });
});

describe('StateStore', () => {
    it('round-trips state through disk', () => {
        const file = temporaryStateFile();
        const store = new StateStore(file);
        store.save({ ...DEFAULT_STATE, lastWorkspace: '/tmp/project' });
        expect(store.load().lastWorkspace).toBe('/tmp/project');
    });

    it('returns defaults when the file is missing', () => {
        const store = new StateStore(path.join(os.tmpdir(), 'navita-missing', 'state.json'));
        expect(store.load()).toEqual(DEFAULT_STATE);
    });
});
