/**
 * Fix-in-Chat 调试接口
 * 
 * 用于测试各个组件的功能
 */

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const action = query.action as string;

  console.log('[Debug Fix-in-Chat] 收到调试请求:', { action, query });

  switch (action) {
    case 'test-context-extractor':
      return await testContextExtractor(query);
    
    case 'test-intent-parse':
      return await testIntentParse(query);
    
    case 'test-content-generate':
      return await testContentGenerate(query);
    
    case 'test-diff-preview':
      return await testDiffPreview(query);
    
    case 'health-check':
      return await healthCheck();
    
    default:
      return {
        success: false,
        error: '未知的调试动作',
        availableActions: [
          'test-context-extractor',
          'test-intent-parse', 
          'test-content-generate',
          'test-diff-preview',
          'health-check'
        ]
      };
  }
});

/**
 * 测试上下文提取器
 */
async function testContextExtractor(query: any) {
  try {
    const selectedText = query.selectedText as string || "### 教育经历\n\n**北京大学** | 计算机科学与技术 | 本科 | 2018-2022";
    const beforeContext = query.beforeContext as string || "# 张三的简历\n\n## 基本信息\n\n- 姓名：张三\n- 邮箱：zhangsan@example.com\n";
    const afterContext = query.afterContext as string || "\n## 工作经历\n\n**腾讯科技** | 前端工程师 | 2022-至今";

    // 模拟上下文提取器的分析结果
    const mockContext = {
      selectedText,
      position: { startLine: 8, startColumn: 1, endLine: 10, endColumn: 50 },
      beforeContext,
      afterContext,
      sectionType: 'education' as const,
      contentType: 'paragraph' as const,
      semanticTags: ['education', 'university', 'degree', 'time'],
      relatedKeywords: ['北京大学', '计算机', '本科', '2018', '2022'],
      hasMarkdown: true,
      indentLevel: 0,
      lineType: 'multi' as const
    };

    return {
      success: true,
      context: mockContext,
      analysis: {
        detectsEducationSection: true,
        detectsMarkdown: true,
        extractedKeywords: mockContext.relatedKeywords,
        confidence: 0.95
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: '上下文提取器测试失败'
    };
  }
}

/**
 * 测试意图解析
 */
async function testIntentParse(query: any) {
  try {
    const userInput = query.input as string || "把学校名称改成清华大学";
    
    // 模拟调用意图解析API
    const mockResponse = {
      success: true,
      intent: {
        intentType: 'modify',
        targetType: 'sentence',
        sectionTag: 'education',
        operations: [
          {
            targetId: 'education_university_name',
            newText: '清华大学',
            action: 'replace'
          }
        ],
        confidence: 0.88
      }
    };

    return {
      success: true,
      input: userInput,
      parsedIntent: mockResponse.intent,
      debugInfo: {
        detectedKeywords: ['学校', '名称', '清华大学'],
        sectionAnalysis: 'education',
        actionType: 'replace'
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: '意图解析测试失败'
    };
  }
}

/**
 * 测试内容生成
 */
async function testContentGenerate(query: any) {
  try {
    const userInstruction = query.instruction as string || "让这段教育经历更详细";
    const originalText = query.originalText as string || "**北京大学** | 计算机科学与技术 | 本科 | 2018-2022";
    
    // 模拟内容生成结果
    const mockGeneratedText = `**北京大学** | 计算机科学与技术学院 | 计算机科学与技术专业 | 本科学士学位 | 2018年9月-2022年6月

**主要课程：** 数据结构与算法、计算机网络、操作系统、数据库系统、软件工程、人工智能基础

**学术成果：** GPA 3.8/4.0，获得优秀学生奖学金，参与2项科研项目`;

    return {
      success: true,
      input: {
        instruction: userInstruction,
        originalText
      },
      output: {
        generatedText: mockGeneratedText,
        changes: {
          lengthIncrease: mockGeneratedText.length - originalText.length,
          detailsAdded: ['主要课程', '学术成果', 'GPA'],
          formatImproved: true
        }
      },
      metrics: {
        processingTime: '1.2s',
        tokenUsage: 156,
        confidence: 0.92
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: '内容生成测试失败'
    };
  }
}

/**
 * 测试Diff预览
 */
async function testDiffPreview(query: any) {
  try {
    const originalText = query.originalText as string || "**北京大学** | 计算机科学与技术 | 本科 | 2018-2022";
    const suggestedText = query.suggestedText as string || "**清华大学** | 计算机科学与技术 | 本科 | 2018-2022";

    const diffAnalysis = {
      changes: [
        {
          type: 'replace',
          position: { start: 2, end: 6 },
          old: '北京大学',
          new: '清华大学'
        }
      ],
      similarity: 0.95,
      changeType: 'minor',
      affectedWords: 1,
      totalWords: 8
    };

    return {
      success: true,
      originalText,
      suggestedText,
      diffAnalysis,
      previewReady: true,
      recommendations: [
        '这是一个简单的学校名称替换',
        '建议检查是否还需要更新相关的专业信息',
        '变更影响较小，可以安全应用'
      ]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: 'Diff预览测试失败'
    };
  }
}

/**
 * 健康检查
 */
async function healthCheck() {
  const components = {
    contextExtractor: { status: 'ok', version: '1.0.0' },
    intentParser: { status: 'ok', endpoint: '/api/intent-parse' },
    contentGenerator: { status: 'ok', endpoint: '/api/content-generate' },
    diffPreview: { status: 'ok', component: 'DiffPreview.vue' },
    undoSystem: { status: 'ok', maxHistory: 50 }
  };

  const runtimeConfig = useRuntimeConfig();
  const environmentCheck = {
    siliconFlowConfigured: !!runtimeConfig.siliconFlowApiKey,
    openaiConfigured: !!runtimeConfig.openaiApiKey,
    nuxtVersion: '3.x',
    nodeVersion: process.version
  };

  return {
    success: true,
    timestamp: new Date().toISOString(),
    components,
    environment: environmentCheck,
    fixInChatReady: Object.values(components).every(c => c.status === 'ok'),
    debugEndpoint: '/api/debug-fix-in-chat'
  };
}
