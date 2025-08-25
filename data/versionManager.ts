// Append-only document version manager consistent with flat ds.ts types

import type { DocumentVersion, OperationRecord, DocumentState } from './ds'
import { FlatStorageManager } from './storage'

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now()}_${rand}`
}

export interface CreateVersionInput {
  documentId: string
  content: string
  operationType: DocumentVersion['operationType']
  operationSource: DocumentVersion['operationSource']
  operationDescription: string
  userInput?: string
  aiPrompt?: string
  charactersAdded: number
  charactersRemoved: number
}

export class VersionManager {
  private storage: FlatStorageManager

  constructor(storage?: FlatStorageManager) {
    this.storage = storage ?? new FlatStorageManager()
  }

  async createVersion(input: CreateVersionInput): Promise<DocumentVersion> {
    const now = Date.now()
    const versions = await this.storage.loadDocumentVersions(input.documentId)
    const versionNumber = versions.length ? (versions[versions.length - 1].versionNumber + 1) : 1
    const version: DocumentVersion = {
      id: generateId('ver'),
      documentId: input.documentId,
      content: input.content,
      contentLength: input.content.length,
      contentEncoding: 'utf-8',
      timestamp: now,
      versionNumber,
      operationType: input.operationType,
      operationSource: input.operationSource,
      operationDescription: input.operationDescription,
      userInput: input.userInput,
      aiPrompt: input.aiPrompt,
      charactersAdded: input.charactersAdded,
      charactersRemoved: input.charactersRemoved,
      editingTimeMs: 0
    }

    await this.storage.appendDocumentVersion(version)

    // update state append-only snapshot
    const state: DocumentState = {
      documentId: input.documentId,
      currentVersionId: version.id,
      currentVersionNumber: version.versionNumber,
      lastSavedVersionId: version.id,
      lastSavedTimestamp: now,
      hasUnsavedChanges: false,
      unsavedChangeCount: 0,
      lastOperationId: version.id,
      lastOperationTimestamp: now,
      lastOperationSource: input.operationSource,
      editingSource: input.operationType === 'chatbot_edit' ? 'chatbot' : 'direct',
      isLocked: false,
      totalEditTimeMs: 0,
      operationCount: versions.length + 1
    }

    await this.storage.saveDocumentState(state)
    return version
  }

  async appendOperation(operation: OperationRecord): Promise<void> {
    await this.storage.appendOperationRecord(operation)
  }
}


