import { describe, expect, it } from 'vitest';

import { buildMenuTemplate, type MenuContext, type MenuItemSpec } from '../src/main/menu';
import { SECTIONS, THEMES } from '../src/shared/ipc';

const baseContext: MenuContext = {
    appName: 'navita',
    isMac: false,
    hasWorkspace: false,
    recents: [],
    activeSection: 'dev-tools',
    theme: 'system',
};

/**
 * Build a menu template with defaults filled in.
 * @param context - Menu context fields to override.
 * @returns The generated menu template.
 */
function menu(context: Partial<MenuContext>): MenuItemSpec[] {
    return buildMenuTemplate({ ...baseContext, ...context });
}

/**
 * Find a menu entry by label, searching submenus recursively.
 * @param items - Menu entries to search.
 * @param label - Label to look for.
 * @returns The first matching entry, or undefined.
 */
function find(items: MenuItemSpec[], label: string): MenuItemSpec | undefined {
    for (const item of items) {
        if (item.label === label) {
            return item;
        }
        const nested = item.submenu === undefined ? undefined : find(item.submenu, label);
        if (nested !== undefined) {
            return nested;
        }
    }
    return undefined;
}

describe('buildMenuTemplate', () => {
    it('puts Open Workspace in the File menu with Ctrl/Cmd+O', () => {
        const open = find(menu({}), 'Open Workspace…');
        expect(open?.action).toBe('open-workspace');
        expect(open?.accelerator).toBe('CmdOrCtrl+O');
    });

    it('disables workspace-scoped items when nothing is open', () => {
        expect(find(menu({}), 'Close Workspace')?.enabled).toBe(false);
        expect(find(menu({}), 'Rescan Workspace')?.enabled).toBe(false);
        expect(find(menu({}), 'Copy MCP Snippet')?.enabled).toBe(false);
    });

    it('enables them once a workspace is open', () => {
        expect(find(menu({ hasWorkspace: true }), 'Close Workspace')?.enabled).toBe(true);
        expect(find(menu({ hasWorkspace: true }), 'Rescan Workspace')?.enabled).toBe(true);
    });

    it('lists every sidebar section exactly once, with the active one checked', () => {
        const view = menu({}).find((item) => item.label === '&View');
        const sectionItems = (view?.submenu ?? []).filter((item) => item.action === 'show-section');
        expect(sectionItems).toHaveLength(SECTIONS.length);
        expect(sectionItems.filter((item) => item.checked === true)).toHaveLength(1);
    });

    it('leads the View menu with the overview', () => {
        const view = menu({}).find((item) => item.label === '&View');
        const sections = (view?.submenu ?? []).filter((item) => item.action === 'show-section');
        expect(sections[0]?.label).toBe('Overview');
    });

    it('offers Logs in the View menu with a shortcut', () => {
        const logs = find(menu({}), 'Logs');
        expect(logs?.action).toBe('show-section');
        expect(logs?.actionArg).toBe('logs');
        expect(logs?.accelerator).toBe('CmdOrCtrl+Shift+U');
    });

    it('offers Back in the View menu on Alt+Left', () => {
        const back = find(menu({}), 'Back');
        expect(back?.action).toBe('back');
        expect(back?.accelerator).toBe('Alt+Left');
    });

    it('shows a disabled placeholder when there are no recents', () => {
        const recent = find(menu({}), 'Open Recent');
        expect(recent?.submenu).toHaveLength(1);
        expect(recent?.submenu?.[0].enabled).toBe(false);
    });

    it('offers one entry per recent workspace', () => {
        const recent = find(
            menu({
                recents: [{ path: '/tmp/a', name: 'a', openedAt: 1 }],
            }),
            'Open Recent',
        );
        expect(recent?.submenu?.[0]).toMatchObject({ action: 'open-recent', actionArg: '/tmp/a' });
    });

    it('adds the app menu on macOS and omits Quit from File', () => {
        const items = menu({ isMac: true });
        expect(items[0].label).toBe('navita');
        expect(find(items, 'Quit')).toBeUndefined();
    });
});

describe('theme menu', () => {
    it('offers one radio entry per theme and checks the active one', () => {
        const theme = find(menu({}), 'Theme');
        expect(theme?.submenu).toBeDefined();
        const entries = theme?.submenu ?? [];
        expect(entries).toHaveLength(THEMES.length);
        expect(entries.every((entry) => entry.type === 'radio')).toBe(true);
        expect(entries.every((entry) => entry.action === 'set-theme')).toBe(true);
        expect(entries.map((entry) => entry.actionArg)).toEqual(THEMES.map((entry) => entry.id));
    });

    it('checks exactly the stored theme', () => {
        const entries = find(menu({ theme: 'rhdh-dark' }), 'Theme')?.submenu ?? [];
        expect(entries.filter((entry) => entry.checked).map((entry) => entry.actionArg)).toEqual([
            'rhdh-dark',
        ]);
    });
});
