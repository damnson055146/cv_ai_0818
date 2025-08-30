/**
 * 硅基流动API接口（放在 src/server/api，确保在设置了 srcDir 时被 Nuxt/Nitro 识别）
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event) as any
  const body = await readBody<any>(event)

  const siliconFlowApiKey = config.siliconFlowApiKey || config.public?.SILICON_FLOW_API_KEY || ""
  if (!siliconFlowApiKey) {
    setResponseStatus(event, 500)
    return { error: 'SILICON_FLOW_API_KEY is missing in runtime config' }
  }

  const siliconFlowBaseUrl = config.public?.siliconFlowBaseUrl || "https://api.siliconflow.cn/v1"
  const defaultModel = config.public?.siliconFlowModel || "Qwen/Qwen2.5-7B-Instruct"

  try {
    const payload = {
      model: body.model || defaultModel,
      messages: body.messages || [
        { role: 'user', content: body.input || body.prompt || '' }
      ],
      temperature: body.temperature || 0.1,
      max_tokens: body.max_tokens || 1024,
      stream: false
    }

    const response = await fetch(`${siliconFlowBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${siliconFlowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      setResponseStatus(event, response.status)
      return { error: `SiliconFlow API error: ${response.status}`, details: errorText, statusCode: response.status, isApiError: true }
    }

    const data = await response.json()
    return data

  } catch (error) {
    setResponseStatus(event, 500)
    return { error: 'SiliconFlow request failed', details: error instanceof Error ? error.message : String(error) }
  }
})


