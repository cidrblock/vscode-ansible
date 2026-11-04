/**
 * Native menu template for navita.
 *
 * Returns plain data rather than Electron `MenuItemConstructorOptions` so the
 * layout can be asserted in tests without launching an app.
 */

import {
    HARNESSES,
    SECTIONS,
    type MenuAction,
    type SectionId,
    type WorkspaceEntry,
} from '../shared/ipc';

export interface MenuItemSpec {
    label?: string;
    type?: 'normal' | 'separator' | 'submenu' | 'checkbox';
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
}

/**
 * Build the application menu for the current app state.
 * @param context - Application name, platform and open workspace details.
 * @returns Menu template in Electron's MenuItemConstructorOptions shape.
 */
export function buildMenuTemplate(context: MenuContext): MenuItemSpec[] {
    const { hasWorkspace, recents, activeSection } = context;

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
            { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', action: 'toggle-sidebar' },
            { type: 'separator' },
            ...SECTIONS.map((section): MenuItemSpec => ({
                label: section.label,
                type: 'checkbox',
                checked: section.id === activeSection,
                action: 'show-section',
                actionArg: section.id,
            })),
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
