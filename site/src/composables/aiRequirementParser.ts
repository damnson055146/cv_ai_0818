/**
 * AI需求解析器
 * 解析用户的自然语言输入，识别工作区操作意图
 */

import type { AiRequirement } from './workspaceOperator'

export interface ParsedCommand {
  type: 'workspace' | 'chat' // 是工作区操作还是普通聊天
  confidence: number // 置信度 0-1
  requirement?: AiRequirement // 如果是工作区操作，包含解析结果
  originalText: string // 原始输入
}

export interface CommandPattern {
  keywords: string[]
  action: string
  target: string
  priority: number // 优先级，用于冲突解决
  examples: string[] // 示例用法
}

export class AiRequirementParser {
  private commandPatterns: CommandPattern[] = [
    // 编辑类操作
    {
      keywords: ['编辑', '修改', '改写', '重写', '润色', '优化'],
      action: 'edit',
      target: 'selection',
      priority: 10,
      examples: ['编辑这段文字', '修改选中的内容', '重写这一段']
    },
    {
      keywords: ['修正', '纠正', '改正', '修复'],
      action: 'correct',
      target: 'selection',
      priority: 9,
      examples: ['修正语法错误', '纠正拼写', '改正这个句子']
    },
    
    // 格式化操作
    {
      keywords: ['格式化', '整理', '排版', '对齐', '缩进'],
      action: 'format',
      target: 'selection',
      priority: 8,
      examples: ['格式化代码', '整理文档格式', '排版这段文字']
    },
    {
      keywords: ['加粗', '斜体', '标题', '列表'],
      action: 'format',
      target: 'selection',
      priority: 8,
      examples: ['把这段文字加粗', '设为标题', '转为列表']
    },
    
    // 生成操作
    {
      keywords: ['生成', '创建', '写', '添加', '新建'],
      action: 'generate',
      target: 'document',
      priority: 7,
      examples: ['生成一段介绍', '写一个总结', '添加章节']
    },
    {
      keywords: ['续写', '补充', '扩展', '延伸'],
      action: 'extend',
      target: 'selection',
      priority: 7,
      examples: ['续写这段话', '补充内容', '扩展这个观点']
    },
    
    // 分析操作
    {
      keywords: ['分析', '检查', '查看', '审查', '评估'],
      action: 'analyze',
      target: 'selection',
      priority: 6,
      examples: ['分析这段文字', '检查语法', '评估内容质量']
    },
    {
      keywords: ['统计', '计数', '字数'],
      action: 'count',
      target: 'selection',
      priority: 6,
      examples: ['统计字数', '计算段落数', '查看文档长度']
    },
    
    // 翻译操作
    {
      keywords: ['翻译', '转换', '英文', '中文'],
      action: 'translate',
      target: 'selection',
      priority: 5,
      examples: ['翻译成英文', '转换为中文', '翻译这段话']
    },
    
    // 样式操作
    {
      keywords: ['样式', 'css', '外观', '颜色', '字体'],
      action: 'style',
      target: 'css',
      priority: 4,
      examples: ['修改样式', '调整颜色', '改变字体']
    },
    
    // 搜索操作
    {
      keywords: ['搜索', '查找', '定位', '跳转'],
      action: 'search',
      target: 'document',
      priority: 3,
      examples: ['搜索关键词', '查找文本', '定位到章节']
    },
    
    // 删除操作
    {
      keywords: ['删除', '移除', '清除', '去掉'],
      action: 'delete',
      target: 'selection',
      priority: 2,
      examples: ['删除这段文字', '移除格式', '清除内容']
    }
  ]
  
  // 上下文关键词，帮助确定操作目标
  private contextKeywords = {
    selection: ['选中的', '这段', '当前', '高亮的', '标记的'],
    document: ['整个文档', '全部', '文档', '全文', '所有'],
    css: ['样式', 'CSS', '外观', '布局', '设计'],
    paragraph: ['段落', '这一段', '当前段'],
    line: ['这行', '当前行', '这一行']
  }
  
  // 否定词，降低置信度
  private negativeWords = ['不要', '别', '不', '停止', '取消', '撤销']
  
  // 疑问词，可能是询问而非操作
  private questionWords = ['什么', '如何', '为什么', '怎么', '能否', '可以吗', '吗？']

  /**
   * 解析用户输入
   */
  public parse(input: string): ParsedCommand {
    const normalizedInput = this.normalizeInput(input)
    
    // 检查是否包含否定词
    const hasNegative = this.negativeWords.some(word => normalizedInput.includes(word))
    if (hasNegative) {
      return {
        type: 'chat',
        confidence: 0.1,
        originalText: input
      }
    }
    
    // 检查是否是疑问句
    const hasQuestion = this.questionWords.some(word => normalizedInput.includes(word))
    const questionConfidencePenalty = hasQuestion ? 0.3 : 0
    
    // 寻找匹配的命令模式
    const matches = this.findMatches(normalizedInput)
    
    if (matches.length === 0) {
      return {
        type: 'chat',
        confidence: 0,
        originalText: input
      }
    }
    
    // 选择最佳匹配
    const bestMatch = this.selectBestMatch(matches, normalizedInput)
    
    // 计算置信度
    let confidence = this.calculateConfidence(bestMatch, normalizedInput)
    confidence = Math.max(0, confidence - questionConfidencePenalty)
    
    // 如果置信度太低，认为是普通聊天
    if (confidence < 0.3) {
      return {
        type: 'chat',
        confidence,
        originalText: input
      }
    }
    
    // 解析操作目标
    const target = this.parseTarget(normalizedInput, bestMatch.target)
    
    // 提取参数
    const parameters = this.extractParameters(normalizedInput, bestMatch)
    
    return {
      type: 'workspace',
      confidence,
      requirement: {
        action: bestMatch.action,
        target,
        parameters,
        prompt: input
      },
      originalText: input
    }
  }

