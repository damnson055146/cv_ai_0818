# 后端API测试指南

## 快速测试步骤

### 1. 启动开发服务器
```bash
cd site
pnpm install  # 如果还没安装依赖
pnpm dev      # 启动开发服务器（通常在 http://localhost:3000）
```

### 2. 配置环境变量
确保在 `site/.env` 或 `nuxt.config.ts` 中设置了API密钥：

```bash
# site/.env
SILICON_FLOW_API_KEY=your_silicon_flow_api_key
OPENAI_API_KEY=your_openai_api_key

# 可选配置
SILICON_FLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICON_FLOW_MODEL=Qwen/Qwen2.5-7B-Instruct
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 3. 运行自动化测试
```bash
# 在项目根目录运行
node test-backend.js
```

### 4. 手动测试API

#### 测试硅基流动意图解析
```bash
curl "http://localhost:3000/api/test-intent?input=修改第一段，让其改为中文&mode=structured-intent"
```

#### 测试OpenAI内容生成
```bash
curl "http://localhost:3000/api/test-openai?input=优化这段内容，让表达更专业"
```

#### 测试模板命令
```bash
curl "http://localhost:3000/api/test-intent?input=把教育背景翻译成英文&mode=template-direct"
```

## 错误排查

### 常见错误1：JSON解析失败
**症状**：`Unexpected token '<'` 或 `is not valid JSON`

**原因**：
- LLM返回了HTML错误页面而不是JSON
- LLM返回了带解释文字的响应
- API调用失败返回了错误页面

**解决方法**：
1. 检查测试接口输出的原始响应
2. 查看服务器控制台日志
3. 确认API密钥配置正确

### 常见错误2：API密钥未配置
**症状**：`SILICON_FLOW_API_KEY missing` 或 `OPENAI_API_KEY missing`

**解决方法**：
```bash
# 检查环境变量是否正确设置
echo $SILICON_FLOW_API_KEY
echo $OPENAI_API_KEY

# 或在 nuxt.config.ts 中添加：
export default defineNuxtConfig({
  runtimeConfig: {
    siliconFlowApiKey: process.env.SILICON_FLOW_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    public: {
      siliconFlowBaseUrl: 'https://api.siliconflow.cn/v1',
      siliconFlowModel: 'Qwen/Qwen2.5-7B-Instruct'
    }
  }
})
```

### 常见错误3：服务器未启动
**症状**：`Connection refused` 或 `ECONNREFUSED`

**解决方法**：
```bash
cd site
pnpm dev
# 确保服务器运行在 http://localhost:3000
```

## 调试模式

### 查看详细日志
在测试接口中，所有的调试信息都会输出到控制台：

```bash
# 启动服务器并查看日志
cd site
pnpm dev

# 在另一个终端运行测试
node test-backend.js
```

### 手动检查响应
```bash
# 直接访问测试接口
curl -v "http://localhost:3000/api/test-intent?input=测试&mode=structured-intent"
```

### 分析原始响应
测试接口会输出：
- ✅ 原始API响应
- ✅ 清理后的响应
- ✅ JSON提取过程
- ✅ 解析结果或错误详情

## 预期输出

### 成功的意图解析响应
```json
{
  "success": true,
  "rawResponse": "{\n  \"intentType\": \"modify\",\n  \"targetType\": \"sentence\",\n  \"sectionTag\": \"other\",\n  \"operations\": [\n    {\n      \"targetId\": \"test_target\",\n      \"newText\": \"修改后的中文内容\",\n      \"action\": \"replace\"\n    }\n  ],\n  \"confidence\": 0.85\n}",
  "parsedResult": {
    "intentType": "modify",
    "targetType": "sentence",
    "sectionTag": "other",
    "operations": [
      {
        "targetId": "test_target",
        "newText": "修改后的中文内容",
        "action": "replace"
      }
    ],
    "confidence": 0.85
  },
  "apiData": {
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "usage": {
      "prompt_tokens": 150,
      "completion_tokens": 80,
      "total_tokens": 230
    }
  }
}
```

### 成功的内容生成响应
```json
{
  "success": true,
  "rawResponse": "{\n  \"operations\": [\n    {\n      \"targetId\": \"test_target_123\",\n      \"newText\": \"2018-2022年就读于北京大学计算机科学与技术学院，获得本科学位\",\n      \"action\": \"replace\"\n    }\n  ]\n}",
  "parsedResult": {
    "operations": [
      {
        "targetId": "test_target_123",
        "newText": "2018-2022年就读于北京大学计算机科学与技术学院，获得本科学位",
        "action": "replace"
      }
    ]
  }
}
```

## 下一步

一旦后端测试通过，你可以：

1. **集成到前端**: 在Vue组件中调用 `UpdateManager.handleSmartEdit()`
2. **添加UI界面**: 创建聊天输入框和编辑预览
3. **测试完整流程**: 从用户输入到文档更新的端到端测试

## 故障排除联系

如果遇到无法解决的问题：
1. 查看测试接口的完整输出
2. 检查服务器控制台日志
3. 确认API服务商的配额和限制
4. 尝试更简单的测试输入
