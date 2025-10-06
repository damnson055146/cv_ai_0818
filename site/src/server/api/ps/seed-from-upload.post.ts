import { defineEventHandler, readBody } from 'h3'

/**
 * Seed PS outline/body suggestions from optional uploaded text (e.g., parsed PDF)
 * Steps:
 * 1) Read default prompts via internal endpoint
 * 2) Build element -> outline -> body with LLM
 * 3) Return plain text suggestions; front-end will show diff confirm before apply
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ chatId?: string; language?: 'zh'|'en'|'sp'; uploadText?: string; projectInfo?: string; studentInfo?: string }>(event)
    const language = (body?.language || 'zh') as 'zh'|'en'|'sp'
    const uploadText = String(body?.uploadText || '')
    const seedInfo = [body?.projectInfo || '', body?.studentInfo || ''].filter(Boolean).join('\n')

    // Load default prompts
    const defaults: any = await $fetch('/api/prompts/ps-defaults')
    if (!(defaults && defaults.status === 'ok')) {
      return { status: 'error', error: 'ps defaults unavailable' }
    }
    const { ps_requirement, guidance_outline, guidance_element } = defaults.data || {}

    // Helper to call FastAPI backend when configured
    const runtime = useRuntimeConfig(event) as any
    const backendBase = (runtime.public?.backendBase || '').toString()
    const aiUrl = backendBase ? backendBase.replace(/\/$/, '') + '/api/ai' : '/api/ai'
    const callAI = async (messages: Array<{ role: 'system'|'user'|'assistant'; content: string }>, maxTokens = 1600) => {
      const res: any = await $fetch(aiUrl, {
        method: 'POST',
        body: {
          model: 'gpt-5', messages,  max_tokens: maxTokens,
          use_agents: true
        }
      })
      const text = (res?.choices?.[0]?.message?.content || res?.reply || '').toString()
      return text
    }

    const getPrompt = async (key: string, fallback: string) => {
      if (!backendBase) return fallback
      try {
        const base = backendBase.replace(/\/$/, '')
        const url = `${base}/api/prompts/${encodeURIComponent(key)}`
        const r: any = await $fetch(url)
        const value = (r && typeof r.value === 'string') ? r.value.trim() : ''
        return value || fallback
      } catch {
        return fallback
      }
    }

    // 1) Build elements (素材整理)
    const elementSystem = await getPrompt('ps_system_element', ['You are preparing materials for a Personal Statement (PS).','Summarize key elements strictly structured by sections: Motivation; Pre-Knowledge; Experience; Why Master\'s; Why This Program; Career Plan.','Return plain text with clear headings and bullet points. Do NOT fabricate info. Leave fields blank if unknown.', (language === 'zh' ? 'Language: Chinese (简体中文).' : 'Language: English.')].join(' '))
    const elementUser = [
      ps_requirement || '',
      guidance_element || '',
      seedInfo ? `\n[SEED]\n${seedInfo}` : '',
      uploadText ? `\n[UPLOAD]\n${uploadText}` : ''
    ].filter(Boolean).join('\n\n')
    const elements = await callAI([
      { role: 'system', content: elementSystem },
      { role: 'user', content: elementUser }
    ])

    // 2) Build outline (基于素材生成大纲)
    const outlineSystem = await getPrompt('ps_system_outline', ['You are drafting a PS outline only. Use clear numbered sections and subsections.','Sections must reflect: Motivation; Pre-Knowledge; Experience; Why Master\'s; Why This Program; Career Plan.','Output concise headings with 1-3 bullet points each. Do not write body paragraphs.', (language === 'zh' ? 'Language: Chinese (简体中文).' : 'Language: English.')].join(' '))
    const outlineUser = [guidance_outline || '', elements || ''].filter(Boolean).join('\n\n')
    const outline = await callAI([
      { role: 'system', content: outlineSystem },
      { role: 'user', content: outlineUser }
    ], 1400)

    // 3) Build body (基于大纲撰写正文（精简版，首版草稿�?
    const bodySystem = await getPrompt('ps_system_body', ['You are writing a Personal Statement body strictly following the provided outline. Keep paragraphs concise.','Do not invent facts; if information is missing, keep generic placeholders or skip that detail.', (language === 'zh' ? 'Language: Chinese (简体中文).' : 'Language: English.')].join(' '))
    const bodyUser = [ps_requirement || '', elements || '', outline || ''].filter(Boolean).join('\n\n')
    const bodyText = await callAI([
      { role: 'system', content: bodySystem },
      { role: 'user', content: bodyUser }
    ], 1800)

    return {
      status: 'ok',
      data: {
        elements,
        outline,
        body: bodyText
      }
    }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'seed-from-upload failed' }
  }
})


