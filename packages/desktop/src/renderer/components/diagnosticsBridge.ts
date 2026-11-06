/**
 * Host bridge for the shared `@ansible/ui` diagnostics view.
 *
 * `DiagnosticsView` is the extension's own panel, so navita supplies only the
 * host capabilities it asks for: a payload over IPC, navigation into the views
 * that fix what it reports, and the log page for its two "show logs" buttons.
 */

import type { DiagnosticsBridge, DiagnosticsData } from '@ansible/ui';

import type { SectionId } from '../../shared/ipc';

/** Where the diagnostics page sends the user for each kind of log. */
export type DiagnosticsLogSource = 'app' | 'lsp';

export interface DiagnosticsBridgeOptions {
    /** Surface a message in navita's toast area. */
    readonly showToast: (message: string) => void;
    /** Switch to another section, resetting its depth. */
    readonly onNavigate: (section: SectionId) => void;
    /** Open the log page filtered to one source. */
    readonly onOpenLogs: (source: DiagnosticsLogSource) => void;
}

/**
 * Build the bridge `DiagnosticsView` consumes.
 * @param options - Host behaviours navita provides.
 * @returns Bridge implementation backed by IPC.
 */
export function createDiagnosticsBridge(options: DiagnosticsBridgeOptions): DiagnosticsBridge {
    // The view calls `resyncMetadata()` and re-reads without awaiting it, so the
    // read waits for the rescan here instead of showing the pre-resync state.
    let pending: Promise<unknown> | null = null;

    return {
        openFile: (target: string) => window.navita.openPath(target),
        showToast: options.showToast,
        getResolvedTheme: () =>
            window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
        saveViewSettings: async () => {
            // The diagnostics page has no per-view settings to persist.
        },
        getDiagnostics: async () => {
            if (pending !== null) {
                await pending;
                pending = null;
            }
            return (await window.navita.getDiagnostics()) as DiagnosticsData;
        },
        changePythonEnvironment: () => {
            options.onNavigate('env-managers');
        },
        upgradeDevTools: () => {
            void window.navita
                .upgradeDevTools()
                .then((result) => {
                    if (result.state === 'ready') {
                        options.showToast(
                            `Dev tools upgraded — ${String(result.packageCount)} packages.`,
                        );
                        return;
                    }
                    const firstLine = result.output.split('\n')[0] ?? '';
                    options.showToast(`Upgrade failed. ${firstLine}`.trim());
                })
                .catch((error: unknown) => {
                    options.showToast(error instanceof Error ? error.message : String(error));
                });
        },
        resyncMetadata: () => {
            pending = window.navita.rescanWorkspace();
        },
        openOutput: () => {
            options.onOpenLogs('app');
        },
        openLanguageServerLogs: () => {
            options.onOpenLogs('lsp');
        },
    };
}
