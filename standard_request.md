# Standard Request Format

When calling the Responses API to generate CVs, personal statements, or recommendation letters, follow the structure below and select the template that matches the target document.

## File Upload Rules
- Only PDF files can be attached to the request body.
- Convert `.md`, `.txt`, `.docx`, images, and any other formats to PDF before uploading; send the resulting PDF file ID in the request.
- If you need to provide multiple references, append additional `{ "type": "input_file", "file_id": "..." }` blocks after converting each source to PDF.

## Personal Statement (`doc_type: ps`)

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
        { "type": "input_file", "file_id": "file_pdf_psMaterials" },
        { "type": "input_text", "text": "Please generate a personal statement in English based on the attached materials." }
      ]
    }
  ],
  "reasoning": { "effort": "medium" },
  "metadata": {
    "doc_type": "ps",
    "language": "en",
    "chat_id": "chat_ps_001",
    "doc_ids": ["1759928384273", "1759928384278"]
  },
  "max_output_tokens": 32768
}
```

## Curriculum Vitae (`doc_type: cv`)

```json
{
  "model": "gpt-5",
  "prompt": {
    "id": "pmpt_68d9f3fe3eb48197abd642d6984d6d3e01709ceef551872c",
    "version": "2",
    "variables": {
      "doc_type": "cv",
      "language": "en"
      // Add all variables required by the CV prompt, e.g. "candidate_name", "target_role", "keywords", ...
    }
  },
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_file", "file_id": "file_pdf_cvSources" },
        { "type": "input_text", "text": "Create a professional CV in English using the information inside the attached PDF." }
      ]
    }
  ],
  "reasoning": { "effort": "medium" },
  "metadata": {
    "doc_type": "cv",
    "language": "en",
    "chat_id": "chat_cv_001",
    "doc_ids": ["cv_doc_20240901"]
  },
  "max_output_tokens": 32768
}
```

## Recommendation Letter (`doc_type: rec`)

```json
{
  "model": "gpt-5",
  "prompt": {
    "id": "pmpt_68c1963af49081948e0b1a7d51152a530b1e5a4c68ba8796",
    "version": "2",
    "variables": {
      "doc_type": "rec",
      "language": "en"
      // Provide every placeholder required by the REC prompt, e.g. "student_name", "relationship", "achievements", ...
    }
  },
  "input": [
    {
      "role": "user",
      "content": [
        { "type": "input_file", "file_id": "file_pdf_recEvidence" },
        { "type": "input_text", "text": "Draft an English recommendation letter for the student using the attached PDF evidence." }
      ]
    }
  ],
  "reasoning": { "effort": "medium" },
  "metadata": {
    "doc_type": "rec",
    "language": "en",
    "chat_id": "chat_rec_001",
    "doc_ids": ["rec_doc_20240901"]
  },
  "max_output_tokens": 32768
}
```

## Notes
- `prompt.variables` must include every placeholder defined in the selected prompt; adjust names and values to match your configuration.
- Replace the example `file_id`, `chat_id`, and `doc_ids` with the values returned from your system.
- Adjust `language`, `reasoning.effort`, or `max_output_tokens` as needed for your scenario.
