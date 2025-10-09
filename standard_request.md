# Standard Request Format

Use this template when calling the Responses API to generate a personal statement (PS):

```json
{
  "model": "gpt-5",
  "prompt": {
    "id": "pmpt_68de136700e48197b05842b60ba5960201ffd68c188eb393",
    "version": "2",
    "variables": {
      "doc_type": "ps",
      "language": "en"
      // Fill in every variable declared inside the prompt, e.g. "student_name", "program", "deadline", ...
    }
  },
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_file", "file_id": "file-PTM2MFxQPtfT7oKoPWaWxV" },
        { "type": "input_text", "text": "Please generate a PS in English based on the attached materials." }
      ]
    }
  ],
  "reasoning": { "effort": "medium" },
  "metadata": {
    "doc_type": "ps",
    "language": "en",
    "chat_id": "chat_mghzx4b5",
    "doc_ids": ["1759928384273", "1759928384278"]
  },
  "max_output_tokens": 32768
}
```

## Notes
- `prompt.variables` must include every placeholder defined in the prompt; adjust names/values to match your prompt configuration.
- Replace `file_id` with the ID returned from your file upload step.
- Update `chat_id` and `doc_ids` to track the conversation and associated documents.
- Tweak `language`, `reasoning.effort`, or `max_output_tokens` if your scenario requires different settings.
