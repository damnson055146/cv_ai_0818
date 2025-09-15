## GPT-5 `/v1/responses` 请求体示例（多文件 + 结构化输出）

以下示例展示如何上传多个文件（PDF / MD / TXT / DOCX），并让模型输出一个结构化 JSON，包含两个字段：

- `result`: 用于前端编辑器弹框显示与执行修改的 patch 列表  
- `reasoning`: 模型给出的简短理由或思考，不包含完整思维链

---

### 请求体（JSON）

```json
POST https://api.openai.com/v1/responses
Content-Type: application/json
Authorization: Bearer $OPENAI_API_KEY

{
  "model": "gpt-5",
  "input": [
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "You are a document editing assistant. Read the attached files and propose safe, minimal patches. IMPORTANT: Output MUST follow the provided JSON schema exactly. Do NOT include chain-of-thought; provide brief justifications only."
        }
      ]
    },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "请综合这些文件，找出需要重写/合并/删除的段落，并给出可直接应用到编辑器的 patches。" },
        { "type": "input_file", "file_id": "file_pdf_abcdef" },
        { "type": "input_file", "file_id": "file_md_123456" },
        { "type": "input_file", "file_id": "file_txt_7890ab" },
        { "type": "input_file", "file_id": "file_docx_cdef12" }
      ]
    }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "DocEditWithReasoning",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["result", "reasoning"],
        "properties": {
          "result": {
            "type": "object",
            "additionalProperties": false,
            "required": ["doc_id", "patches"],
            "properties": {
              "doc_id": { "type": "string", "description": "Target document id in your system" },
              "patches": {
                "type": "array",
                "description": "Atomic edits to apply in the editor",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["op", "selector"],
                  "properties": {
                    "op": {
                      "type": "string",
                      "enum": ["insert","replace","delete","move"],
                      "description": "Edit operation"
                    },
                    "selector": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": ["type"],
                      "properties": {
                        "type": { "type": "string", "enum": ["paragraph","heading","range"] },
                        "id":   { "type": "string", "description": "Node id if available" },
                        "start":{ "type": "integer", "minimum": 0, "description": "Range start (UTF-16 index) if type=range" },
                        "end":  { "type": "integer", "minimum": 0, "description": "Range end (exclusive) if type=range" }
                      }
                    },
                    "payload": {
                      "type": "object",
                      "additionalProperties": false,
                      "properties": {
                        "text": { "type": "string", "description": "New text, if op=insert/replace" },
                        "attrs": { "type": "object", "description": "Optional attributes for the node" },
                        "to_selector": {
                          "type": "object",
                          "additionalProperties": false,
                          "properties": {
                            "type": { "type": "string", "enum": ["paragraph","heading","range"] },
                            "id":   { "type": "string" },
                            "start":{ "type": "integer", "minimum": 0 },
                            "end":  { "type": "integer", "minimum": 0 }
                          },
                          "description": "Target selector for move operation"
                        }
                      }
                    },
                    "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
                  }
                }
              }
            }
          },
          "reasoning": {
            "type": "object",
            "additionalProperties": false,
            "required": ["summary", "per_patch"],
            "properties": {
              "summary": {
                "type": "string",
                "description": "Brief, non-sensitive justification of the overall edit plan (no chain-of-thought)."
              },
              "per_patch": {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": false,
                  "required": ["patch_index","why"],
                  "properties": {
                    "patch_index": { "type": "integer", "minimum": 0, "description": "Index into result.patches" },
                    "why": { "type": "string", "description": "One-sentence reason for this patch" },
                    "evidence": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["file_id"],
                        "properties": {
                          "file_id": { "type": "string" },
                          "page":    { "type": "integer", "minimum": 1, "description": "If applicable" },
                          "loc":     { "type": "string", "description": "Section/paragraph hint" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "max_output_tokens": 2048,
  "reasoning": { "effort": "medium" },
  "metadata": { "doc_id": "doc_9f1d", "user_id": "PSJ-001", "feature": "doc-edit" }
}


//返回示例
{
  "id": "resp_abc987",
  "output_text": null,
  "raw": null,
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": {
          "result": {
            "doc_id": "doc_9f1d",
            "patches": [
              {
                "op": "replace",
                "selector": { "type": "paragraph", "id": "para_12" },
                "payload": { "text": "新的段落内容，用于替换旧段落" },
                "confidence": 0.85
              },
              {
                "op": "delete",
                "selector": { "type": "heading", "id": "heading_3" },
                "confidence": 0.90
              }
            ]
          },
          "reasoning": {
            "summary": "删除与合并重复内容，明确结构层次",
            "per_patch": [
              {
                "patch_index": 0,
                "why": "原段落表达重复且不够精炼",
                "evidence": [
                  { "file_id": "file_md_123456", "page": 1, "loc": "paragraph 5" }
                ]
              },
              {
                "patch_index": 1,
                "why": "标题归类不当，影响文档结构",
                "evidence": [
                  { "file_id": "file_pdf_abcdef", "page": 2, "loc": "heading 3" }
                ]
              }
            ]
          }
        }
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 530,
    "completion_tokens": 120,
    "total_tokens": 650
  }
}
