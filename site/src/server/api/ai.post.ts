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

  const fallbackModel = (config.public as any)?.chatbot?.model || 'o3';
  const model: string = typeof body?.model === 'string' && String(body.model).trim().length > 0
    ? String(body.model)
    : fallbackModel;

  // Decide endpoint: prefer explicit endpoint, else infer from model id
  const useResponsesApi = endpointHint
    ? endpointHint === 'responses'
    : /(^o3|\/o3-)/i.test(model);

  // Normalize payload per target API and model quirks
  const payload: any = { ...body, model };
  // Normalize any invalid reasoning effort values early to avoid 400s upstream
  try {
    const allowedEfforts = ['low', 'medium', 'high'];
    const alias: Record<string, string> = { minimal: 'low', default: 'medium', deep: 'high' };
    // responses API expects `reasoning: { effort }`
    if (payload?.reasoning && typeof payload.reasoning.effort === 'string') {
      const incoming = String(payload.reasoning.effort).toLowerCase();
      const effort = allowedEfforts.includes(incoming) ? incoming : (alias[incoming] || 'medium');
      if (payload.reasoning.effort !== effort) {
        payload.reasoning.effort = effort;
      }
    }
    // Some clients may mistakenly send `reasoning_effort` (GPT‑5 style)
    if (typeof payload?.reasoning_effort === 'string') {
      const incoming = String(payload.reasoning_effort).toLowerCase();
      const effort = allowedEfforts.includes(incoming) ? incoming : (alias[incoming] || 'medium');
      payload.reasoning = payload.reasoning || {};
      payload.reasoning.effort = effort;
      delete payload.reasoning_effort;
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
    if (payload.max_tokens && !payload.max_output_tokens) {
      payload.max_output_tokens = payload.max_tokens;
      delete payload.max_tokens;
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
