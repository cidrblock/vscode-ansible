# Bug: `SessionChat` gRPC returns `done finishReason=other` with no error details

**Version:** v2026.6.1-alpha
**Environment:** Fedora 43, daemon PID 257948, vertex-claude provider, socket at `/run/user/1000/abbenay/daemon.sock`

## Summary

When a gRPC client calls `SessionChat`, the daemon returns a single chunk `{"done":{"finishReason":"other"}}` with no preceding `error` chunk and no log output. The same model (`vertex-claude/claude-opus-4-6`) works correctly from the Web UI (`/api/sessions/:id/chat`).

## Reproduction

1. Start the daemon (already running, Vertex env vars present in `/proc/<pid>/environ`)
2. Connect a gRPC client using `nice-grpc` + the generated protobuf-ts definitions
3. Call `Register` — succeeds, returns `clientId`
4. Call `CreateSession` with model `vertex-claude/claude-opus-4-6` — succeeds, returns session ID
5. Call `SessionChat` with:
   ```json
   {
     "sessionId": "b3dd2f2d-...",
     "message": {
       "role": "ROLE_USER",
       "content": "hi",
       "toolCalls": [],
       "toolCallId": "",
       "name": ""
     },
     "options": {
       "enableTools": true,
       "toolMode": "auto"
     }
   }
   ```
6. Stream yields exactly one chunk: `{"done":{"finishReason":"other"}}`
7. No `error` chunk is emitted. No log line appears in `/tmp/abbenay.log`.

**Observed in first session (before code changes):** The first `SessionChat` message ("hi") in a new session succeeded (`text` + `done reason=stop`). The second message in the same session returned `done reason=other`. After restarting Studio, even the first message in a brand-new session returns `done reason=other`.

**Web UI comparison:** The same model works from the Web UI dashboard:
```
[Web] Starting Chat stream: vertex-claude/claude-opus-4-6 chatId=6ef3df57-... messages: 2 tools: 0 registry: 31 toolMode: auto
```

## Root cause analysis

Traced through the daemon source (`abbenay-rd` repo):

1. `SessionChat` handler (`abbenay-service.ts:1110`) calls `state.chat(session.model, allMessages, ...)` at line 1185
2. `DaemonState.chat()` (`state.ts:126`) delegates to `CoreState.chat()` (`state.ts:515`)
3. `CoreState.chat()` calls `streamChat()` (`engines.ts:858`)
4. `streamChat()` calls Vercel AI SDK `streamText()` and iterates `result.fullStream`
5. The SDK yields `{ type: 'finish', finishReason: 'other' }` — mapped to `{ type: 'done', finishReason: 'other' }` at line 988

The issue is that `streamChat()` has no logging for the `finish` case, and the daemon's verbose logging uses the `debug` npm package (not `console.log`), so nothing appears in the log unless `DEBUG=*` is set.

## Two problems

### 1. Silent failure

When `finishReason` is `'other'`, no `error` chunk is emitted and nothing is logged. The gRPC client receives `done/other` with no way to diagnose the cause. The catch block at `engines.ts:997` is not reached because the SDK doesn't throw — it yields `finish(other)`.

### 2. No error propagation from Vercel AI SDK

The underlying reason the SDK returns `other` is lost. It could be an API error, auth failure, rate limit, or malformed request — but none of that information reaches the gRPC client.

## Suggested fix

In `engines.ts` around line 987:
```typescript
case 'finish':
  if (part.finishReason === 'other' && !gotContent) {
    console.error(`[Adapter] Stream finished with reason "other" and no content for ${engineId}/${engineModelId}`);
    yield { type: 'error', error: `Model returned no response (finishReason: other). This usually indicates a provider-side error.` };
  }
  yield { type: 'done', finishReason: part.finishReason || 'stop' };
  return;
```

And in `SessionChat` (`abbenay-service.ts`), add a log before calling `state.chat()`:
```typescript
console.log(`[gRPC] SessionChat: session=${sessionId}, model=${session.model}, messages=${allMessages.length}, toolMode=${toolMode}`);
```

This would make it diagnosable without requiring `DEBUG=*`.

## Additional observation: MCP server registration instability

The MCP server registration shows intermittent behavior — sometimes connecting with 31 tools, sometimes with 0, followed by disconnections:
```
[McpClientPool] Dynamic server 'ansible-studio' connected (31 tools, scope={})
[McpClientPool] Dynamic server 'ansible-studio' connected (0 tools, scope={})
[McpClientPool] Disconnected from ansible-studio
[McpClientPool] Disconnected from ansible-studio
```

This may be related if the daemon's internal state becomes inconsistent after MCP server churn.

## Daemon process environment (confirmed present)

```
ANTHROPIC_VERTEX_PROJECT_ID=itpc-gcp-ansible-pe-eng-claude
CLAUDE_CODE_USE_VERTEX=1
CLOUD_ML_REGION=us-east5
GOOGLE_VERTEX_LOCATION=us-east5
GOOGLE_VERTEX_PROJECT=itpc-gcp-ansible-pe-eng-claude
```
