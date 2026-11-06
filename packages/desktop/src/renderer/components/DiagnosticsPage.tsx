import { useMemo, type JSX } from 'react';

import { BridgeProvider, DiagnosticsView } from '@ansible/ui';

import type { SectionId } from '../../shared/ipc';
import { createDiagnosticsBridge, type DiagnosticsLogSource } from './diagnosticsBridge';

export interface DiagnosticsPageProps {
    /** Shows a short confirmation or failure as a toast. */
    readonly onNotice: (message: string) => void;
    /** Switches section without going through the trail. */
    readonly onNavigate: (section: SectionId) => void;
    /** Opens the Logs page filtered to one source. */
    readonly onOpenLogs: (source: DiagnosticsLogSource) => void;
}

/**
 * Diagnostics section, ported from `ansible.showDiagnostics`.
 *
 * Renders the extension's own `DiagnosticsView` from `@ansible/ui`; the
 * payload comes from the main process and every action routes into an existing
 * navita view rather than duplicating it.
 * @param props - Component properties.
 * @returns The diagnostics panel.
 */
export function DiagnosticsPage(props: DiagnosticsPageProps): JSX.Element {
    const { onNotice, onNavigate, onOpenLogs } = props;
    const bridge = useMemo(
        () => createDiagnosticsBridge({ showToast: onNotice, onNavigate, onOpenLogs }),
        [onNotice, onNavigate, onOpenLogs],
    );

    return (
        <BridgeProvider value={bridge}>
            <DiagnosticsView />
        </BridgeProvider>
    );
}
