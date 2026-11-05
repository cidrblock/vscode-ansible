import type { CreatorBridge } from '@ansible/ui';

import type { CreatorFinishedEvent, CreatorStartedEvent } from '../../shared/ipc';

export interface CreatorBridgeOptions {
    /** Workspace the form pre-fills path fields from. */
    readonly workspacePath: string;
    /** Surface a message in navita's toast area. */
    readonly showToast: (message: string) => void;
    /** Return to the command catalog. */
    readonly cancel: () => void;
}

/**
 * Host bridge for the shared `@ansible/ui` creator form.
 *
 * The view itself is the extension's own component; navita only supplies the
 * four host capabilities it asks for, backed by IPC.
 * @param options - Host behaviours navita provides.
 * @returns Bridge implementation the form consumes.
 */
export function createCreatorBridge(options: CreatorBridgeOptions): CreatorBridge {
    return {
        workspacePath: options.workspacePath,
        openFile: (target: string) => window.navita.openPath(target),
        showToast: options.showToast,
        getResolvedTheme: () =>
            window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
        saveViewSettings: async () => {
            // navita has no per-view zoom persistence yet.
        },
        execute: (commandPath: readonly string[], values: Record<string, unknown>) =>
            window.navita.runCreator(commandPath, values),
        cancel: options.cancel,
        onExecutionStarted: (listener: (event: CreatorStartedEvent) => void) =>
            window.navita.onCreatorStarted(listener),
        onExecutionFinished: (listener: (event: CreatorFinishedEvent) => void) =>
            window.navita.onCreatorFinished(listener),
    };
}
