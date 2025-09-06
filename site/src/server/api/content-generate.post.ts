/**
 * Fix-in-Chat Content Generate API（统一走 /api/ai 转发，无模板/Mock）
 */

export default defineEventHandler(async (event) => {
  try {
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
        model: 'gpt-4o-mini',
        // 允许外部透传 model；否则后端会用默认模型
        messages: [
          { role: 'user', content: composed }
        ],
        // 适度增加长度，以容纳段落替换
        max_tokens: 2048,
        temperature: 0.7
      }
    })

    // 兼容两种返回结构
    const content =
      aiRes?.choices?.[0]?.message?.content?.trim?.() ||
      aiRes?.reply ||
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