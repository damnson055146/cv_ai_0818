/**
 * Fix-in-Chat 上下文提取器
 * 
 * 负责分析选中文本的上下文，提取结构化信息用于AI修复
 */

export interface SelectionContext {
  // 选中文本信息
  selectedText: string;
  position: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  
  // 上下文信息
  beforeContext: string;
  afterContext: string;
  
  // 结构化分析
  sectionType?: 'basic_info' | 'education' | 'work' | 'projects' | 'skills' | 'awards' | 'certs' | 'summary' | 'other';
  contentType?: 'heading' | 'paragraph' | 'list_item' | 'table_row' | 'inline_text';
  
  // 语义信息
  semanticTags?: string[];
  relatedKeywords?: string[];
  
  // 格式信息
  hasMarkdown?: boolean;
  indentLevel?: number;
  lineType?: 'single' | 'multi';
}

export interface ContextExtractorInput {
  selectedText: string;
  // 支持两种定位：行列 或 绝对偏移
  position:
    | { startLine: number; startColumn: number; endLine: number; endColumn: number }
    | { start: number; end: number };
  beforeContext: string;
  afterContext: string;
  fullDocument: string;
}

export class ContextExtractor {
  /**
   * 提取选区的完整上下文信息
   */
  async extractContext(input: ContextExtractorInput): Promise<SelectionContext> {
    const {
      selectedText,
      position,
      beforeContext,
      afterContext,
      fullDocument
    } = input;

    // 基础上下文
    // 归一化 position 为行列
    const norm = this.normalizePosition(position, fullDocument)
    
    const context: SelectionContext = {
      selectedText,
      position: norm,
      beforeContext,
      afterContext
    };

    // 分析内容类型
    context.contentType = this.analyzeContentType(selectedText);
    
    // 分析所在章节
    context.sectionType = this.analyzeSectionType(beforeContext, afterContext, fullDocument);
    
    // 提取语义标签
    context.semanticTags = this.extractSemanticTags(selectedText, beforeContext, afterContext);
    
    // 提取相关关键词
    context.relatedKeywords = this.extractKeywords(selectedText);
    
    // 检查Markdown格式
    context.hasMarkdown = this.hasMarkdownSyntax(selectedText);
    
    // 分析缩进层级
    context.indentLevel = this.analyzeIndentLevel(selectedText);
    
    // 判断行类型
    context.lineType = norm.startLine === norm.endLine ? 'single' : 'multi';

    return context;
  }

  /**
   * 将 position 统一转换为行列
   */
  private normalizePosition(
    position: ContextExtractorInput['position'],
    fullDocument: string
  ): { startLine: number; startColumn: number; endLine: number; endColumn: number } {
    // 如果已是行列，直接返回
    if (
      (position as any).startLine !== undefined &&
      (position as any).startColumn !== undefined &&
      (position as any).endLine !== undefined &&
      (position as any).endColumn !== undefined
    ) {
      return position as any
    }

    // 偏移到行列
    const { start, end } = position as any
    const safeStart = Math.max(0, Math.min(typeof start === 'number' ? start : 0, fullDocument.length))
    const safeEnd = Math.max(0, Math.min(typeof end === 'number' ? end : fullDocument.length, fullDocument.length))

    // 手动将偏移转为行列
    const sliceTo = (offset: number) => fullDocument.slice(0, offset)
    const startText = sliceTo(safeStart)
    const endText = sliceTo(Math.max(safeEnd, safeStart))

    const startLine = (startText.match(/\n/g)?.length || 0) + 1
    const lastNlStart = startText.lastIndexOf('\n')
    const startColumn = safeStart - (lastNlStart >= 0 ? lastNlStart + 1 : 0) + 1

    const endLine = (endText.match(/\n/g)?.length || 0) + 1
    const lastNlEnd = endText.lastIndexOf('\n')
    const endColumn = Math.max(safeEnd, safeStart) - (lastNlEnd >= 0 ? lastNlEnd + 1 : 0) + 1

    return { startLine, startColumn, endLine, endColumn }
  }

  /**
   * 分析内容类型
   */
  private analyzeContentType(text: string): SelectionContext['contentType'] {
    const trimmed = text.trim();
    
    // 标题
    if (/^#{1,6}\s/.test(trimmed)) {
      return 'heading';
    }
    
    // 列表项
    if (/^[-*+]\s|^\d+\.\s/.test(trimmed)) {
      return 'list_item';
    }
    
    // 表格行
    if (/\|.*\|/.test(trimmed)) {
      return 'table_row';
    }
    
    // 多行段落
    if (trimmed.includes('\n')) {
      return 'paragraph';
    }
    
    // 行内文本
    return 'inline_text';
  }

