/**
 * Host bridge for the shared `@ansible/ui` plugin documentation view.
 *
 * `PluginDocView` is the extension's own webview component, so navita supplies
 * only the host capabilities it asks for. AI-assisted actions copy their prompt
 * to the clipboard, which is how every other prompt in navita works.
 */

import type { PluginDocBridge } from '@ansible/ui';

export interface PluginDocBridgeOptions {
    /** Surface a message in navita's toast area. */
    readonly showToast: (message: string) => void;
}

/**
 * Build the bridge `PluginDocView` consumes.
 * @param options - Host behaviours navita provides.
 * @returns Bridge implementation backed by IPC.
 */
export function createPluginDocBridge(options: PluginDocBridgeOptions): PluginDocBridge {
    return {
        openFile: (target: string) => window.navita.openPath(target),
        showToast: options.showToast,
        getResolvedTheme: () =>
            window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
        saveViewSettings: async () => {
            // navita has no per-view zoom persistence yet.
        },
        getPluginDoc: async (fqcn: string, pluginType: string) => {
            const result = await window.navita.getPluginDoc(fqcn, pluginType);
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
