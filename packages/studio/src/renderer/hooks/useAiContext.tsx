/**
 * React context that lets any content view push a prompt into the
 * chat panel. The App component provides the implementation;
 * AiAnalysis buttons consume it.
 */

import React, { createContext, useContext } from 'react';

export interface AiContextValue {
    requestAnalysis: (prompt: string, context?: string) => void;
}

const AiContext = createContext<AiContextValue>({
    requestAnalysis: () => {},
});

export const AiProvider = AiContext.Provider;

export function useAi(): AiContextValue {
    return useContext(AiContext);
}
