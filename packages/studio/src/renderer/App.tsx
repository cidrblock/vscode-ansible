import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TitleBar } from './components/TitleBar';
import { StatusBar } from './components/StatusBar';
import { MillerColumns } from './components/MillerColumns';
import { ChatPanel } from './views/ChatPanel';
import { AiProvider } from './hooks/useAiContext';
import { useMillerNav } from './hooks/useMillerNav';
import { useSettingsState } from './views/SettingsView';
import { resolveColumns } from './columnResolver';
import { api } from './api';
import type { ColorScheme, AbbenayModelInfo } from '../shared/types';

function resolveTheme(scheme: ColorScheme): 'light' | 'dark' {
    if (scheme !== 'auto') return scheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function App(): React.JSX.Element {
    const [colorScheme, setColorScheme] = useState<ColorScheme>('auto');
    const [statusRefreshKey, setStatusRefreshKey] = useState(0);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatModels, setChatModels] = useState<AbbenayModelInfo[]>([]);
    const [selectedChatModel, setSelectedChatModel] = useState('');
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const nav = useMillerNav();
    const settingsState = useSettingsState(setColorScheme);

    useEffect(() => {
        void api.getSettings().then((s) => {
            setColorScheme(s.colorScheme ?? 'auto');
            if (s.abbenayAutoConnect) {
                void api.abbenayConnect().then(() => {
                    void api.abbenayListModels().then(setChatModels);
                });
            }
            if (s.abbenayModel) setSelectedChatModel(s.abbenayModel);
        });
    }, []);

    useEffect(() => {
        const apply = () => {
            document.documentElement.setAttribute('data-theme', resolveTheme(colorScheme));
        };
        apply();

        if (colorScheme === 'auto') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            mq.addEventListener('change', apply);
            return () => mq.removeEventListener('change', apply);
        }
    }, [colorScheme]);

    const refreshStatus = useCallback(() => {
        setStatusRefreshKey((k) => k + 1);
    }, []);

    const columns = useMemo(
        () => resolveColumns({ select: nav.select, path: nav.path, settingsState, refreshStatus }),
        [nav.select, nav.path, settingsState, refreshStatus],
    );

    const handleBreadcrumbClick = useCallback((columnIndex: number) => {
        if (columnIndex < 0) {
            nav.reset();
            return;
        }
        const segment = nav.path[columnIndex];
        if (segment) {
            nav.select(columnIndex, segment.columnType, segment.selectedId);
        }
    }, [nav.path, nav.select, nav.reset]);

    const requestAnalysis = useCallback((prompt: string, context?: string) => {
        const fullPrompt = context
            ? `${context}\n\n${prompt}`
            : prompt;
        setPendingPrompt(fullPrompt);
        setChatOpen(true);
    }, []);

    const aiContextValue = useMemo(() => ({ requestAnalysis }), [requestAnalysis]);

    return (
        <AiProvider value={aiContextValue}>
            <div style={styles.root}>
                <TitleBar onChatToggle={() => setChatOpen((o) => !o)} />
                <div style={styles.content}>
                    <div style={styles.columns}>
                        <MillerColumns columns={columns} onBreadcrumbClick={handleBreadcrumbClick} />
                    </div>
                    <ChatPanel
                        open={chatOpen}
                        onClose={() => setChatOpen(false)}
                        models={chatModels}
                        selectedModel={selectedChatModel}
                        onModelChange={setSelectedChatModel}
                        pendingPrompt={pendingPrompt}
                        onPromptConsumed={() => setPendingPrompt(null)}
                    />
                </div>
                <StatusBar refreshKey={statusRefreshKey} />
            </div>
        </AiProvider>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
    },
    content: {
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
    },
    columns: {
        flex: 1,
        overflow: 'hidden',
    },
};
