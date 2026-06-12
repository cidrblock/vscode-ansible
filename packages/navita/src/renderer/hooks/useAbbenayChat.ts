/**
 * Hook that manages streaming chat with the Abbenay daemon.
 * Uses session-based chat so the daemon maintains conversation history
 * and can do multi-turn tool calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import type { ChatChunkData, AbbenayModelInfo, AbbenayStatus } from '../../shared/types';

export interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    toolCalls?: Array<{ id: string; name: string; args: string }>;
    isStreaming?: boolean;
}

export interface AbbenayChat {
    messages: DisplayMessage[];
    status: AbbenayStatus | null;
    models: AbbenayModelInfo[];
    isStreaming: boolean;
    isUsingTools: boolean;
    activeToolName: string | null;
    error: string | null;
    sendMessage: (text: string, model?: string) => Promise<void>;
    clearMessages: () => void;
    connect: () => Promise<void>;
    refreshModels: () => Promise<void>;
}

let msgCounter = 0;
function nextMsgId(): string {
    return `msg-${++msgCounter}`;
}

function ensureAssistantMessage(prev: DisplayMessage[]): DisplayMessage[] {
    const last = prev[prev.length - 1];
    if (last && last.role === 'assistant' && last.isStreaming) return prev;
    return [
        ...prev,
        { id: nextMsgId(), role: 'assistant', content: '', isStreaming: true },
    ];
}

export function useAbbenayChat(): AbbenayChat {
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [status, setStatus] = useState<AbbenayStatus | null>(null);
    const [models, setModels] = useState<AbbenayModelInfo[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isUsingTools, setIsUsingTools] = useState(false);
    const [activeToolName, setActiveToolName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const activeRequestId = useRef<string | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const sessionModelRef = useRef<string | null>(null);
    const lastChunkTime = useRef<number>(0);
    const toolDetectorTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const unsubscribe = api.onChatChunk((chunk: ChatChunkData) => {
            if (chunk.requestId !== activeRequestId.current) return;

            lastChunkTime.current = Date.now();

            switch (chunk.type) {
                case 'text':
                    setIsUsingTools(false);
                    setActiveToolName(null);
                    setMessages((prev) => {
                        const msgs = ensureAssistantMessage(prev);
                        const last = msgs[msgs.length - 1];
                        return [
                            ...msgs.slice(0, -1),
                            { ...last, content: last.content + (chunk.text ?? '') },
                        ];
                    });
                    break;

                case 'tool_call':
                    setIsUsingTools(true);
                    setActiveToolName(chunk.toolName ?? null);
                    setMessages((prev) => {
                        const msgs = ensureAssistantMessage(prev);
                        const last = msgs[msgs.length - 1];
                        const calls = [...(last.toolCalls ?? [])];
                        calls.push({
                            id: chunk.toolCallId ?? '',
                            name: chunk.toolName ?? '',
                            args: chunk.toolArgs ?? '',
                        });
                        return [...msgs.slice(0, -1), { ...last, toolCalls: calls }];
                    });
                    break;

                case 'tool_result':
                    setMessages((prev) => {
                        const updated = prev.map((m) =>
                            m.isStreaming ? { ...m, isStreaming: false } : m,
                        );
                        return [
                            ...updated,
                            {
                                id: nextMsgId(),
                                role: 'tool' as const,
                                content: chunk.toolContent ?? '',
                            },
                        ];
                    });
                    break;

                case 'error':
                    setError(chunk.errorMessage ?? 'Unknown error');
                    setIsStreaming(false);
                    setIsUsingTools(false);
                    setActiveToolName(null);
                    setMessages((prev) =>
                        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
                    );
                    activeRequestId.current = null;
                    break;

                case 'done':
                    setIsStreaming(false);
                    setIsUsingTools(false);
                    setActiveToolName(null);
                    setMessages((prev) =>
                        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
                    );
                    activeRequestId.current = null;
                    break;
            }
        });

        return unsubscribe;
    }, []);

    // Detect tool usage by monitoring gaps in streaming chunks.
    // The daemon executes tools server-side without sending events,
    // so a pause of >1.5s while streaming likely means tool execution.
    useEffect(() => {
        if (isStreaming) {
            toolDetectorTimer.current = setInterval(() => {
                const elapsed = Date.now() - lastChunkTime.current;
                if (elapsed > 1500 && activeRequestId.current) {
                    setIsUsingTools(true);
                }
            }, 500);
        } else {
            if (toolDetectorTimer.current) {
                clearInterval(toolDetectorTimer.current);
                toolDetectorTimer.current = null;
            }
            setIsUsingTools(false);
        }
        return () => {
            if (toolDetectorTimer.current) {
                clearInterval(toolDetectorTimer.current);
                toolDetectorTimer.current = null;
            }
        };
    }, [isStreaming]);

    const connect = useCallback(async () => {
        const result = await api.abbenayConnect();
        if (!result.ok) {
            setError(result.error ?? 'Failed to connect');
        }
        const s = await api.abbenayStatus();
        setStatus(s);
    }, []);

    const refreshModels = useCallback(async () => {
        const m = await api.abbenayListModels();
        setModels(m);
    }, []);

    const sendMessage = useCallback(async (text: string, model?: string) => {
        setError(null);
        const userMsg: DisplayMessage = { id: nextMsgId(), role: 'user', content: text };
        setMessages((prev) => [...prev, userMsg]);
        setIsStreaming(true);

        try {
            const resolvedModel = model || '';

            // Create a new session when the model changes or on first message.
            // The session is bound to a model at creation time (the proto has no
            // per-turn model override), so switching providers requires a new session.
            const modelChanged = sessionIdRef.current && sessionModelRef.current !== resolvedModel;
            if (!sessionIdRef.current || modelChanged) {
                if (modelChanged && sessionIdRef.current) {
                    try { await api.abbenayDeleteSession(sessionIdRef.current); } catch { /* ok */ }
                }
                const session = await api.abbenayCreateSession(resolvedModel, 'Ansible Navita Chat');
                sessionIdRef.current = session.id;
                sessionModelRef.current = resolvedModel;
            }

            const result = await api.abbenaySessionChat(
                sessionIdRef.current,
                [{ role: 'user', content: text }],
                model,
            );

            if (result.error) {
                setError(result.error);
                setIsStreaming(false);
            } else {
                activeRequestId.current = result.requestId;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsStreaming(false);
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setError(null);
        activeRequestId.current = null;
        sessionIdRef.current = null;
        sessionModelRef.current = null;
        setIsStreaming(false);
    }, []);

    return {
        messages,
        status,
        models,
        isStreaming,
        isUsingTools,
        activeToolName,
        error,
        sendMessage,
        clearMessages,
        connect,
        refreshModels,
    };
}
