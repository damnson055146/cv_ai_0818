/**
 * Fix-in-Chat Content Generate API（统一走 /api/ai 转发，无模板/Mock）
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Guard: block editing when client declares chat/ask mode and strict flag enabled
    const cfg = useRuntimeConfig(event) as any
    const strict = !!cfg?.public?.chatbot?.strictAskNoEdit
    const modeHeader = (event.node.req.headers['x-chatbot-mode'] || '').toString().toLowerCase().trim()
    if (strict && modeHeader === 'ask') {
      setResponseStatus(event, 409)
      return { success: false, error: 'Chat mode forbids content generation that edits the document' }
    }

    const body = await readBody(event)
    const userPrompt: string = body?.prompt || ''
    const context = body?.context || {}

    // 仅做最小约束：请直接输出“修改后的文本”，不加解释
    const selectedText: string = String(context?.selectedText ?? '')
    const composed = selectedText
      ? `指令: ${userPrompt}\n\n原文:\n${selectedText}\n\n只返回修改后的文本。`
      : `${userPrompt}\n\n只返回修改后的文本。`

    // 统一转发到 /api/ai（由该端点决定使用 responses 还是 chat-completions）
    const aiRes: any = await $fetch('/api/ai', {
      method: 'POST',
      body: {
        model: 'gpt-5',
        // 允许外部透传 model；否则后端会用默认模型
        messages: [
          { role: 'user', content: composed }
        ],
        // 适度增加长度，以容纳段落替换
        max_tokens: 2048
      }
    })

    // 兼容三种返回结构：chat-completions / responses / 纯文本
    function normalizeResponsesOutput(res: any): string {
      if (!res) return ''
      if (typeof res?.output_text === 'string' && res.output_text) return res.output_text
      const outputs = res?.output
      if (Array.isArray(outputs)) {
        const texts: string[] = []
        for (const item of outputs) {
          if (typeof item?.output_text === 'string') texts.push(item.output_text)
          if (typeof item?.text === 'string') texts.push(item.text)
          const contentArr = item?.content
          if (Array.isArray(contentArr)) {
            for (const c of contentArr) {
              if (typeof c?.text === 'string') texts.push(c.text)
              else if (typeof c === 'string') texts.push(c)
            }
          }
        }
        if (texts.length) return texts.join('')
      }
      const content = res?.content || res?.message?.content
      if (Array.isArray(content)) {
        const texts: string[] = []
        for (const c of content) {
          if (typeof c?.text === 'string') texts.push(c.text)
          else if (typeof c === 'string') texts.push(c)
        }
        if (texts.length) return texts.join('')
      }
      return ''
    }

    const content =
      (aiRes?.choices?.[0]?.message?.content?.trim?.() as string) ||
      normalizeResponsesOutput(aiRes) ||
      (aiRes?.reply as string) ||
      (typeof aiRes === 'string' ? aiRes : '')

    if (!content) {
      throw new Error('AI 无有效输出')
    }

    return {
      success: true,
      content,
      method: 'ai-proxy'
    }
  } catch (error: any) {
    console.error('[content-generate] 失败:', error)
    return { success: false, error: error?.message || 'content-generate failed' }
  }
})