  /**
   * 分析所在章节类型
   */
  private analyzeSectionType(beforeContext: string, afterContext: string, fullDocument: string): SelectionContext['sectionType'] {
    const contextText = beforeContext + afterContext;
    const lowerContext = contextText.toLowerCase();
    
    // 基础信息区域
    if (this.containsKeywords(lowerContext, ['name', 'email', 'phone', 'address', '姓名', '邮箱', '电话', '地址'])) {
      return 'basic_info';
    }
    
    // 教育经历
    if (this.containsKeywords(lowerContext, ['education', 'university', 'college', 'degree', 'bachelor', 'master', 'phd', '教育', '大学', '学院', '学位', '本科', '硕士', '博士'])) {
      return 'education';
    }
    
    // 工作经历
    if (this.containsKeywords(lowerContext, ['experience', 'work', 'job', 'position', 'company', 'employment', '工作', '经历', '职位', '公司', '就业'])) {
      return 'work';
    }
    
    // 项目经历
    if (this.containsKeywords(lowerContext, ['project', 'projects', 'github', 'repository', '项目', '仓库'])) {
      return 'projects';
    }
    
    // 技能
    if (this.containsKeywords(lowerContext, ['skills', 'technologies', 'programming', 'languages', 'tools', '技能', '技术', '编程', '语言', '工具'])) {
      return 'skills';
    }
    
    // 奖项
    if (this.containsKeywords(lowerContext, ['awards', 'honors', 'achievements', 'recognition', '奖项', '荣誉', '成就', '表彰'])) {
      return 'awards';
    }
    
    // 证书
    if (this.containsKeywords(lowerContext, ['certifications', 'certificates', 'credentials', '证书', '资质', '认证'])) {
      return 'certs';
    }
    
    // 总结
    if (this.containsKeywords(lowerContext, ['summary', 'objective', 'profile', 'about', '总结', '目标', '简介', '关于'])) {
      return 'summary';
    }
    
    return 'other';
  }

  /**
   * 提取语义标签
   */
  private extractSemanticTags(selectedText: string, beforeContext: string, afterContext: string): string[] {
    const tags: string[] = [];
    const text = selectedText.toLowerCase();
    
    // 时间相关
    if (/\d{4}|\d{1,2}\/\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/.test(text)) {
      tags.push('time');
    }
    
    // 技术相关
    if (/python|javascript|java|react|vue|angular|node|typescript|html|css|sql|docker|kubernetes|aws|azure|gcp/.test(text)) {
      tags.push('technology');
    }
    
    // 学位相关
    if (/bachelor|master|phd|degree|diploma|certificate|本科|硕士|博士|学位|文凭|证书/.test(text)) {
      tags.push('degree');
    }
    
    // 职位相关
    if (/engineer|developer|manager|analyst|designer|director|intern|consultant|工程师|开发|经理|分析师|设计师|总监|实习/.test(text)) {
      tags.push('position');
    }
    
    // 公司/机构相关
    if (/university|college|company|corporation|inc|ltd|llc|大学|学院|公司|集团/.test(text)) {
      tags.push('organization');
    }
    
    return tags;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取（可以后续优化为更复杂的NLP算法）
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // 去重并返回前10个关键词
    return [...new Set(words)].slice(0, 10);
  }

  /**
   * 检查是否包含Markdown语法
   */
  private hasMarkdownSyntax(text: string): boolean {
    const markdownPatterns = [
      /\*\*.*\*\*/,  // 粗体
      /\*.*\*/,      // 斜体
      /`.*`/,        // 代码
      /\[.*\]\(.*\)/, // 链接
      /!\[.*\]\(.*\)/, // 图片
      /^#{1,6}\s/,   // 标题
      /^[-*+]\s/,    // 列表
      /^\d+\.\s/     // 有序列表
    ];
    
    return markdownPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 分析缩进层级
   */
  private analyzeIndentLevel(text: string): number {
    const lines = text.split('\n');
    let minIndent = Infinity;
    
    for (const line of lines) {
      if (line.trim()) {
        const leadingSpaces = line.match(/^\s*/)?.[0]?.length || 0;
        minIndent = Math.min(minIndent, leadingSpaces);
      }
    }
    
    return minIndent === Infinity ? 0 : minIndent;
  }

  /**
   * 检查文本是否包含关键词
   */
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * 快速分析上下文（用于实时预览）
   */
  quickAnalyze(selectedText: string, beforeContext: string, afterContext: string): {
    sectionType: string;
    contentType: string;
    confidence: number;
  } {
    const sectionType = this.analyzeSectionType(beforeContext, afterContext, '');
    const contentType = this.analyzeContentType(selectedText);
    
    // 简单的置信度计算
    let confidence = 0.5;
    if (sectionType !== 'other') confidence += 0.3;
    if (contentType !== 'inline_text') confidence += 0.2;
    
    return {
      sectionType: sectionType || 'other',
      contentType: contentType || 'inline_text',
      confidence: Math.min(confidence, 1.0)
    };
  }
}

// 导出单例
export const contextExtractor = new ContextExtractor();
