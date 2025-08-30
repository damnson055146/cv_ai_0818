/**
 * 意图解析测试接口 - 用于调试和测试
 */

import { useRuntimeConfig } from '#app'
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig(event) as any

  // 测试参数
  const testInput = (query.input as string) || '修改第一段，让其改为中文'
  const testMode = (query.mode as string) || 'structured-intent'
  
  console.log(`[TestIntent] 开始测试: ${testInput}`)

  // API配置检查
  const siliconFlowApiKey = config.siliconFlowApiKey || config.public?.SILICON_FLOW_API_KEY || ""
  if (!siliconFlowApiKey) {
    return { 
      error: 'SILICON_FLOW_API_KEY missing',
      config: {
        hasPublicKey: !!config.public?.SILICON_FLOW_API_KEY,
        hasPrivateKey: !!config.siliconFlowApiKey
      }
    }
  }

  const siliconFlowBaseUrl = config.public?.siliconFlowBaseUrl || "https://api.siliconflow.cn/v1"
  const model = config.public?.siliconFlowModel || "Qwen/Qwen2.5-7B-Instruct"

  // 构建测试请求
  const systemPrompt = testMode === 'structured-intent' 
    ? `你是专业的简历编辑助手。请分析用户的编辑意图，并返回严格的JSON格式结果。

输出要求：
- 必须返回有效的JSON，不要有任何解释文字
- 不要添加markdown代码块标记
- 不要有额外的说明

JSON格式：
{
  "intentType": "modify",
  "targetType": "sentence", 
  "sectionTag": "other",
  "operations": [
    {
      "targetId": "test_target",
      "newText": "修改后的文本",
      "action": "replace"
    }
  ],
  "confidence": 0.85
}`
    : `根据模板要求处理内容，返回JSON格式。`

  const userPrompt = `用户需求: ${testInput}
当前内容: 这是第一段测试内容，需要进行修改。
目标ID: test_target_123

请根据用户需求生成修改操作。`

  try {
    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1024,
      stream: false
    }

    console.log(`[TestIntent] 调用硅基流动:`, {
      model,
      baseUrl: siliconFlowBaseUrl,
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length
    })

    const response = await fetch(`${siliconFlowBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${siliconFlowApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    console.log(`[TestIntent] API响应状态:`, response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[TestIntent] API错误:`, errorText)
      
      return {
        error: `API Error ${response.status}`,
        details: errorText,
        config: { model, baseUrl: siliconFlowBaseUrl }
      }
    }

    const data = await response.json()
    console.log(`[TestIntent] API原始响应:`, JSON.stringify(data, null, 2))

    const assistantResponse = data.choices?.[0]?.message?.content || ""
    console.log(`[TestIntent] 助手响应:`, assistantResponse)

    // 尝试解析JSON
    let parsedResult = null
    let parseError = null
    
    try {
      // 首先尝试直接解析
      parsedResult = JSON.parse(assistantResponse)
    } catch (e1) {
      parseError = (e1 as Error).message
      
      // 尝试提取JSON（去除markdown等）
      try {
        const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsedResult = JSON.parse(jsonMatch[0])
          parseError = null
        }
      } catch (e2) {
        parseError = `Direct parse failed: ${(e1 as Error).message}, Extract parse failed: ${(e2 as Error).message}`
      }
    }

    return {
      success: !parseError,
      rawResponse: assistantResponse,
      parsedResult,
      parseError,
      apiData: {
        model: data.model,
        usage: data.usage,
        finish_reason: data.choices?.[0]?.finish_reason
      },
      test: {
        input: testInput,
        mode: testMode
      }
    }

  } catch (error) {
    console.error('[TestIntent] 请求失败:', error)
    
    return {
      error: 'Request failed',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }
  }
})
