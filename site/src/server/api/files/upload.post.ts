import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event) as any
    const apiKey: string = config.openaiApiKey || config.public?.OPENAI_API_KEY || ''
    if (!apiKey) {
      return { status: 'error', error: 'OPENAI_API_KEY missing' }
    }

    const body = await readBody(event)
    const name: string = String(body?.name || 'upload.pdf')
    const base64: string = String(body?.contentBase64 || '')
    const purpose: string = String(body?.purpose || 'assistants')

    if (!base64) return { status: 'error', error: 'contentBase64 required' }

    const binary = Buffer.from(base64, 'base64')
    const blob = new Blob([binary])
    const form = new FormData()
    form.append('file', blob, name)
    form.append('purpose', purpose)

    const res = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form as any
    })

    const ct = res.headers.get('content-type') || ''
    if (!res.ok) {
      const err = ct.includes('application/json') ? await res.json() : await res.text()
      return { status: 'error', error: err }
    }
    const data = await res.json()
    return { status: 'ok', file: { id: data?.id, filename: data?.filename, bytes: data?.bytes } }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'upload failed' }
  }
})


