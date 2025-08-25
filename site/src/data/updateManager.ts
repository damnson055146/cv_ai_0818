// UpdateManager orchestrates edit/chatbot/save flows aligned with the sequence diagram
import { FlatStorageManager } from './storage'
import { MarkdownFlatParser } from './markdownFlatParser'
import { VersionManager } from './versionManager'
import type {
  OperationRecord,
  IntentParseRecord,
  DocumentState
} from './ds'

function id(prefix: string) {
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now()}_${r}`
}

export class UpdateManager {
  private storage = new FlatStorageManager()
  private parser = new MarkdownFlatParser(this.storage)
  private versionMgr = new VersionManager(this.storage)

  // Direct edit path (Editor -> UpdateMgr)
  async handleDirectEdit(documentId: string, newContent: string, oldContent: string): Promise<void> {
    const now = Date.now()
    const op: OperationRecord = {
      id: id('op'),
      documentId,
      versionId: '',
      sequence: now,
      timestamp: now,
      operationType: 'direct_edit',
      operationSource: 'user',
      targetType: 'document',
      oldContent,
      newContent,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
      contentEncoding: 'utf-8',
      charactersAdded: Math.max(0, newContent.length - oldContent.length),
      charactersRemoved: Math.max(0, oldContent.length - newContent.length),
      editingTimeMs: 0,
      isPersisted: false
    }
    await this.storage.appendOperationRecord(op)

    // parse to update paragraphs/sentences
    await this.parser.parseAndStore(newContent, {
      documentId,
      versionId: 'live',
      timestamp: now
    })
  }

  // Chatbot path with prior intent parsing (Parser -> Chatbot -> UpdateMgr)
  async handleChatbotEdit(documentId: string, intent: IntentParseRecord, appliedContent: string, previousContent: string): Promise<void> {
    const now = Date.now()
    await this.storage.appendIntentRecord(documentId, intent)

    const op: OperationRecord = {
      id: id('op'),
      documentId,
      versionId: '',
      sequence: now,
      timestamp: now,
      operationType: 'chatbot_edit',
      operationSource: 'chatbot',
      userInput: intent.userInput,
      targetType: intent.targetType,
      targetId: intent.targetId,
      targetIndex: intent.targetIndex,
      oldContent: previousContent,
      newContent: appliedContent,
      oldContentLength: previousContent.length,
      newContentLength: appliedContent.length,
      contentEncoding: 'utf-8',
      charactersAdded: Math.max(0, appliedContent.length - previousContent.length),
      charactersRemoved: Math.max(0, previousContent.length - appliedContent.length),
      editingTimeMs: intent.parseTimeMs,
      isPersisted: false
    }
    await this.storage.appendOperationRecord(op)

    await this.parser.parseAndStore(appliedContent, {
      documentId,
      versionId: 'live',
      timestamp: now
    })
  }

  // Save path (Editor -> UpdateMgr)
  async handleSave(documentId: string, content: string): Promise<void> {
    const latestState = await this.storage.loadDocumentState(documentId)
    const prevContentLength = content.length // simplistic; caller can provide previous
    const version = await this.versionMgr.createVersion({
      documentId,
      content,
      operationType: 'save',
      operationSource: 'user',
      operationDescription: 'manual save',
      charactersAdded: 0,
      charactersRemoved: 0
    })

    // Optionally clear unsaved flag via a new state snapshot
    const state: DocumentState = {
      documentId,
      currentVersionId: version.id,
      currentVersionNumber: version.versionNumber,
      lastSavedVersionId: version.id,
      lastSavedTimestamp: Date.now(),
      hasUnsavedChanges: false,
      unsavedChangeCount: 0,
      lastOperationId: version.id,
      lastOperationTimestamp: Date.now(),
      lastOperationSource: 'user',
      editingSource: 'direct',
      isLocked: false,
      totalEditTimeMs: (latestState?.totalEditTimeMs ?? 0),
      operationCount: (latestState?.operationCount ?? 0) + 1
    }
    await this.storage.saveDocumentState(state)
  }
}


