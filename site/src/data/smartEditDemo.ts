// 智能编辑系统使用示例
import { UpdateManager } from './updateManager'

/**
 * 智能编辑系统使用示例
 * 演示完整的意图识别 -> 内容生成 -> 应用更新流程
 */
export class SmartEditDemo {
  private updateManager = new UpdateManager()

  /**
   * 示例1: 自然语言编辑教育背景
   */
  async editEducation() {
    const documentId = 'demo_cv_001'
    
    // 用户输入："我的本科院校没错，但是系要改成计算机系"
    const result = await this.updateManager.handleSmartEdit(
      documentId,
      '我的本科院校没错，但是系要改成计算机系',
      {
        docType: 'cv',
        language: 'zh-cn'
      }
    )

    if (result.success) {
      console.log('编辑成功！')
      console.log('定位到区块:', result.location?.sectionTag)
      console.log('置信度:', result.confidence)
      console.log('修改后内容:', result.appliedContent?.slice(0, 200) + '...')
    } else {
      console.error('编辑失败:', result.error)
    }

    return result
  }

  /**
   * 示例2: 选区翻译
   */
  async translateSelection() {
    const documentId = 'demo_cv_001'
    
    // 模拟用户选择了一个区域（工作经历部分）
    const selectedRange = {
      startPosition: 500,
      endPosition: 800
    }

    const result = await this.updateManager.handleTemplateCommand(
      documentId,
      'translate',
      '翻译成英文，保持专业性',
      selectedRange
    )

    if (result.success) {
      console.log('翻译成功！')
      console.log('翻译后内容:', result.appliedContent?.slice(0, 200) + '...')
    } else {
      console.error('翻译失败:', result.error)
    }

    return result
  }

  /**
   * 示例3: 内容定位测试
   */
  async testContentLocation() {
    const documentId = 'demo_cv_001'
    
    const location = await this.updateManager.locateContent({
      documentId,
      userInput: '修改我的项目经历，增加一些技术细节',
      docType: 'cv',
      language: 'zh-cn'
    })

    console.log('定位结果:')
    console.log('- 区块标签:', location.sectionTag)
    console.log('- 目标类型:', location.targetType) 
    console.log('- 目标数量:', location.targetIds.length)
    console.log('- 置信度:', location.confidence)
    console.log('- 匹配关键词:', location.matchedKeywords)
    console.log('- 上下文预览:', location.contextText.slice(0, 100) + '...')

    return location
  }

  /**
   * 示例4: 完整的聊天编辑流程
   */
  async chatEditFlow() {
    const documentId = 'demo_cv_001'
    
    // 模拟聊天式编辑对话
    const conversations = [
      '帮我优化一下工作经历的描述，突出技术成果',
      '把教育背景翻译成英文', 
      '在技能部分增加AI相关的技术栈',
      '调整个人总结，让语言更简洁有力'
    ]

    const results = []
    
    for (const userInput of conversations) {
      console.log(`\n用户: ${userInput}`)
      
      const result = await this.updateManager.handleSmartEdit(
        documentId,
        userInput,
        { docType: 'cv', language: 'zh-cn' }
      )
      
      if (result.success) {
        console.log(`✅ 成功 (置信度: ${result.confidence})`)
        console.log(`📍 区块: ${result.location?.sectionTag}`)
      } else {
        console.log(`❌ 失败: ${result.error}`)
      }
      
      results.push(result)
    }

    return results
  }

  /**
   * 示例5: 容错测试
   */
  async testFallback() {
    const documentId = 'demo_cv_001'
    
    // 测试各种边界情况
    const testCases = [
      '帮我修改', // 模糊指令
      '把火星经历改成地球经历', // 不存在的内容
      '翻译成火星文', // 不支持的语言
      '', // 空输入
      '在不存在的区块里添加内容' // 无效定位
    ]

    const results = []
    
    for (const userInput of testCases) {
      console.log(`\n测试输入: "${userInput}"`)
      
      const result = await this.updateManager.handleSmartEdit(
        documentId,
        userInput,
        { docType: 'cv', language: 'zh-cn' }
      )
      
      console.log(`结果: ${result.success ? '成功' : '失败'}`)
      if (!result.success) {
        console.log(`错误: ${result.error}`)
      }
      
      results.push(result)
    }

    return results
  }
}

// 导出便捷函数
export async function demoSmartEdit() {
  const demo = new SmartEditDemo()
  
  console.log('=== 智能编辑系统演示 ===\n')
  
  // 运行所有示例
  await demo.editEducation()
  await demo.translateSelection()
  await demo.testContentLocation()
  await demo.chatEditFlow()
  await demo.testFallback()
  
  console.log('\n=== 演示完成 ===')
}

// 导出核心功能供其他组件使用
export { UpdateManager } from './updateManager'
export { CVSectionLocator } from './cvSectionLocator'
export { OperationApplier } from './operationApplier'
export type { 
  CVSectionLocation,
  IntentParseRequest,
  IntentParseResponse,
  EditOperation
} from './ds'