  /**
   * 标准化输入文本
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[，。！？；：""'']/g, ' ') // 替换中文标点
      .replace(/[,.!?;:"']/g, ' ') // 替换英文标点
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim()
  }

  /**
   * 查找匹配的命令模式
   */
  private findMatches(input: string): CommandPattern[] {
    const matches: Array<CommandPattern & { matchCount: number; matchedKeywords: string[] }> = []
    
    for (const pattern of this.commandPatterns) {
      const matchedKeywords = pattern.keywords.filter(keyword => input.includes(keyword))
      
      if (matchedKeywords.length > 0) {
        matches.push({
          ...pattern,
          matchCount: matchedKeywords.length,
          matchedKeywords
        })
      }
    }
    
    // 按匹配数量和优先级排序
    return matches.sort((a, b) => {
      if (a.matchCount !== b.matchCount) {
        return b.matchCount - a.matchCount // 匹配数量多的优先
      }
      return b.priority - a.priority // 优先级高的优先
    })
  }

  /**
   * 选择最佳匹配
   */
  private selectBestMatch(matches: CommandPattern[], input: string): CommandPattern {
    // 如果有多个匹配，选择关键词匹配度最高的
    return matches[0]
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(pattern: CommandPattern, input: string): number {
    const words = input.split(' ')
    const matchedKeywords = pattern.keywords.filter(keyword => input.includes(keyword))
    
    // 基础置信度基于关键词匹配比例
    const keywordRatio = matchedKeywords.length / pattern.keywords.length
    let confidence = 0.4 + (keywordRatio * 0.4)
    
    // 考虑关键词在输入中的权重
    const keywordDensity = matchedKeywords.length / words.length
    confidence += keywordDensity * 0.2
    
    // 考虑上下文关键词
    const hasContextKeywords = Object.values(this.contextKeywords).some(keywords =>
      keywords.some(keyword => input.includes(keyword))
    )
    if (hasContextKeywords) {
      confidence += 0.1
    }
    
    // 考虑模式优先级
    confidence += (pattern.priority / 10) * 0.1
    
    return Math.min(1, confidence)
  }

  /**
   * 解析操作目标
   */
  private parseTarget(input: string, defaultTarget: string): string {
    // 检查上下文关键词
    for (const [target, keywords] of Object.entries(this.contextKeywords)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        return target
      }
    }
    
    return defaultTarget
  }

  /**
   * 提取操作参数
   */
  private extractParameters(input: string, pattern: CommandPattern): Record<string, any> {
    const parameters: Record<string, any> = {}
    
    // 提取语言相关参数
    if (pattern.action === 'translate') {
      if (input.includes('英文') || input.includes('english')) {
        parameters.targetLanguage = 'english'
      } else if (input.includes('中文') || input.includes('chinese')) {
        parameters.targetLanguage = 'chinese'
      }
    }
    
    // 提取格式相关参数
    if (pattern.action === 'format') {
      if (input.includes('加粗') || input.includes('bold')) {
        parameters.style = 'bold'
      } else if (input.includes('斜体') || input.includes('italic')) {
        parameters.style = 'italic'
      } else if (input.includes('标题') || input.includes('heading')) {
        parameters.style = 'heading'
        // 提取标题级别
        const headingMatch = input.match(/[h|H]([1-6])|([一二三四五六])级标题/)
        if (headingMatch) {
          parameters.level = headingMatch[1] || this.chineseToNumber(headingMatch[2])
        }
      } else if (input.includes('列表') || input.includes('list')) {
        parameters.style = 'list'
      }
    }
    
    // 提取样式相关参数
    if (pattern.action === 'style') {
      const colorMatch = input.match(/颜色|色彩|color/)
      if (colorMatch) {
        parameters.property = 'color'
      }
      
      const fontMatch = input.match(/字体|font/)
      if (fontMatch) {
        parameters.property = 'font'
      }
    }
    
    return parameters
  }

  /**
   * 中文数字转阿拉伯数字
   */
  private chineseToNumber(chinese: string): number {
    const map: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6
    }
    return map[chinese] || 1
  }

  /**
   * 获取所有支持的命令
   */
  public getSupportedCommands(): CommandPattern[] {
    return [...this.commandPatterns]
  }

  /**
   * 获取命令示例
   */
  public getCommandExamples(): string[] {
    return this.commandPatterns.flatMap(pattern => pattern.examples)
  }

  /**
   * 验证解析结果
   */
  public validateParsedCommand(command: ParsedCommand): boolean {
    if (command.type === 'chat') {
      return true
    }
    
    if (!command.requirement) {
      return false
    }
    
    const { action, target } = command.requirement
    
    // 验证action是否有效
    const validActions = new Set(this.commandPatterns.map(p => p.action))
    if (!validActions.has(action)) {
      return false
    }
    
    // 验证target是否有效
    const validTargets = new Set(['selection', 'document', 'css', 'paragraph', 'line'])
    if (!validTargets.has(target)) {
      return false
    }
    
    return true
  }
}

// 创建单例实例
let parserInstance: AiRequirementParser | null = null

/**
 * 获取AI需求解析器实例
 */
export function useAiRequirementParser(): AiRequirementParser {
  if (!parserInstance) {
    parserInstance = new AiRequirementParser()
  }
  return parserInstance
}
