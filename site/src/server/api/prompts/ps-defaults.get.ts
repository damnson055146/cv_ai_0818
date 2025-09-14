import { defineEventHandler } from 'h3'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event) as any
    const pub = (config.public || {}) as any
    const baseDir: string = String(pub?.psPrompts?.baseDir || '')
    const files = (pub?.psPrompts?.files || {}) as { ps_requirement?: string; guidance_outline?: string; guidance_element?: string }

    if (!baseDir || !files) {
      return { status: 'error', error: 'psPrompts not configured' }
    }

    const safeRead = async (p?: string) => {
      try {
        if (!p) return ''
        const full = join(baseDir, p)
        const buf = await readFile(full)
        return buf.toString('utf-8')
      } catch {
        return ''
      }
    }

    const ps_requirement = await safeRead(files.ps_requirement)
    const guidance_outline = await safeRead(files.guidance_outline)
    const guidance_element = await safeRead(files.guidance_element)

    return { status: 'ok', data: { ps_requirement, guidance_outline, guidance_element } }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'failed to load ps defaults' }
  }
})
