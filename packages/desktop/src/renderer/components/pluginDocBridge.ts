/**
 * Host bridge for the shared `@ansible/ui` plugin documentation view.
 *
 * `PluginDocView` is the extension's own webview component, so navita supplies
 * only the host capabilities it asks for. AI-assisted actions copy their prompt
 * to the clipboard, which is how every other prompt in navita works.
 */

import type { PluginDocBridge } from '@ansible/ui';

import type { PluginDocResult } from '../../shared/ipc';

/** Loads documentation for one plugin from whichever cache backs the view. */
export type PluginDocLoader = (fqcn: string, pluginType: string) => Promise<PluginDocResult>;

export interface PluginDocBridgeOptions {
    /** Surface a message in navita's toast area. */
    readonly showToast: (message: string) => void;
    /** Documentation source; defaults to ansible-doc over the installed collection. */
    readonly loadDoc?: PluginDocLoader;
}

/**
 * Build the bridge `PluginDocView` consumes.
 * @param options - Host behaviours navita provides.
 * @returns Bridge implementation backed by IPC.
 */
export function createPluginDocBridge(options: PluginDocBridgeOptions): PluginDocBridge {
    const loadDoc: PluginDocLoader =
        options.loadDoc ?? ((fqcn, pluginType) => window.navita.getPluginDoc(fqcn, pluginType));

    return {
        openFile: (target: string) => window.navita.openPath(target),
        showToast: options.showToast,
        getResolvedTheme: () =>
            window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
        saveViewSettings: async () => {
            // navita has no per-view zoom persistence yet.
        },
        getPluginDoc: async (fqcn: string, pluginType: string) => {
            const result = await loadDoc(fqcn, pluginType);
            if (result.state !== 'ready') {
                return null;
            }
            // The contract types the payload as unknown because the main process
            // cannot resolve @ansible/ui; the shape here is its PluginData.
            return result.data ?? null;
        },
        copyToClipboard: (text: string) => window.navita.copyText(text),
        openChat: async (prompt?: string) => {
            if (prompt === undefined) {
                return;
            }
            await window.navita.copyText(prompt);
            options.showToast('Prompt copied to the clipboard.');
        },
        enableAiFeatures: true,
    };
}
