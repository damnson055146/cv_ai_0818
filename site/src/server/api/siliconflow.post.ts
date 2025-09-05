/**
 * 硅基流动API接口
 * 用于小LLM模型的快速推理，主要用于意图识别和范围判断
 */

import { defineEventHandler, readBody, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event) as any
  const body = await readBody<any>(event)

  // 硅基流动API配置
  const siliconFlowApiKey = config.siliconFlowApiKey || config.public?.SILICON_FLOW_API_KEY || ""
  if (!siliconFlowApiKey) {
    setResponseStatus(event, 500)
    return { error: 'SILICON_FLOW_API_KEY is missing in runtime config' }
  }

  const siliconFlowBaseUrl = config.public?.siliconFlowBaseUrl || "https://api.siliconflow.cn/v1"
  
  // 默认使用小模型进行快速推理
  const defaultModel = config.public?.siliconFlowModel || "Qwen/Qwen2.5-7B-Instruct"
  
  try {
    const payload = {
      model: body.model || defaultModel,
      messages: body.messages || [
        {
          role: "user",
          content: body.input || body.prompt || ""
        }
      ],
      temperature: body.temperature || 0.1, // 较低的温度保证一致性
      max_tokens: body.max_tokens || 1024,
      stream: false // 不使用流式输出，保持简单
    }

    console.log(`[SiliconFlow] 调用API:`, {
      model: payload.model,
      messageCount: payload.messages.length,
      inputLength: payload.messages[0]?.content?.length || 0
    })

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
      console.error(`[SiliconFlow] API错误:`, response.status, errorText)
      setResponseStatus(event, response.status)
      
      // 返回标准的错误响应格式，便于前端识别
      return { 
        error: `SiliconFlow API error: ${response.status}`,
        details: errorText,
        statusCode: response.status,
        isApiError: true
      }
    }

    const data = await response.json()
    
    console.log(`[SiliconFlow] API响应成功:`, {
      model: data.model,
      usage: data.usage
    })

    return data

  } catch (error) {
    console.error('[SiliconFlow] 请求失败:', error)
    setResponseStatus(event, 500)
    return { 
      error: 'SiliconFlow request failed',
      details: error instanceof Error ? error.message : String(error)
    }
  }
})
