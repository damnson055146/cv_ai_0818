/**
 * 测试内容生成 API
 */

export default defineEventHandler(async (event) => {
  try {
    console.log('[Test Content Generate] 开始测试');
    
    // 测试数据
    const testPrompt = '请将"北京大学"改成"清华大学"，只返回修改后的文本。\n\n原文:\n**北京大学** | 计算机科学与技术 | 本科 | 2018-2022\n\n请严格按照指令修改上述文本，保持原有的 Markdown 格式和结构，只返回修改后的文本内容：';
    const testContext = {
      selectedText: '**北京大学** | 计算机科学与技术 | 本科 | 2018-2022',
      sectionType: 'education',
      contentType: 'paragraph'
    };
    
    // 检查配置
    const runtimeConfig = useRuntimeConfig();
    const hasOpenAI = !!runtimeConfig.openaiApiKey;
    
    console.log('[Test Content Generate] 配置检查:', {
      hasOpenAI,
      siliconFlowKey: runtimeConfig.siliconFlowApiKey ? '已配置' : '未配置',
      openaiKey: runtimeConfig.openaiApiKey ? '已配置' : '未配置'
    });
    
    // 调用真实的内容生成逻辑
    const response = await $fetch('/api/content-generate', {
      method: 'POST',
      body: {
        prompt: testPrompt,
        context: testContext
      }
    });
    
    return {
      success: true,
      test: 'content-generate API 测试',
      timestamp: new Date().toISOString(),
      config: {
        hasOpenAI,
        hasSiliconFlow: !!runtimeConfig.siliconFlowApiKey
      },
      apiResponse: response,
      testData: {
        prompt: testPrompt,
        context: testContext
      }
    };
    
  } catch (error: any) {
    console.error('[Test Content Generate] 测试失败:', error);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack,
      test: 'content-generate API 测试失败',
      timestamp: new Date().toISOString()
    };
  }
});
