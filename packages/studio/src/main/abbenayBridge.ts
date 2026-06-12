/**
 * IPC bridge for Abbenay AI daemon communication.
 * Registers handlers that the renderer invokes, and pushes streaming
 * chat chunks via webContents.send().
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import type { ChatChunkData, AbbenayModelInfo, SessionInfo } from '../shared/types';
import { getAbbenayClient, disposeAbbenayClient } from './abbenayClient';
import { loadSettings } from './settingsStore';
import type { ChatChunk as ProtoChatChunk } from './proto/abbenay/v1/service';
import { Role, ChatChunk as ChatChunkCodec } from './proto/abbenay/v1/service';

const MCP_SERVER_ID = 'ansible-studio';

let requestCounter = 0;

function nextRequestId(): string {
    return `req-${Date.now()}-${++requestCounter}`;
}

function mapRole(role: string): Role {
    switch (role) {
        case 'system': return Role.ROLE_SYSTEM;
        case 'user': return Role.ROLE_USER;
        case 'assistant': return Role.ROLE_ASSISTANT;
        case 'tool': return Role.ROLE_TOOL;
        default: return Role.ROLE_USER;
    }
}

function mapChunk(chunk: ProtoChatChunk, requestId: string): ChatChunkData {
    const base: ChatChunkData = { requestId, type: 'text' };
    const c = chunk.chunk;
    if (!c) return base;

    switch (c.$case) {
        case 'text':
            return { ...base, type: 'text', text: c.text.text };
        case 'toolCall':
            return {
                ...base,
                type: 'tool_call',
                toolName: c.toolCall.name,
                toolArgs: c.toolCall.arguments,
                toolCallId: c.toolCall.id,
            };
        case 'toolResult':
            return {
                ...base,
                type: 'tool_result',
                toolCallId: c.toolResult.toolCallId,
                toolContent: c.toolResult.content,
                toolIsError: c.toolResult.isError,
            };
        case 'usage':
            return {
                ...base,
                type: 'usage',
                promptTokens: c.usage.promptTokens,
                completionTokens: c.usage.completionTokens,
            };
        case 'error':
            return {
                ...base,
                type: 'error',
                errorCode: c.error.code,
                errorMessage: c.error.message,
            };
        case 'done':
            return {
                ...base,
                type: 'done',
                finishReason: c.done.finishReason,
            };
        default:
            return base;
    }
}

function sendToRenderer(channel: string, data: unknown): void {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, data);
        }
    }
}

async function resolveModel(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const settings = loadSettings();
    if (settings.abbenayModel) return settings.abbenayModel;
    const client = getAbbenayClient();
    if (client.isConnected()) {
        try {
            const models = await client.listModels();
            if (models.length > 0) return models[0].id;
        } catch { /* fall through */ }
    }
    return '';
}

    let mcpRegistered = false;
    let connectInProgress: Promise<{ ok: boolean; error?: string }> | null = null;

