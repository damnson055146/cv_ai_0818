import { lmemStore, type ConversationMessageRecord, convStore } from './contextStore'

export interface BuildContextInput {
  documentId: string
  docType?: 'cv' | 'letter' | 'ps'
  language?: 'zh-cn' | 'en' | 'sp'
  tailMessages?: number
}

export interface BuiltContext {
  rules: string
  recentConversation: ConversationMessageRecord[]
}

export function buildContext(input: BuildContextInput): BuiltContext {
  const docType = input.docType ?? 'cv'
  const language = input.language ?? 'zh-cn'
  const rules = lmemStore.getMergedRules(docType, language)
  const recentConversation = convStore.loadMessages(input.documentId, input.tailMessages ?? 30)
  return { rules, recentConversation }
}


