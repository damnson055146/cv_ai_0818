export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event) as any;
  const body = await readBody<any>(event);

  const apiKey: string = config.openaiApiKey || config.public?.OPENAI_API_KEY || "";
  if (!apiKey) {
    setResponseStatus(event, 500);
    return { error: 'OPENAI_API_KEY is missing in runtime config' };
  }

  const fallbackModel = (config.public as any)?.chatbot?.model || 'gpt-4.1';
  const model: string = typeof body?.model === 'string' && body.model.trim().length > 0
    ? body.model
    : fallbackModel;
  // Route strictly by model id to avoid accidental mismatches
  const useResponsesApi = /^(o3)/i.test(model);

  // Normalize payload per target API and model quirks
  const payload: any = { ...body, model };
  if (useResponsesApi) {
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
  } else {
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

  const isStream = !!body?.stream;
  // For safety: only allow stream for chat completions (gpt-4.1, gpt-5). If responses API, remove stream
  const allowsStream = !useResponsesApi;
  if (isStream && !allowsStream) {
    delete (payload as any).stream;
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: isStream && allowsStream ? 'text/event-stream' : 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // Non-stream: pass through original response
  if (!isStream || !allowsStream) {
    const contentType = upstream.headers.get('content-type') || '';
    setHeader(event, 'content-type', contentType);
    setResponseStatus(event, upstream.status);
    if (contentType.includes('application/json')) {
      try {
        return await upstream.json();
      } catch {
        return await upstream.text();
      }
    }
    return await upstream.text();
  }

  // Stream (SSE): if upstream did not return SSE, surface JSON/text once
  const upstreamCT = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !upstreamCT.includes('text/event-stream')) {
    setResponseStatus(event, upstream.status);
    const contentType = upstream.headers.get('content-type') || 'application/json';
    setHeader(event, 'content-type', contentType);
    try {
      return await upstream.json();
    } catch {
      return await upstream.text();
    }
  }

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

  // @ts-ignore Nitro runtime helper
  return sendStream(event, stream);
});
