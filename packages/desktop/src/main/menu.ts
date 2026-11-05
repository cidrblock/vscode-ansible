/**
 * Native menu template for navita.
 *
 * Returns plain data rather than Electron `MenuItemConstructorOptions` so the
 * layout can be asserted in tests without launching an app.
 */

import {
    HARNESSES,
    SECTIONS,
    SECTION_GROUPS,
    THEMES,
    type MenuAction,
    type Section,
    type SectionId,
    type ThemeId,
    type WorkspaceEntry,
} from '../shared/ipc';

export interface MenuItemSpec {
    label?: string;
    type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';
    role?: string;
    accelerator?: string;
    enabled?: boolean;
    checked?: boolean;
    id?: string;
    submenu?: MenuItemSpec[];
    action?: MenuAction['id'];
    actionArg?: string;
}

export interface MenuContext {
    readonly appName: string;
    readonly isMac: boolean;
    readonly hasWorkspace: boolean;
    readonly recents: readonly WorkspaceEntry[];
    readonly activeSection: SectionId;
    readonly theme: ThemeId;
}

/**
 * Build one View menu entry per section, separated by sidebar group.
 * @param activeSection - Section currently shown in the pane.
 * @returns Menu entries in sidebar order, with a separator between groups.
 */
function sectionMenuItems(activeSection: SectionId): MenuItemSpec[] {
    const items: MenuItemSpec[] = [];
    const append = (grouped: readonly Section[]): void => {
        if (grouped.length === 0) {
            return;
        }
        if (items.length > 0) {
            items.push({ type: 'separator' });
        }
        for (const section of grouped) {
            items.push({
                label: section.label,
                type: 'checkbox',
                checked: section.id === activeSection,
                action: 'show-section',
                actionArg: section.id,
            });
        }
    };
    // The overview sits above the sidebar groups, so it leads the menu too.
    append(SECTIONS.filter((section) => section.group === 'home'));
    for (const group of SECTION_GROUPS) {
        append(SECTIONS.filter((section) => section.group === group.id));
    }
    return items;
}

/**
 * Build the application menu for the current app state.
 * @param context - Application name, platform and open workspace details.
 * @returns Menu template in Electron's MenuItemConstructorOptions shape.
 */
export function buildMenuTemplate(context: MenuContext): MenuItemSpec[] {
    const { hasWorkspace, recents, activeSection, theme } = context;

    const recentItems: MenuItemSpec[] =
        recents.length > 0
            ? recents.map((recent) => ({
                  label: `${recent.name} — ${recent.path}`,
                  action: 'open-recent',
                  actionArg: recent.path,
              }))
            : [{ label: 'No recent workspaces', enabled: false }];

    const fileMenu: MenuItemSpec = {
        label: '&File',
        submenu: [
            { label: 'Open Workspace…', accelerator: 'CmdOrCtrl+O', action: 'open-workspace' },
            { label: 'Open Recent', submenu: recentItems },
            {
                label: 'Close Workspace',
                enabled: hasWorkspace,
                action: 'close-workspace',
            },
            { type: 'separator' },
            {
                label: 'Reveal Workspace in File Manager',
                enabled: hasWorkspace,
                action: 'reveal-workspace',
            },
            ...(context.isMac
                ? []
                : ([{ type: 'separator' }, { label: 'Quit', role: 'quit' }] as MenuItemSpec[])),
        ],
    };

    const viewMenu: MenuItemSpec = {
        label: '&View',
        submenu: [
            { label: 'Back', accelerator: 'Alt+Left', action: 'back' },
            { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', action: 'toggle-sidebar' },
            { type: 'separator' },
            ...sectionMenuItems(activeSection),
            { type: 'separator' },
            {
                label: 'Theme',
                submenu: THEMES.map((entry) => ({
                    label: entry.label,
                    type: 'radio' as const,
                    checked: entry.id === theme,
                    action: 'set-theme' as const,
                    actionArg: entry.id,
                })),
            },
            { type: 'separator' },
            { label: 'Reload', accelerator: 'F5', action: 'reload' },
            { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Alt+I', action: 'devtools' },
        ],
    };

    const workspaceMenu: MenuItemSpec = {
        label: '&Workspace',
        submenu: [
            {
                label: 'Rescan Workspace',
                accelerator: 'CmdOrCtrl+R',
                enabled: hasWorkspace,
                action: 'rescan-workspace',
            },
            {
                label: 'Copy MCP Snippet',
                enabled: hasWorkspace,
                submenu: HARNESSES.map((harness) => ({
                    label: `${harness.label} (${harness.configPath})`,
                    action: 'copy-snippet',
                    actionArg: harness.id,
                })),
            },
        ],
    };

    const mcpMenu: MenuItemSpec = {
        label: '&MCP',
        submenu: [
            {
                label: 'Test Connection',
                accelerator: 'CmdOrCtrl+T',
                enabled: hasWorkspace,
                action: 'test-connection',
            },
            { label: 'Show Server Log', enabled: false },
        ],
    };

    const helpMenu: MenuItemSpec = {
        label: '&Help',
        role: 'help',
        submenu: [
            { label: 'navita Documentation', enabled: false },
            { label: 'Report an Issue', enabled: false },
            ...(context.isMac
                ? []
                : ([
                      { type: 'separator' },
                      { label: 'About navita', action: 'about' },
                  ] as MenuItemSpec[])),
        ],
    };

    const appMenu: MenuItemSpec[] = context.isMac
        ? [
              {
                  label: context.appName,
                  submenu: [
                      { role: 'about' },
                      { type: 'separator' },
                      { role: 'hide' },
                      { role: 'hideOthers' },
                      { role: 'unhide' },
                      { type: 'separator' },
                      { role: 'quit' },
                  ],
              },
          ]
        : [];

    return [...appMenu, fileMenu, viewMenu, workspaceMenu, mcpMenu, helpMenu];
}
