// site/src/utils/enhancedStorage.ts

/**
 * 增强的存储系统，支持版本控制和智能缓存
 */
export class EnhancedStorage {
    private baseStorage = localForage.createInstance({
      name: 'MarkdownResumeEnhanced',
      storeName: 'enhanced_data'
    })
    
    private versionStorage = localForage.createInstance({
      name: 'MarkdownResumeVersions',
      storeName: 'versions'
    })
    
    private memoryStorage = localForage.createInstance({
      name: 'MarkdownResumeMemory',
      storeName: 'memories'
    })
    
    private cacheStorage = localForage.createInstance({
      name: 'MarkdownResumeCache',
      storeName: 'cache'
    })
    
    /**
     * 保存增强的简历数据
     */
    async saveEnhancedResume(id: string, resume: EnhancedResumeStorageItem): Promise<void> {
      // 分离存储以优化性能
      const { versionHistory, chatMemories, cache, ...baseData } = resume
      
      // 保存基础数据
      await this.baseStorage.setItem(id, baseData)
      
      // 保存版本历史（压缩存储）
      await this.saveVersionHistory(id, versionHistory)
      
      // 保存记忆数据
      await this.saveMemories(id, chatMemories)
      
      // 保存缓存数据
      await this.saveCache(id, cache)
    }
    
    /**
     * 加载增强的简历数据
     */
    async loadEnhancedResume(id: string): Promise<EnhancedResumeStorageItem | null> {
      const baseData = await this.baseStorage.getItem<Partial<EnhancedResumeStorageItem>>(id)
      if (!baseData) return null
      
      // 并行加载其他数据
      const [versionHistory, chatMemories, cache] = await Promise.all([
        this.loadVersionHistory(id),
        this.loadMemories(id),
        this.loadCache(id)
      ])
      
      return {
        ...baseData,
        versionHistory: versionHistory || [],
        chatMemories: chatMemories || [],
        cache: cache || this.createEmptyCache()
      } as EnhancedResumeStorageItem
    }
    
    /**
     * 版本历史的压缩存储
     */
    private async saveVersionHistory(resumeId: string, versions: DocumentVersion[]): Promise<void> {
      const compressed = await this.compressVersions(versions)
      await this.versionStorage.setItem(`${resumeId}_versions`, compressed)
    }
    
    /**
     * 智能压缩版本数据
     */
    private async compressVersions(versions: DocumentVersion[]): Promise<CompressedVersions> {
      const baseVersion = versions[0] // 基础版本
      const deltas: VersionDelta[] = []
      
      for (let i = 1; i < versions.length; i++) {
        const delta = this.createVersionDelta(versions[i-1], versions[i])
        deltas.push(delta)
      }
      
      return {
        base: baseVersion,
        deltas,
        compressionInfo: {
          originalSize: this.calculateSize(versions),
          compressedSize: this.calculateSize({ base: baseVersion, deltas }),
          compressionRatio: 0, // 会在实际计算后更新
          algorithm: 'delta-compression'
        }
      }
    }
    
    /**
     * 创建版本差异
     */
    private createVersionDelta(from: DocumentVersion, to: DocumentVersion): VersionDelta {
      return {
        versionId: to.id,
        contentChanges: this.calculateContentDiff(from.content, to.content),
        metadataChanges: this.calculateMetadataDiff(from.metadata, to.metadata),
        timestamp: to.timestamp,
        type: to.type
      }
    }
  }
  
  export interface CompressedVersions {
    base: DocumentVersion
    deltas: VersionDelta[]
    compressionInfo: CompressionInfo
  }
  
  export interface VersionDelta {
    versionId: string
    contentChanges: ContentChange[]
    metadataChanges: MetadataChange[]
    timestamp: number
    type: DocumentVersion['type']
  }
  
  export interface ContentChange {
    type: 'insert' | 'delete' | 'replace'
    position: number
    length?: number
    content?: string
  }
  
  export interface MetadataChange {
    path: string
    oldValue: any
    newValue: any
    operation: 'add' | 'remove' | 'modify'
  }
  
  export interface CompressionInfo {
    originalSize: number
    compressedSize: number
    compressionRatio: number
    algorithm: string
  }