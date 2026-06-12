/**
 * Right-side sliding chat panel for interactive Abbenay AI conversations.
 * Resizable via drag handle on the left edge. Renders markdown responses.
 */

import React, { useState, useRef, useEffect, useCallback, type ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAbbenayChat, type DisplayMessage } from '../hooks/useAbbenayChat';
import type { AbbenayModelInfo } from '../../shared/types';

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 480;

const THINKING_CSS = `
@keyframes navita-pulse {
  0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
@keyframes navita-chat-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

// ---------------------------------------------------------------------------
// ChatPanel (outer shell: slide-in overlay)
// ---------------------------------------------------------------------------

interface ChatPanelProps {
    open: boolean;
    onClose: () => void;
    models: AbbenayModelInfo[];
    selectedModel: string;
    onModelChange: (modelId: string) => void;
    pendingPrompt: string | null;
    onPromptConsumed: () => void;
}

export function ChatPanel({ open, onClose, models, selectedModel, onModelChange, pendingPrompt, onPromptConsumed }: ChatPanelProps): React.JSX.Element | null {
    const chat = useAbbenayChat();
    const [input, setInput] = useState('');
    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dragging = useRef(false);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chat.messages]);

    useEffect(() => {
        if (open && !pendingPrompt) inputRef.current?.focus();
    }, [open, pendingPrompt]);

    useEffect(() => {
        if (pendingPrompt && open && !chat.isStreaming) {
            void chat.sendMessage(pendingPrompt, selectedModel || undefined);
            onPromptConsumed();
        }
    }, [pendingPrompt, open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || chat.isStreaming) return;
        setInput('');
        void chat.sendMessage(text, selectedModel || undefined);
    }, [input, chat, selectedModel]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    // --- Resize via drag handle ---
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        const startX = e.clientX;
        const startW = width;

        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const delta = startX - ev.clientX;
            setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + delta)));
        };
        const onUp = () => {
            dragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [width]);

    if (!open) return null;

    return (
        <div style={{ ...panelStyles.panel, width: `${width}px` }}>
            <style>{THINKING_CSS}</style>
            <div
                style={panelStyles.resizeHandle}
                onMouseDown={handleDragStart}
            />
            <div style={panelStyles.header}>
                <span style={panelStyles.headerTitle}>Chat</span>
                <div style={panelStyles.headerActions}>
                    <select
                        style={panelStyles.modelSelect}
                        value={selectedModel}
                        onChange={(e) => onModelChange(e.target.value)}
                    >
                        <option value="">Auto</option>
                        {models.map((m) => (
                            <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                    </select>
                    <button
                        style={panelStyles.iconBtn}
                        onClick={() => chat.clearMessages()}
                        title="New conversation"
                    >
                        +
                    </button>
                    <button style={panelStyles.iconBtn} onClick={onClose} title="Close">
                        <svg width="10" height="10" viewBox="0 0 10 10">
                            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
                            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                    </button>
                </div>
            </div>

            <div style={panelStyles.messageList}>
                {chat.messages.length === 0 && (
                    <div style={panelStyles.emptyState}>
                        Ask a question about your Ansible project...
                    </div>
                )}
                {chat.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                ))}
                {chat.isStreaming && chat.isUsingTools && (
                    <div style={panelStyles.toolIndicator}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                            <path d="M14.5 6.5L10 2 8.5 3.5 10 5 5 10l-1.5-1.5L2 10l4.5 4.5L8 13l-1.5-1.5 5-5 1.5 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        </svg>
                        <span>{chat.activeToolName ? <>Running <code style={{ fontFamily: 'var(--navita-font-mono)', fontSize: '0.9em' }}>{chat.activeToolName}</code></> : 'Using tools...'}</span>
                        <span style={panelStyles.dot1} />
                        <span style={panelStyles.dot2} />
                        <span style={panelStyles.dot3} />
                    </div>
                )}
                {chat.isStreaming && !chat.isUsingTools && (!chat.messages.length || !chat.messages[chat.messages.length - 1]?.isStreaming) && (
                    <div style={panelStyles.thinkingRow}>
                        <div style={panelStyles.thinkingDots}>
                            <span style={panelStyles.dot1} />
                            <span style={panelStyles.dot2} />
                            <span style={panelStyles.dot3} />
                        </div>
                    </div>
                )}
                {chat.error && (
                    <div style={panelStyles.errorBanner}>{chat.error}</div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={panelStyles.inputArea}>
                <textarea
                    ref={inputRef}
                    style={panelStyles.textarea}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    rows={2}
                    disabled={chat.isStreaming}
                />
                <button
                    style={{
                        ...panelStyles.sendBtn,
                        opacity: input.trim() && !chat.isStreaming ? 1 : 0.4,
                    }}
                    onClick={handleSend}
                    disabled={!input.trim() || chat.isStreaming}
                >
                    {chat.isStreaming ? '...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Markdown renderers
// ---------------------------------------------------------------------------

const mdComponents: Record<string, React.FC<ComponentPropsWithoutRef<any>>> = {
    p: ({ children, ...props }) => <p style={mdStyles.p} {...props}>{children}</p>,
    h1: ({ children, ...props }) => <h1 style={mdStyles.h1} {...props}>{children}</h1>,
    h2: ({ children, ...props }) => <h2 style={mdStyles.h2} {...props}>{children}</h2>,
    h3: ({ children, ...props }) => <h3 style={mdStyles.h3} {...props}>{children}</h3>,
    ul: ({ children, ...props }) => <ul style={mdStyles.ul} {...props}>{children}</ul>,
    ol: ({ children, ...props }) => <ol style={mdStyles.ol} {...props}>{children}</ol>,
    li: ({ children, ...props }) => <li style={mdStyles.li} {...props}>{children}</li>,
    strong: ({ children, ...props }) => <strong style={mdStyles.strong} {...props}>{children}</strong>,
    table: ({ children, ...props }) => (
        <div style={mdStyles.tableWrap}><table style={mdStyles.table} {...props}>{children}</table></div>
    ),
    th: ({ children, ...props }) => <th style={mdStyles.th} {...props}>{children}</th>,
    td: ({ children, ...props }) => <td style={mdStyles.td} {...props}>{children}</td>,
    code: ({ children, className, ...props }) => {
        const isBlock = className?.startsWith('language-');
        if (isBlock) {
            return <code style={mdStyles.codeBlock} {...props}>{children}</code>;
        }
        return <code style={mdStyles.codeInline} {...props}>{children}</code>;
    },
    pre: ({ children, ...props }) => <pre style={mdStyles.pre} {...props}>{children}</pre>,
    blockquote: ({ children, ...props }) => <blockquote style={mdStyles.blockquote} {...props}>{children}</blockquote>,
    hr: (props) => <hr style={mdStyles.hr} {...props} />,
};

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: DisplayMessage }): React.JSX.Element {
    const isUser = message.role === 'user';
    const isTool = message.role === 'tool';

    return (
        <div style={{ ...msgStyles.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            <div
                style={{
                    ...msgStyles.bubble,
                    background: isUser
                        ? 'var(--navita-text-primary)'
                        : isTool
                            ? 'var(--navita-bg-primary)'
                            : 'transparent',
                    color: isUser ? 'var(--navita-text-inverse)' : 'var(--navita-text-primary)',
                    border: isTool ? '1px solid var(--navita-border)' : 'none',
                    maxWidth: isUser ? '85%' : '100%',
                    padding: isUser ? '8px 12px' : '4px 0',
                }}
            >
                {isTool && <div style={msgStyles.toolLabel}>Tool result</div>}

                {isUser ? (
                    <div style={msgStyles.plainText}>{message.content}</div>
                ) : (
                    <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {message.content}
                    </Markdown>
                )}

                {message.toolCalls?.map((tc) => (
                    <div key={tc.id} style={msgStyles.toolCallBlock}>
                        <div style={msgStyles.toolCallName}>{tc.name}</div>
                        <pre style={msgStyles.toolCallArgs}>{tc.args}</pre>
                    </div>
                ))}
                {message.isStreaming && <span style={msgStyles.cursor}>|</span>}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyles: Record<string, React.CSSProperties> = {
    panel: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        background: 'var(--navita-bg-secondary)',
        borderLeft: '1px solid var(--navita-border)',
        position: 'relative',
        animation: 'navita-chat-in 200ms ease-out',
    },
    resizeHandle: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '5px',
        height: '100%',
        cursor: 'col-resize',
        zIndex: 1,
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '38px',
        padding: '0 12px',
        borderBottom: '1px solid var(--navita-border)',
        flexShrink: 0,
    },
    headerTitle: {
        fontWeight: 600,
        fontSize: 'var(--navita-font-size-sm)',
        color: 'var(--navita-text-primary)',
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
    },
    modelSelect: {
        padding: '2px 6px',
        fontSize: 'var(--navita-font-size-xs)',
        background: 'var(--navita-bg-tertiary)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-sm)',
        color: 'var(--navita-text-secondary)',
        maxWidth: '180px',
    },
    iconBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        background: 'none',
        border: 'none',
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-sm)',
        cursor: 'pointer',
        borderRadius: 'var(--navita-radius-sm)',
    },
    messageList: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    emptyState: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--navita-text-tertiary)',
        fontSize: 'var(--navita-font-size-sm)',
        textAlign: 'center',
        padding: '40px 20px',
    },
    thinkingRow: {
        display: 'flex',
        padding: '4px 0',
    },
    thinkingDots: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: 'var(--navita-bg-tertiary)',
    },
    dot1: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'var(--navita-text-tertiary)',
        animation: 'navita-pulse 1.4s infinite ease-in-out',
        animationDelay: '0s',
    } as React.CSSProperties,
    dot2: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'var(--navita-text-tertiary)',
        animation: 'navita-pulse 1.4s infinite ease-in-out',
        animationDelay: '0.2s',
    } as React.CSSProperties,
    dot3: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: 'var(--navita-text-tertiary)',
        animation: 'navita-pulse 1.4s infinite ease-in-out',
        animationDelay: '0.4s',
    } as React.CSSProperties,
    toolIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '10px',
        background: 'var(--navita-bg-tertiary)',
        color: 'var(--navita-text-secondary)',
        fontSize: 'var(--navita-font-size-xs)',
        fontWeight: 500,
        width: 'fit-content',
    },
    errorBanner: {
        padding: '6px 10px',
        borderRadius: 'var(--navita-radius-sm)',
        background: 'var(--navita-error-subtle, rgba(255,60,60,0.1))',
        color: 'var(--navita-error, #e55)',
        fontSize: 'var(--navita-font-size-xs)',
    },
    inputArea: {
        display: 'flex',
        gap: '8px',
        padding: '10px 12px',
        borderTop: '1px solid var(--navita-border)',
        alignItems: 'flex-end',
        flexShrink: 0,
    },
    textarea: {
        flex: 1,
        padding: '8px 10px',
        fontSize: 'var(--navita-font-size-sm)',
        fontFamily: 'var(--navita-font-sans)',
        background: 'var(--navita-bg-tertiary)',
        border: '1px solid var(--navita-border)',
        borderRadius: 'var(--navita-radius-sm)',
        color: 'var(--navita-text-primary)',
        resize: 'none',
        outline: 'none',
        lineHeight: 1.4,
    },
    sendBtn: {
        padding: '8px 14px',
        background: 'var(--navita-text-primary)',
        color: 'var(--navita-text-inverse)',
        border: 'none',
        borderRadius: 'var(--navita-radius-sm)',
        fontSize: 'var(--navita-font-size-sm)',
        fontWeight: 500,
        cursor: 'pointer',
        flexShrink: 0,
    },
};

const msgStyles: Record<string, React.CSSProperties> = {
    row: {
        display: 'flex',
        width: '100%',
    },
    bubble: {
        borderRadius: '10px',
        fontSize: 'var(--navita-font-size-sm)',
        lineHeight: 1.6,
        wordBreak: 'break-word',
        overflow: 'hidden',
    },
    plainText: {
        whiteSpace: 'pre-wrap',
    },
    toolLabel: {
        fontSize: 'var(--navita-font-size-xs)',
        color: 'var(--navita-text-tertiary)',
        fontWeight: 500,
        marginBottom: '2px',
    },
    toolCallBlock: {
        marginTop: '6px',
        padding: '6px 8px',
        background: 'var(--navita-bg-primary)',
        borderRadius: 'var(--navita-radius-sm)',
        border: '1px solid var(--navita-border)',
    },
    toolCallName: {
        fontSize: 'var(--navita-font-size-xs)',
        fontWeight: 600,
        color: 'var(--navita-text-secondary)',
        fontFamily: 'var(--navita-font-mono)',
    },
    toolCallArgs: {
        fontSize: '11px',
        fontFamily: 'var(--navita-font-mono)',
        color: 'var(--navita-text-tertiary)',
        margin: '2px 0 0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
    },
    cursor: {
        display: 'inline-block',
        fontWeight: 100,
        color: 'var(--navita-text-tertiary)',
    },
};

const mdStyles: Record<string, React.CSSProperties> = {
    p: { margin: '0 0 8px' },
    h1: { fontSize: 'var(--navita-font-size-lg)', fontWeight: 700, margin: '12px 0 6px', borderBottom: '1px solid var(--navita-border)', paddingBottom: '4px' },
    h2: { fontSize: 'var(--navita-font-size-md)', fontWeight: 600, margin: '10px 0 4px' },
    h3: { fontSize: 'var(--navita-font-size-sm)', fontWeight: 600, margin: '8px 0 4px' },
    ul: { margin: '0 0 8px', paddingLeft: '20px' },
    ol: { margin: '0 0 8px', paddingLeft: '20px' },
    li: { marginBottom: '2px' },
    strong: { fontWeight: 600 },
    tableWrap: { overflowX: 'auto', margin: '8px 0' },
    table: { borderCollapse: 'collapse', width: '100%', fontSize: 'var(--navita-font-size-xs)' },
    th: { textAlign: 'left', padding: '4px 8px', borderBottom: '2px solid var(--navita-border)', fontWeight: 600, color: 'var(--navita-text-secondary)' },
    td: { padding: '4px 8px', borderBottom: '1px solid var(--navita-border)' },
    codeInline: {
        fontFamily: 'var(--navita-font-mono)',
        fontSize: '0.9em',
        padding: '1px 4px',
        borderRadius: '3px',
        background: 'var(--navita-bg-tertiary)',
    },
    codeBlock: {
        fontFamily: 'var(--navita-font-mono)',
        fontSize: 'var(--navita-font-size-xs)',
        display: 'block',
    },
    pre: {
        padding: '10px 12px',
        background: 'var(--navita-bg-tertiary)',
        borderRadius: 'var(--navita-radius-sm)',
        border: '1px solid var(--navita-border)',
        overflow: 'auto',
        margin: '6px 0',
        lineHeight: 1.5,
        fontSize: 'var(--navita-font-size-xs)',
    },
    blockquote: {
        borderLeft: '3px solid var(--navita-border)',
        margin: '6px 0',
        padding: '2px 12px',
        color: 'var(--navita-text-secondary)',
    },
    hr: {
        border: 'none',
        borderTop: '1px solid var(--navita-border)',
        margin: '10px 0',
    },
};
