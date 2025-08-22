/**
 * Monaco文档结构解析器
 * 根据markdown结构和分隔符识别文档的sections
 */

export interface DocumentSection {
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'internship' | 'project' | 'education' | 'other'
  level?: number // 标题级别 (1-6) 或列表缩进级别
  title: string
  content: string
  startLine: number
  endLine: number
  startColumn: number
  endColumn: number
}

export interface DocumentStructure {
  sections: DocumentSection[]
  totalLines: number
  hasInternshipSections: boolean
  hasProjectSections: boolean
  hasEducationSections: boolean
}

/**
 * 解析文档结构
 */
export function parseDocumentStructure(content: string): DocumentStructure {
  const lines = content.split('\n')
  const sections: DocumentSection[] = []
  let currentSection: Partial<DocumentSection> | null = null
  
  console.log('[DocumentParser] 开始解析文档结构, 总行数:', lines.length)
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // 检测标题 (# ## ### 等)
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      // 保存前一个section
      if (currentSection) {
        finalizePreviousSection(currentSection, sections, i - 1, lines)
      }
      
      // 开始新的标题section
      currentSection = {
        type: 'heading',
        level: headingMatch[1].length,
        title: headingMatch[2],
        content: trimmedLine,
        startLine: i + 1,
        startColumn: 1
      }
      
      console.log(`[DocumentParser] 发现标题 H${headingMatch[1].length}: ${headingMatch[2]}`)
      continue
    }
    
    // 检测实习经验分隔符 (以 - 开头的条目)
    if (trimmedLine.startsWith('- ') && trimmedLine.length > 2) {
      // 保存前一个section
      if (currentSection) {
        finalizePreviousSection(currentSection, sections, i - 1, lines)
      }
      
      // 开始新的实习section
      currentSection = {
        type: 'internship',
        title: `实习经验: ${trimmedLine.substring(2, Math.min(30, trimmedLine.length))}...`,
        content: trimmedLine,
        startLine: i + 1,
        startColumn: 1
      }
      
      console.log(`[DocumentParser] 发现实习经验条目: ${trimmedLine.substring(0, 50)}`)
      continue
    }
    
    // 检测项目经验 (通常在 "项目经验" 或 "Projects" 标题下)
    if (isInProjectContext(sections) && (trimmedLine.startsWith('**') || trimmedLine.startsWith('*'))) {
      // 保存前一个section
      if (currentSection) {
        finalizePreviousSection(currentSection, sections, i - 1, lines)
      }
      
      currentSection = {
        type: 'project',
        title: `项目: ${trimmedLine.substring(0, Math.min(30, trimmedLine.length))}...`,
        content: trimmedLine,
        startLine: i + 1,
        startColumn: 1
      }
      
      console.log(`[DocumentParser] 发现项目条目: ${trimmedLine.substring(0, 50)}`)
      continue
    }
    
    // 检测教育经历
    if (isInEducationContext(sections) && trimmedLine.length > 0) {
      if (!currentSection || currentSection.type !== 'education') {
        // 保存前一个section
        if (currentSection) {
          finalizePreviousSection(currentSection, sections, i - 1, lines)
        }
        
        currentSection = {
          type: 'education',
          title: `教育经历: ${trimmedLine.substring(0, Math.min(30, trimmedLine.length))}...`,
          content: trimmedLine,
          startLine: i + 1,
          startColumn: 1
        }
        
        console.log(`[DocumentParser] 发现教育经历: ${trimmedLine.substring(0, 50)}`)
      } else {
        // 继续当前教育section
        currentSection.content += '\n' + trimmedLine
      }
      continue
    }
    
    // 其他内容：如果有当前section，追加内容
    if (currentSection) {
      if (!currentSection.content) {
        currentSection.content = trimmedLine
      } else {
        currentSection.content += '\n' + trimmedLine
      }
    } else if (trimmedLine.length > 0) {
      // 开始新的段落section
      currentSection = {
        type: 'paragraph',
        title: `段落: ${trimmedLine.substring(0, Math.min(20, trimmedLine.length))}...`,
        content: trimmedLine,
        startLine: i + 1,
        startColumn: 1
      }
    }
  }
  
  // 保存最后一个section
  if (currentSection) {
    finalizePreviousSection(currentSection, sections, lines.length - 1, lines)
  }
  
  const structure: DocumentStructure = {
    sections,
    totalLines: lines.length,
    hasInternshipSections: sections.some(s => s.type === 'internship'),
    hasProjectSections: sections.some(s => s.type === 'project'),
    hasEducationSections: sections.some(s => s.type === 'education')
  }
  
  console.log('[DocumentParser] 解析完成:', {
    sectionsCount: sections.length,
    hasInternship: structure.hasInternshipSections,
    hasProject: structure.hasProjectSections,
    hasEducation: structure.hasEducationSections
  })
  
  return structure
}

