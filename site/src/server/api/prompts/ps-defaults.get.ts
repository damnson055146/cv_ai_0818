import { defineEventHandler } from 'h3'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig(event) as any
    const pub = (config.public || {}) as any
    const backendBase: string = String(pub?.backendBase || '')
    const baseDir: string = String(pub?.psPrompts?.baseDir || '')
    const files = (pub?.psPrompts?.files || {}) as { ps_requirement?: string; guidance_outline?: string; guidance_element?: string }

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

    // Prefer backend DB keys when available
    if (backendBase) {
      try {
        const [r1, r2, r3] = await Promise.all([
          $fetch(`${backendBase}/api/prompts/ps_requirement`).catch(() => null),
          $fetch(`${backendBase}/api/prompts/guidance_outline`).catch(() => null),
          $fetch(`${backendBase}/api/prompts/guidance_element`).catch(() => null),
        ])
        const ps_requirement = (r1 as any)?.value || ''
        const guidance_outline = (r2 as any)?.value || ''
        const guidance_element = (r3 as any)?.value || ''
        if (ps_requirement || guidance_outline || guidance_element) {
          return { status: 'ok', data: { ps_requirement, guidance_outline, guidance_element } }
        }
      } catch {}
    }

    // Fallback to reading from configured files
    if (!baseDir || !files) {
      return { status: 'error', error: 'psPrompts not configured' }
    }
    const ps_requirement = await safeRead(files.ps_requirement)
    const guidance_outline = await safeRead(files.guidance_outline)
    const guidance_element = await safeRead(files.guidance_element)
    return { status: 'ok', data: { ps_requirement, guidance_outline, guidance_element } }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'failed to load ps defaults' }
  }
})
