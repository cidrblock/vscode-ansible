/**
 * Trail ids for the Settings section.
 *
 * Settings uses the same depth model as every other view: the root lists the
 * groups, and each group is a crumb, so Back and the breadcrumbs work without
 * a second navigation rail.
 */

import type { Crumb } from './navigation';

/** Pages the Settings section can show below its root. */
export type SettingsPage = 'appearance' | 'workspace' | 'sources' | 'playbooks' | 'about';

/** One settings page, as the root list shows it. */
export interface SettingsPageInfo {
    readonly id: SettingsPage;
    readonly title: string;
    readonly description: string;
}

/** The pages, in the order the root list shows them. */
export const SETTINGS_PAGES: readonly SettingsPageInfo[] = [
    {
        id: 'appearance',
        title: 'Appearance',
        description: 'Palette the window wears, and whether it follows the desktop.',
    },
    {
        id: 'workspace',
        title: 'Workspace',
        description: 'The open project, its pinned interpreter and recent workspaces.',
    },
    {
        id: 'sources',
        title: 'Collection Sources',
        description: 'GitHub organizations scanned for collections.',
    },
    {
        id: 'playbooks',
        title: 'Playbooks',
        description: 'How playbooks are run, and where navigator reads its configuration.',
    },
    {
        id: 'about',
        title: 'About',
        description: 'Version, install location and the state file.',
    },
];

const PAGE_PREFIX = 'settings:';

/**
 * Crumb for one settings page.
 * @param page - Page being opened.
 * @returns The crumb to push.
 */
export function settingsCrumb(page: SettingsPage): Crumb {
    const info = SETTINGS_PAGES.find((entry) => entry.id === page);
    return { id: `${PAGE_PREFIX}${page}`, label: info?.title ?? page };
}

/**
 * Which settings page the trail is on.
 * @param trail - Crumbs for the settings section.
 * @returns The page, or undefined at the root.
 */
export function parseSettingsTrail(trail: readonly Crumb[]): SettingsPage | undefined {
    const deepest = trail.at(-1);
    if (!deepest?.id.startsWith(PAGE_PREFIX)) {
        return undefined;
    }
    const page = deepest.id.slice(PAGE_PREFIX.length);
    const known = SETTINGS_PAGES.find((entry) => entry.id === page);
    return known?.id;
}
