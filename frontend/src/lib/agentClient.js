const BASE = 'https://matchday-agent-71469276373.us-central1.run.app';
const APP  = 'matchday_pulse';

/**
 * investigate(userMessage, callbacks)
 *
 * 1. Creates a fresh ADK session (POST /apps/:app/users/:u/sessions/:s)
 * 2. Opens the SSE stream       (POST /run_sse)
 * 3. Dispatches each event to the appropriate callback
 *
 * callbacks:
 *   onText(text, { partial })  — agent reasoning / answer text
 *   onToolCall({ name, args }) — agent is calling an MCP tool
 *   onToolResult({ name, output }) — tool returned data
 *   onDone()                   — stream finished cleanly
 *   onError(Error)             — fatal error at any step
 */
export async function investigate(userMessage, callbacks) {
  const userId    = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  // Guard so onDone fires at most once regardless of how the stream ends.
  let finished = false;
  function finish() {
    if (!finished) { finished = true; callbacks.onDone?.(); }
  }

  try {
    // ── Step 1: create session ────────────────────────────────────────────
    const sessionRes = await fetch(
      `${BASE}/apps/${APP}/users/${userId}/sessions/${sessionId}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    '{}',
      }
    );

    if (!sessionRes.ok) {
      const body = await sessionRes.text().catch(() => '');
      throw new Error(`Session creation failed (${sessionRes.status}): ${body}`);
    }

    // ── Step 2: open SSE stream ───────────────────────────────────────────
    const streamRes = await fetch(`${BASE}/run_sse`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        appName:    APP,
        userId,
        sessionId,
        newMessage: {
          role:  'user',
          parts: [{ text: userMessage }],
        },
      }),
    });

    if (!streamRes.ok) {
      const body = await streamRes.text().catch(() => '');
      throw new Error(`Run SSE failed (${streamRes.status}): ${body}`);
    }

    // ── Step 3: read the SSE byte-stream ─────────────────────────────────
    const reader  = streamRes.body.getReader();
    const decoder = new TextDecoder();
    // Buffer holds bytes that haven't yet formed a complete SSE line.
    let buffer = '';

    read: while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Append new bytes; TextDecoder keeps the BOM / continuation state.
      buffer += decoder.decode(value, { stream: true });

      // SSE spec: events are separated by blank lines; each field ends with \n.
      // Split on newlines and keep the last (possibly incomplete) line in buffer.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const raw of lines) {
        const line = raw.trim();

        // Blank line = event boundary; skip.
        // Comment lines begin with ':'; skip.
        if (!line || line.startsWith(':')) continue;

        // Only handle "data:" fields (ignore "event:", "id:", "retry:").
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();

        // Some servers emit "[DONE]" to signal end-of-stream.
        if (payload === '[DONE]') { finish(); break read; }

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          console.warn('[agentClient] non-JSON SSE payload (skipping):', payload);
          continue;
        }

        // ── RAW LOG ── inspect this in DevTools to learn the real shape ──
        console.log('[agentClient] raw event:', JSON.stringify(event, null, 2));

        dispatchEvent(event, callbacks);
      }
    }

    finish();

  } catch (err) {
    console.error('[agentClient] fatal:', err);
    callbacks.onError?.(err);
  }
}

// ── Event dispatcher ─────────────────────────────────────────────────────────
//
// ADK SSE events have this canonical shape:
//
//   {
//     "author": "agent_name",
//     "partial": true,          ← false or absent on the final chunk
//     "content": {
//       "role": "model",        ← or "tool" for function responses
//       "parts": [
//         { "text": "..." },
//         { "functionCall": { "name": "...", "args": {...} } },
//         { "functionResponse": { "name": "...", "response": {...} } }
//       ]
//     }
//   }
//
// We try every known location so the parser survives schema changes.
function dispatchEvent(event, callbacks) {
  const partial = event?.partial ?? false;

  const parts =
    event?.content?.parts ??   // standard ADK
    event?.parts ??            // possible flat variant
    [];

  let handled = false;

  for (const part of parts) {
    // ── Text token ───────────────────────────────────────────────────────
    if (part?.text != null) {
      callbacks.onText?.(part.text, { partial });
      handled = true;
    }

    // ── Function / tool call ─────────────────────────────────────────────
    const fnCall = part?.functionCall ?? part?.function_call;
    if (fnCall) {
      callbacks.onToolCall?.({
        name: fnCall.name ?? fnCall.id   ?? '(unknown tool)',
        args: fnCall.args ?? fnCall.arguments ?? {},
      });
      handled = true;
    }

    // ── Function / tool response ─────────────────────────────────────────
    const fnResp = part?.functionResponse ?? part?.function_response;
    if (fnResp) {
      callbacks.onToolResult?.({
        name:   fnResp.name ?? '(unknown tool)',
        output: fnResp.response ?? fnResp.output ?? fnResp,
      });
      handled = true;
    }
  }

  // ── Fallback: some SDKs surface text at the top level ────────────────
  if (!handled) {
    const text =
      event?.text     ??
      event?.message  ??
      event?.output   ??
      null;

    if (text != null) {
      callbacks.onText?.(String(text), { partial: false });
      return;
    }

    // Nothing matched — warn with the full event so we can add a case.
    const keys = Object.keys(event ?? {});
    if (keys.length > 0) {
      console.warn('[agentClient] unrecognised event shape — add a case for:', keys, event);
    }
  }
}
