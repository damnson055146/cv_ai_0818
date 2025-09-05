/**
 * Fix-in-Chat Content Generate API
 * 
 * 使用 OpenAI 或 Mock 方式生成内容修改建议
 */

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const prompt = body?.prompt || ''
    const context = body?.context || {}
    
    console.log('[Content Generate API] 收到请求:', {
      promptLength: prompt.length,
      context
    })

    // 检查是否配置了 OpenAI
    const runtimeConfig = useRuntimeConfig()
    const hasOpenAI = !!runtimeConfig.openaiApiKey
    
    if (hasOpenAI) {
      try {
        // 使用真实的 OpenAI API
        return await generateWithOpenAI(prompt, context, runtimeConfig)
      } catch (openaiError) {
        console.error('[Content Generate API] OpenAI 调用失败，回退到 Mock:', openaiError)
        // OpenAI 失败时回退到 Mock
        return await generateMockResponse(prompt, context, `OpenAI失败: ${openaiError.message}`)
      }
    } else {
      console.log('[Content Generate API] 使用 Mock 模式 (未配置 OpenAI)')
      // 使用 Mock 响应
      return await generateMockResponse(prompt, context, '未配置 OpenAI API Key')
    }
    
  } catch (error: any) {
    console.error('[Content Generate API] 错误:', error)
    return {
      success: false,
      error: error?.message || 'content-generate failed'
    }
  }
})

/**
 * 使用 OpenAI 生成内容
 */
async function generateWithOpenAI(prompt: string, context: any, runtimeConfig: any) {
  try {
    const response = await $fetch(`${runtimeConfig.public.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${runtimeConfig.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: {
        model: runtimeConfig.public.openaiModel || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '你是专业的简历编辑助手。根据用户要求修改文本，只返回修改后的文本内容，不要任何解释或前后缀。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }
    }) as any

    const content = response?.choices?.[0]?.message?.content?.trim()
    
    if (!content) {
      throw new Error('OpenAI 返回空内容')
    }

    return {
      success: true,
      content,
      method: 'openai',
      model: runtimeConfig.public.openaiModel
    }
    
  } catch (error: any) {
    console.error('[Content Generate API] OpenAI 调用失败:', error)
    
    // OpenAI 失败时回退到 Mock
    return await generateMockResponse(prompt, context, `OpenAI失败: ${error.message}`)
  }
}

/**
 * 生成 Mock 响应
 */
async function generateMockResponse(prompt: string, context: any, fallbackReason?: string) {
  // 简单的文本处理逻辑
  const selectedText = context.selectedText || ''
  let modifiedText = selectedText
  
  // 根据提示词进行简单的文本修改
  if (prompt.includes('专业') || prompt.includes('professional')) {
    modifiedText = modifiedText.replace(/学习/g, '掌握').replace(/了解/g, '熟练掌握')
  }
  
  if (prompt.includes('详细') || prompt.includes('detail')) {
    if (modifiedText.includes('本科') && !modifiedText.includes('学士')) {
      modifiedText = modifiedText.replace('本科', '本科学士学位')
    }
    if (modifiedText.includes('大学') && !modifiedText.includes('学院')) {
      modifiedText = modifiedText.replace(/(\*\*[^*]+大学\*\*)/, '$1 计算机科学与技术学院')
    }
  }
  
  if (prompt.includes('翻译') || prompt.includes('translate') || prompt.includes('英文')) {
    // 简单的中英文转换示例
    modifiedText = modifiedText
      .replace(/\*\*北京大学\*\*/g, '**Peking University**')
      .replace(/计算机科学与技术/g, 'Computer Science and Technology')
      .replace(/本科/g, "Bachelor's Degree")
  }
  
  if (prompt.includes('清华') || prompt.includes('Tsinghua')) {
    modifiedText = modifiedText.replace(/北京大学/g, '清华大学').replace(/Peking University/g, 'Tsinghua University')
  }
  
  // 如果没有任何修改，添加一些改进
  if (modifiedText === selectedText) {
    modifiedText = selectedText + ' (已优化)'
  }
  
  return {
    success: true,
    content: modifiedText,
    method: 'mock',
    fallbackReason,
    originalLength: selectedText.length,
    modifiedLength: modifiedText.length
  }
}