import { defineEventHandler, readBody, setHeader, setResponseStatus, sendStream } from 'h3';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event) as any;
  const reqBody = await readBody<any>(event);

  const apiKey: string = config.openaiApiKey || config.public?.OPENAI_API_KEY || "";
  if (!apiKey) {
    setResponseStatus(event, 500);
    return { error: 'OPENAI_API_KEY is missing in runtime config' };
  }

  // Support both wrapped payload { endpoint, body } and direct OpenAI body
  const endpointHint: string | undefined = typeof reqBody?.endpoint === 'string' ? reqBody.endpoint : undefined;
  const body: any = reqBody?.body ?? reqBody;

  const fallbackModel = (config.public as any)?.chatbot?.model || 'gpt-5';
  let model: string = typeof body?.model === 'string' && String(body.model).trim().length > 0
    ? String(body.model)
    : fallbackModel;
  // Enforce gpt-5 only: normalize any incoming non-gpt-5 model to gpt-5
  if (!/^gpt-5/i.test(model)) {
    model = 'gpt-5';
  }
  if (body?.model !== model) {
    try { body.model = model } catch {}
  }

  // Decide endpoint: prefer explicit endpoint, else infer from model id and payload intent
  // - Also use responses API for gpt-5 when advanced fields present (reasoning/verbosity/response_format)
  const wantsResponses = /(^o3|\/o3-)/i.test(model)
    || (/^gpt-5/i.test(model) && (body?.reasoning || typeof body?.verbosity !== 'undefined' || body?.response_format));
  const useResponsesApi = endpointHint
    ? endpointHint === 'responses'
    : wantsResponses;

  // Normalize payload per target API and model quirks
  const payload: any = { ...body, model };
  // Normalize verbosity/reasoning fields per latest-model guide
  try {
    const allowedEfforts = ['low', 'medium', 'high'];
    const alias: Record<string, string> = { minimal: 'low', default: 'medium', deep: 'high' };
    // Unify reasoning.effort
    if (payload?.reasoning && typeof payload.reasoning.effort === 'string') {
      const incoming = String(payload.reasoning.effort).toLowerCase();
      const effort = allowedEfforts.includes(incoming) ? incoming : (alias[incoming] || 'medium');
      payload.reasoning.effort = effort;
    }
    if (typeof payload?.reasoning_effort === 'string') {
      const incoming = String(payload.reasoning_effort).toLowerCase();
      const effort = allowedEfforts.includes(incoming) ? incoming : (alias[incoming] || 'medium');
      payload.reasoning = payload.reasoning || {};
      payload.reasoning.effort = effort;
      delete payload.reasoning_effort;
    }
    // Normalize verbosity field to allowed values if present
    if (typeof payload?.verbosity === 'string') {
      const v = String(payload.verbosity).toLowerCase();
      if (!['low', 'medium', 'high'].includes(v)) payload.verbosity = 'medium';
    }
  } catch {}
  // Debug log sanitized payload intent
  try {
    const effort = payload?.reasoning?.effort;
    console.log('[api/ai] Forwarding request', {
      model,
      useResponsesApi,
      hasReasoning: !!payload?.reasoning,
      effort
    });
  } catch {}

  if (useResponsesApi) {
    // responses API uses `input` and `max_output_tokens`
    if (!payload.input && Array.isArray(payload.messages)) {
      payload.input = (payload.messages as any[])
        .map((m) => `${String(m.role || 'user').toUpperCase()}: ${m.content}`)
        .join('\n\n');
      delete payload.messages;
    }
    // Prefer explicit max_output_tokens; else map from max_completion_tokens or max_tokens
    if (!payload.max_output_tokens) {
      if (typeof payload.max_completion_tokens === 'number') {
        payload.max_output_tokens = payload.max_completion_tokens;
        delete payload.max_completion_tokens;
        if (payload.max_tokens) delete payload.max_tokens;
      } else if (typeof payload.max_tokens === 'number') {
        payload.max_output_tokens = payload.max_tokens;
        delete payload.max_tokens;
      }
    }
    // Map GPT-5 extras: verbosity moved under text.verbosity per Responses API
    if (typeof payload.verbosity !== 'undefined') {
      payload.text = { ...(payload.text || {}), verbosity: payload.verbosity };
      delete payload.verbosity;
    }
    // responses API does not support stream in our flow
    if (payload.stream) delete payload.stream;
  } else {
    // chat completions: prefer max_completion_tokens for some models
    const isGpt5 = /^gpt-5/i.test(model);
    const isGpt41 = /gpt-4\.1/i.test(model);
    if ((isGpt5 || isGpt41) && payload.max_tokens && !payload.max_completion_tokens) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
    }
    // Ensure a system message exists for better compatibility
    try {
      const msgs = Array.isArray(payload.messages) ? payload.messages : [];
      const hasSystem = msgs.some((m: any) => String(m?.role || '').toLowerCase() === 'system');
      if (!hasSystem && msgs.length > 0) {
        payload.messages = [
          { role: 'system', content: 'You are a helpful assistant. Return only the answer unless instructed otherwise.' },
          ...msgs
        ];
      }
    } catch {}
    if (!payload.messages && typeof payload.input === 'string') {
      payload.messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: String(payload.input) }
      ];
      delete payload.input;
    }
  }

  const url = useResponsesApi
    ? 'https://api.openai.com/v1/responses'
    : 'https://api.openai.com/v1/chat/completions';

  const isStream = !!payload?.stream && !useResponsesApi;

  // Log outgoing request summary (no secrets or long content)
  try {
    const payloadSummary = {
      url,
      model,
      useResponsesApi,
      hasMessages: Array.isArray(payload.messages) ? payload.messages.length : undefined,
      inputLen: typeof payload.input === 'string' ? payload.input.length : undefined,
      max_tokens: payload.max_tokens,
      max_output_tokens: payload.max_output_tokens,
      max_completion_tokens: payload.max_completion_tokens,
      reasoning_effort: payload?.reasoning?.effort || payload?.reasoning_effort,
      stream: !!payload.stream
    } as Record<string, unknown>;
    console.log('[api/ai] Sending upstream request', payloadSummary);
  } catch {}

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: isStream ? 'text/event-stream' : 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // Non-stream or not allowed to stream: pass through original response once
  if (!isStream) {
    const contentType = upstream.headers.get('content-type') || '';
    setHeader(event, 'content-type', contentType);
    setResponseStatus(event, upstream.status);
    if (contentType.includes('application/json')) {
      try {
        const data: any = await upstream.json();
        try {
          console.log('[api/ai] Received upstream response', {
            status: upstream.status,
            model: data?.model || data?.choices?.[0]?.model,
            choices: Array.isArray(data?.choices) ? data.choices.length : undefined,
            usage: data?.usage,
            output_text_len: typeof data?.output_text === 'string' ? data.output_text.length : undefined,
            content_len: typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content.length : undefined
          });
          if (!upstream.ok) {
            console.log('[api/ai] Upstream error details', data?.error || data);
          }
        } catch {}
        return data;
      } catch {
        const txt = await upstream.text();
        try { console.log('[api/ai] Received upstream text', { status: upstream.status, length: txt.length }); } catch {}
        return txt;
      }
    }
    const txt = await upstream.text();
    try { console.log('[api/ai] Received non-JSON upstream', { status: upstream.status, length: txt.length, contentType }); } catch {}
    return txt;
  }

  // If upstream is not SSE, surface JSON/text (avoid double-read in client)
  const upstreamCT = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !upstreamCT.includes('text/event-stream')) {
    setResponseStatus(event, upstream.status);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    setHeader(event, 'content-type', contentType);
    try {
      const data = await upstream.json();
      try {
        console.log('[api/ai] Non-stream upstream response', { status: upstream.status, model: (data as any)?.model, usage: (data as any)?.usage });
      } catch {}
      return data;
    } catch {
      const txt = await upstream.text();
      try { console.log('[api/ai] Non-stream upstream text', { status: upstream.status, length: txt.length }); } catch {}
      return txt;
    }
  }

  try { console.log('[api/ai] Streaming upstream response started', { status: upstream.status, model }); } catch {}

  if (!upstream.body) {
    setResponseStatus(event, 500);
    return 'data: [DONE]\n\n';
  }

  setHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
  setHeader(event, 'Cache-Control', 'no-cache, no-transform');
  setHeader(event, 'Connection', 'keep-alive');
  setHeader(event, 'X-Accel-Buffering', 'no');

  const reader = upstream.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } finally {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    }
  });

  // @ts-ignore Nitro helper
  return sendStream(event, stream);
});
