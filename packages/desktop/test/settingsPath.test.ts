import { describe, expect, it } from 'vitest';

import { parseSettingsTrail, SETTINGS_PAGES, settingsCrumb } from '../src/renderer/settingsPath';

describe('settingsPath', () => {
    it('round-trips every page', () => {
        for (const page of SETTINGS_PAGES) {
            expect(parseSettingsTrail([settingsCrumb(page.id)])).toBe(page.id);
        }
    });

    it('labels a crumb with the page title', () => {
        expect(settingsCrumb('sources').label).toBe('Collection Sources');
    });

    it('reports the root for an empty or unknown trail', () => {
        expect(parseSettingsTrail([])).toBeUndefined();
        expect(parseSettingsTrail([{ id: 'settings:elsewhere', label: 'x' }])).toBeUndefined();
    });

    it('reads the deepest crumb', () => {
        const trail = [settingsCrumb('appearance'), settingsCrumb('about')];
        expect(parseSettingsTrail(trail)).toBe('about');
    });
});
