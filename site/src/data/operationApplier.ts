// 操作应用器 - 将意图解析结果应用到文档内容
import type { 
  EditOperation, 
  SentenceRecord, 
  ParagraphRecord 
} from './ds'
import { FlatStorageManager } from './storage'

export interface ApplyOperationsInput {
  documentId: string
  operations: EditOperation[]
  previousContent: string
}

export interface ApplyOperationsResult {
  appliedContent: string
  affectedSentenceIds: string[]
  affectedParagraphIds: string[]
  success: boolean
  errors: string[]
}

export class OperationApplier {
  private storage: FlatStorageManager

  constructor(storage?: FlatStorageManager) {
    this.storage = storage ?? new FlatStorageManager()
  }

  async applyOperations(input: ApplyOperationsInput): Promise<ApplyOperationsResult> {
    const { documentId, operations, previousContent } = input
    
    try {
      // 1. 加载当前段落和句子数据
      const sentences = await this.storage.loadSentenceRecords(documentId)
      const paragraphs = await this.storage.loadParagraphRecords(documentId)

      // 2. 按位置排序操作（从后往前应用，避免位置偏移）
      const sortedOps = this.sortOperationsByPosition(operations, sentences, paragraphs)
      
      // 3. 应用所有操作
      let content = previousContent
      const affectedSentenceIds: string[] = []
      const affectedParagraphIds: string[] = []
      const errors: string[] = []

      for (const op of sortedOps) {
        const result = this.applySingleOperation(content, op, sentences, paragraphs)
        
        if (result.success) {
          content = result.newContent
          if (result.affectedSentenceId) {
            affectedSentenceIds.push(result.affectedSentenceId)
          }
          if (result.affectedParagraphId) {
            affectedParagraphIds.push(result.affectedParagraphId)
          }
        } else {
          errors.push(result.error || 'Unknown operation error')
        }
      }

      return {
        appliedContent: content,
        affectedSentenceIds: [...new Set(affectedSentenceIds)],
        affectedParagraphIds: [...new Set(affectedParagraphIds)],
        success: errors.length === 0,
        errors
      }
    } catch (error) {
      return {
        appliedContent: previousContent,
        affectedSentenceIds: [],
        affectedParagraphIds: [],
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private sortOperationsByPosition(
    operations: EditOperation[],
    sentences: SentenceRecord[],
    paragraphs: ParagraphRecord[]
  ): EditOperation[] {
    return operations.sort((a, b) => {
      const posA = this.getOperationPosition(a, sentences, paragraphs)
      const posB = this.getOperationPosition(b, sentences, paragraphs)
      return posB - posA // 从后往前排序
    })
  }

  private getOperationPosition(
    operation: EditOperation,
    sentences: SentenceRecord[],
    paragraphs: ParagraphRecord[]
  ): number {
    // 先找句子
    const sentence = sentences.find(s => s.id === operation.targetId)
    if (sentence) {
      return sentence.startPosition
    }

    // 再找段落
    const paragraph = paragraphs.find(p => p.id === operation.targetId)
    if (paragraph) {
      return paragraph.startPosition
    }

    return 0 // 默认位置
  }

  private applySingleOperation(
    content: string,
    operation: EditOperation,
    sentences: SentenceRecord[],
    paragraphs: ParagraphRecord[]
  ): {
    success: boolean
    newContent: string
    affectedSentenceId?: string
    affectedParagraphId?: string
    error?: string
  } {
    // 找到目标句子或段落
    const sentence = sentences.find(s => s.id === operation.targetId)
    const paragraph = paragraphs.find(p => p.id === operation.targetId)

    if (sentence) {
      return this.applySentenceOperation(content, operation, sentence)
    } else if (paragraph) {
      return this.applyParagraphOperation(content, operation, paragraph)
    } else {
      return {
        success: false,
        newContent: content,
        error: `Target not found: ${operation.targetId}`
      }
    }
  }

  private applySentenceOperation(
    content: string,
    operation: EditOperation,
    sentence: SentenceRecord
  ): {
    success: boolean
    newContent: string
    affectedSentenceId?: string
    error?: string
  } {
    const { startPosition, endPosition } = sentence
    
    try {
      switch (operation.action) {
        case 'replace': {
          // 验证旧文本匹配（可选）
          if (operation.oldText) {
            const currentText = content.slice(startPosition, endPosition)
            if (!currentText.includes(operation.oldText)) {
              return {
                success: false,
                newContent: content,
                error: `Old text mismatch in sentence ${sentence.id}`
              }
            }
          }

          // 替换句子内容
          const newContent = 
            content.slice(0, startPosition) + 
            operation.newText + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedSentenceId: sentence.id
          }
        }

        case 'insert': {
          // 在句子位置插入
          const newContent = 
            content.slice(0, endPosition) + 
            ' ' + operation.newText + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedSentenceId: sentence.id
          }
        }

        case 'delete': {
          // 删除句子
          const newContent = 
            content.slice(0, startPosition) + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedSentenceId: sentence.id
          }
        }

        default:
          return {
            success: false,
            newContent: content,
            error: `Unknown action: ${operation.action}`
          }
      }
    } catch (error) {
      return {
        success: false,
        newContent: content,
        error: error instanceof Error ? error.message : 'Operation failed'
      }
    }
  }

  private applyParagraphOperation(
    content: string,
    operation: EditOperation,
    paragraph: ParagraphRecord
  ): {
    success: boolean
    newContent: string
    affectedParagraphId?: string
    error?: string
  } {
    const { startPosition, endPosition } = paragraph
    
    try {
      switch (operation.action) {
        case 'replace': {
          const newContent = 
            content.slice(0, startPosition) + 
            operation.newText + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedParagraphId: paragraph.id
          }
        }

        case 'insert': {
          const newContent = 
            content.slice(0, endPosition) + 
            '\n\n' + operation.newText + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedParagraphId: paragraph.id
          }
        }

        case 'delete': {
          const newContent = 
            content.slice(0, startPosition) + 
            content.slice(endPosition)

          return {
            success: true,
            newContent,
            affectedParagraphId: paragraph.id
          }
        }

        default:
          return {
            success: false,
            newContent: content,
            error: `Unknown action: ${operation.action}`
          }
      }
    } catch (error) {
      return {
        success: false,
        newContent: content,
        error: error instanceof Error ? error.message : 'Operation failed'
      }
    }
  }

  // 工具方法：从响应生成操作列表
  static fromIntentResponse(response: any): EditOperation[] {
    if (!response.intent?.operations) {
      return []
    }

    return response.intent.operations.map((op: any) => ({
      targetId: op.targetId,
      oldText: op.oldText,
      newText: op.newText,
      action: op.action || 'replace'
    }))
  }

  // 工具方法：简单的文本替换（fallback模式）
  static simpleTextReplace(
    content: string, 
    oldText: string, 
    newText: string
  ): string {
    return content.replace(oldText, newText)
  }
}
