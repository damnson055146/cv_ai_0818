import { defineEventHandler, readBody } from 'h3'

/**
 * Convert arbitrary text (TXT/Docx/PDF extracted text) into clean Markdown using /api/ai.
 * - Splits long input into chunks at paragraph boundaries
 * - Sends deterministic prompt instructing the model to output ONLY Markdown
 * - Joins chunk outputs with double newlines
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{
      text?: string
      hint?: 'cv' | 'ps' | 'letter' | 'auto'
      model?: string
      maxTokensPerChunk?: number
    }>(event)

    const raw = String(body?.text || '')
    if (!raw.trim()) {
      return { ok: false, error: 'empty_text' }
    }

    const runtime = useRuntimeConfig(event)
    const defaultModel = 'gpt-4o-mini'
    let model = (body?.model as string) || ((runtime.public as any)?.chatbot?.model || defaultModel)
    // Avoid responses API models that caused 400; force chat-completions friendly model
    if (/^(?:o3|gpt-4\.1-mini-realtime)/i.test(model) || /\/o3-/i.test(model)) {
      model = defaultModel
    }

    const hint = (body?.hint || 'auto') as string
    const maxTokens = Number(body?.maxTokensPerChunk || 1536)

    // chunk roughly by characters using paragraphs to avoid breaking structures
    const MAX_CHARS = 2000 // conservative for 4o-mini; server can retry more
    const paras = raw.split(/\n\n+/)
    const chunks: string[] = []
    let buffer = ''
    for (const p of paras) {
      const add = buffer ? `\n\n${p}` : p
      if ((buffer + add).length > MAX_CHARS) {
        if (buffer) chunks.push(buffer)
        buffer = p
      } else {
        buffer = buffer + add
      }
    }
    if (buffer) chunks.push(buffer)

    const systemPrompt = [
      'You are a professional document formatter.',
      'Convert the given input to clean, valid Markdown ONLY.',
      'Preserve: headings (#), lists, tables (GitHub pipe), links, emphasis, code blocks.',
      'Keep original language and factual content. Do NOT invent content.',
      'Do not add explanations or code fences. Return Markdown only.',
    ].join(' ')

    const hintLine = `Document type hint: ${hint}.`

    const outputs: string[] = []
    for (let i = 0; i < chunks.length; i++) {
      const piece = chunks[i]
      const userPrompt = `${hintLine}\nReturn ONLY Markdown for this chunk ${i + 1}/${chunks.length}.\n\n<INPUT>\n${piece}\n</INPUT>`
      const aiRes: any = await $fetch('/api/ai', {
        method: 'POST',
        body: {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: maxTokens,
        }
      })
      const md = (aiRes?.choices?.[0]?.message?.content || aiRes?.reply || '').toString().trim()
      outputs.push(md || piece)
    }

    const markdown = outputs.join('\n\n')
    return { ok: true, markdown, model }
  } catch (error: any) {
    console.error('[convert-to-md] failed:', error)
    return { ok: false, error: error?.message || 'convert-to-md failed' }
  }
})