export function registerAbbenayHandlers(): void {
    const client = getAbbenayClient();

    ipcMain.handle(IPC_CHANNELS.ABBENAY_CONNECT, async () => {
        // Prevent concurrent connect calls (auto-connect + UI can race)
        if (connectInProgress) {
            console.log('[abbenay-bridge] Connect already in progress, waiting...');
            return connectInProgress;
        }

        const doConnect = async (): Promise<{ ok: boolean; error?: string }> => {
            try {
                await client.connect({ autoStart: true });

                // Register this client with the daemon (required for tool backchannel)
                try {
                    const clientId = await client.register(process.cwd());
                    console.log(`[abbenay-bridge] Registered with daemon, clientId=${clientId}`);
                } catch (regErr) {
                    console.warn('[abbenay-bridge] Client registration failed:', regErr);
                }

                // Register the Ansible MCP server once per connection
                if (!mcpRegistered) {
                    try {
                        try { await client.unregisterMcpServer(MCP_SERVER_ID); } catch { /* not registered yet */ }
                        const mcpServerScript = path.resolve(__dirname, 'mcp-server.js');
                        console.log(`[abbenay-bridge] Registering MCP server: ${process.execPath} ${mcpServerScript}`);
                        await client.registerMcpServer({
                            serverId: MCP_SERVER_ID,
                            transport: {
                                type: 'stdio',
                                command: process.execPath,
                                args: [mcpServerScript],
                            },
                        });
                        mcpRegistered = true;
                        // Give the MCP server time to initialize and expose tools
                        await new Promise((r) => setTimeout(r, 2000));
                        console.log('[abbenay-bridge] MCP server registered, waited for init');
                    } catch (mcpErr) {
                        console.warn('[abbenay-bridge] Failed to register MCP server:', mcpErr);
                    }
                } else {
                    console.log('[abbenay-bridge] MCP server already registered, skipping');
                }

                return { ok: true };
            } catch (err) {
                return { ok: false, error: err instanceof Error ? err.message : String(err) };
            }
        };

        connectInProgress = doConnect();
        try {
            return await connectInProgress;
        } finally {
            connectInProgress = null;
        }
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_DISCONNECT, async () => {
        try { await client.unregisterMcpServer(MCP_SERVER_ID); } catch { /* ok */ }
        mcpRegistered = false;
        disposeAbbenayClient();
        return { ok: true };
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_STATUS, async () => {
        return client.getStatus();
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_LIST_MODELS, async () => {
        if (!client.isConnected()) return [];
        try {
            const models = await client.listModels();
            return models.map((m): AbbenayModelInfo => ({
                id: m.id,
                provider: m.provider,
                name: m.name,
                engine: m.engine,
            }));
        } catch {
            return [];
        }
    });

    ipcMain.handle(
        IPC_CHANNELS.ABBENAY_CHAT,
        async (_event, messages: Array<{ role: string; content: string }>, model?: string) => {
            const requestId = nextRequestId();
            console.log(`[abbenay-bridge] Chat request ${requestId}: ${messages.length} messages, model=${model ?? '(auto)'}`);
            try {
                if (!client.isConnected()) {
                    console.log('[abbenay-bridge] Not connected, attempting connect...');
                    await client.connect({ autoStart: true });
                }
                const resolvedModel = await resolveModel(model);
                console.log(`[abbenay-bridge] Resolved model: ${resolvedModel}`);

                // Only send the last user message for stateless chat
                // (multi-turn context should use sessionChat instead)
                const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
                const protoMessages = lastUserMsg
                    ? [{ role: mapRole('user'), content: lastUserMsg.content }]
                    : messages.map((m) => ({ role: mapRole(m.role), content: m.content }));

                console.log(`[abbenay-bridge] Sending ${protoMessages.length} proto messages, first role=${protoMessages[0]?.role}, content length=${protoMessages[0]?.content?.length}`);

                const stream = client.chat({
                    model: resolvedModel,
                    messages: protoMessages,
                    options: {
                        enableTools: true,
                        toolMode: 'auto',
                    },
                });

                void (async () => {
                    let chunkCount = 0;
                    try {
                        for await (const chunk of stream) {
                            chunkCount++;
                            const mapped = mapChunk(chunk, requestId);
                            if (chunkCount <= 3 || mapped.type !== 'text') {
                                const extra = mapped.type === 'done' ? ` reason=${mapped.finishReason}` : mapped.type === 'error' ? ` err=${mapped.errorMessage}` : '';
                                console.log(`[abbenay-bridge] Chunk #${chunkCount} type=${mapped.type}${extra}`);
                            }
                            sendToRenderer(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, mapped);
                        }
                        console.log(`[abbenay-bridge] Stream complete: ${chunkCount} chunks`);
                    } catch (err) {
                        console.error(`[abbenay-bridge] Stream error after ${chunkCount} chunks:`, err);
                        sendToRenderer(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, {
                            requestId,
                            type: 'error',
                            errorMessage: err instanceof Error ? err.message : String(err),
                        } satisfies ChatChunkData);
                    }
                })();

                console.log(`[abbenay-bridge] Returning requestId=${requestId}`);
                return { requestId };
            } catch (err) {
                console.error('[abbenay-bridge] Chat error:', err);
                return { requestId, error: err instanceof Error ? err.message : String(err) };
            }
        },
    );

    ipcMain.handle(
        IPC_CHANNELS.ABBENAY_SESSION_CHAT,
        async (
            _event,
            sessionId: string,
            messages: Array<{ role: string; content: string }>,
            _model?: string,
        ) => {
            const requestId = nextRequestId();
            const lastMsg = messages[messages.length - 1];
            console.log(`[abbenay-bridge] SessionChat ${requestId}: session=${sessionId}, msgs=${messages.length}, content="${lastMsg?.content?.slice(0, 80)}"`);
            try {
                const request = {
                    sessionId,
                    message: lastMsg ? {
                        role: mapRole(lastMsg.role),
                        content: lastMsg.content,
                        toolCalls: [],
                        toolCallId: '',
                        name: '',
                    } : undefined,
                    options: {
                        enableTools: true,
                        toolMode: 'auto',
                    },
                };
                console.log(`[abbenay-bridge] SessionChat ${requestId}: request=`, JSON.stringify(request, null, 2));

                const stream = client.sessionChat(request);

                void (async () => {
                    let chunkCount = 0;
                    try {
                        console.log(`[abbenay-bridge] SessionChat ${requestId}: entering stream loop`);
                        for await (const chunk of stream) {
                            chunkCount++;
                            // Log raw chunk as JSON for debugging
                            try {
                                const rawJson = ChatChunkCodec.toJSON(chunk);
                                console.log(`[abbenay-bridge] SessionChat ${requestId} RAW chunk #${chunkCount}:`, JSON.stringify(rawJson));
                            } catch { /* serialization failed, log what we can */ }

                            const mapped = mapChunk(chunk, requestId);
                            const extra = mapped.type === 'done' ? ` reason=${mapped.finishReason}`
                                : mapped.type === 'error' ? ` err=${mapped.errorMessage}`
                                : mapped.type === 'tool_call' ? ` tool=${mapped.toolName}`
                                : mapped.type === 'text' ? ` len=${mapped.text?.length ?? 0}`
                                : '';
                            console.log(`[abbenay-bridge] SessionChat ${requestId} chunk #${chunkCount} type=${mapped.type}${extra}`);

                            // Surface "done reason=other" as an error so the UI shows feedback
                            if (mapped.type === 'done' && mapped.finishReason !== 'stop' && mapped.finishReason !== 'length' && mapped.finishReason !== 'tool_calls') {
                                if (chunkCount === 1) {
                                    sendToRenderer(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, {
                                        requestId,
                                        type: 'error',
                                        errorMessage: `AI request failed (reason: ${mapped.finishReason}). Check Abbenay daemon logs at /tmp/abbenay.log for details.`,
                                    } satisfies ChatChunkData);
                                }
                            }

                            sendToRenderer(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, mapped);
                        }
                        console.log(`[abbenay-bridge] SessionChat ${requestId}: stream complete, ${chunkCount} chunks`);
                    } catch (err) {
                        console.error(`[abbenay-bridge] SessionChat ${requestId}: stream error after ${chunkCount} chunks:`, err);
                        sendToRenderer(IPC_CHANNELS.ABBENAY_CHAT_CHUNK, {
                            requestId,
                            type: 'error',
                            errorMessage: err instanceof Error ? err.message : String(err),
                        } satisfies ChatChunkData);
                    }
                })();

                console.log(`[abbenay-bridge] SessionChat ${requestId}: returning`);
                return { requestId };
            } catch (err) {
                console.error(`[abbenay-bridge] SessionChat error:`, err);
                return { requestId, error: err instanceof Error ? err.message : String(err) };
            }
        },
    );

    ipcMain.handle(IPC_CHANNELS.ABBENAY_CREATE_SESSION, async (_event, model: string, topic?: string) => {
        const resolvedModel = model || (await resolveModel());
        console.log(`[abbenay-bridge] CreateSession: model=${resolvedModel}, topic=${topic}`);
        const session = await client.createSession(resolvedModel, topic);
        return {
            id: session.id,
            model: session.model,
            topic: session.topic,
            messageCount: session.messages.length,
            updatedAt: session.updatedAt?.seconds?.toString() ?? '',
        } satisfies SessionInfo;
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_LIST_SESSIONS, async () => {
        if (!client.isConnected()) return [];
        try {
            const sessions = await client.listSessions();
            return sessions.map((s): SessionInfo => ({
                id: s.id,
                model: s.model,
                topic: s.topic,
                messageCount: s.messageCount,
                updatedAt: s.updatedAt?.seconds?.toString() ?? '',
            }));
        } catch {
            return [];
        }
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_DELETE_SESSION, async (_event, sessionId: string) => {
        await client.deleteSession(sessionId);
        return { ok: true };
    });

    ipcMain.handle(IPC_CHANNELS.ABBENAY_START_WEB_UI, async () => {
        if (!client.isConnected()) {
            return { ok: false, error: 'Not connected to Abbenay daemon' };
        }
        try {
            const { url, alreadyRunning } = await client.startWebServer();
            const { shell } = await import('electron');
            void shell.openExternal(url);
            return { ok: true, url, alreadyRunning };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
    });
}