/**
 * 完成前一个section的解析
 */
function finalizePreviousSection(
  currentSection: Partial<DocumentSection>, 
  sections: DocumentSection[], 
  endLine: number, 
  lines: string[]
) {
  if (currentSection.startLine !== undefined) {
    const section: DocumentSection = {
      type: currentSection.type || 'other',
      level: currentSection.level,
      title: currentSection.title || '未命名section',
      content: currentSection.content || '',
      startLine: currentSection.startLine,
      endLine: endLine + 1,
      startColumn: currentSection.startColumn || 1,
      endColumn: lines[endLine]?.length + 1 || 1
    }
    
    sections.push(section)
  }
}

/**
 * 检查是否在项目相关上下文中
 */
function isInProjectContext(sections: DocumentSection[]): boolean {
  const recentSections = sections.slice(-3) // 查看最近3个sections
  
  return recentSections.some(section => 
    section.type === 'heading' && 
    (section.title.includes('项目') || 
     section.title.toLowerCase().includes('project') ||
     section.title.includes('作品'))
  )
}

/**
 * 检查是否在教育相关上下文中
 */
function isInEducationContext(sections: DocumentSection[]): boolean {
  const recentSections = sections.slice(-3) // 查看最近3个sections
  
  return recentSections.some(section => 
    section.type === 'heading' && 
    (section.title.includes('教育') || 
     section.title.toLowerCase().includes('education') ||
     section.title.includes('学历') ||
     section.title.includes('院校'))
  )
}

/**
 * 根据操作范围查找匹配的sections
 */
export function findSectionsByScope(structure: DocumentStructure, scope: string): DocumentSection[] {
  const scopeLower = scope.toLowerCase()
  
  if (scopeLower.includes('全文') || scopeLower.includes('整个文档')) {
    return structure.sections
  }
  
  if (scopeLower.includes('标题') || scopeLower.includes('heading')) {
    return structure.sections.filter(s => s.type === 'heading')
  }
  
  if (scopeLower.includes('实习') || scopeLower.includes('internship')) {
    return structure.sections.filter(s => s.type === 'internship')
  }
  
  if (scopeLower.includes('项目') || scopeLower.includes('project')) {
    return structure.sections.filter(s => s.type === 'project')
  }
  
  if (scopeLower.includes('教育') || scopeLower.includes('education')) {
    return structure.sections.filter(s => s.type === 'education')
  }
  
  if (scopeLower.includes('段落') || scopeLower.includes('paragraph')) {
    return structure.sections.filter(s => s.type === 'paragraph')
  }
  
  // 默认返回所有sections
  return structure.sections
}

/**
 * 获取section的Monaco编辑器范围
 */
export function getSectionRange(section: DocumentSection) {
  return {
    startLineNumber: section.startLine,
    startColumn: section.startColumn,
    endLineNumber: section.endLine,
    endColumn: section.endColumn
  }
}

/**
 * 导出单例解析器
 */
export const useDocumentStructureParser = () => {
  return {
    parseDocumentStructure,
    findSectionsByScope,
    getSectionRange
  }
}
