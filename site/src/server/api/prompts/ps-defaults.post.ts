import { defineEventHandler, readBody } from 'h3'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const config: any = useRuntimeConfig()
    const pub = config.public as any
    const backendBase: string = String(pub?.backendBase || '')
    const baseDir: string = pub?.psPrompts?.baseDir || ''
    const files = pub?.psPrompts?.files || {}

    const requirementPath = join(baseDir, files.ps_requirement || 'info_ps_requirement.md')
    const outlinePath = join(baseDir, files.guidance_outline || 'guidance_outline.md')
    const elementPath = join(baseDir, files.guidance_element || 'guidance_element.md')

    const nextRequirement = (body?.ps_requirement ?? '') as string
    const nextOutline = (body?.guidance_outline ?? '') as string
    const nextElement = (body?.guidance_element ?? '') as string

    // Prefer saving to backend DB
    if (backendBase) {
      try {
        const tasks: Promise<any>[] = []
        if (typeof body?.ps_requirement === 'string') {
          tasks.push($fetch(`${backendBase}/api/prompts/ps_requirement`, { method: 'POST', body: { value: nextRequirement } }))
        }
        if (typeof body?.guidance_outline === 'string') {
          tasks.push($fetch(`${backendBase}/api/prompts/guidance_outline`, { method: 'POST', body: { value: nextOutline } }))
        }
        if (typeof body?.guidance_element === 'string') {
          tasks.push($fetch(`${backendBase}/api/prompts/guidance_element`, { method: 'POST', body: { value: nextElement } }))
        }
        if (tasks.length) {
          await Promise.all(tasks)
          return { status: 'ok' }
        }
      } catch (e: any) {
        // fall through to filesystem if backend not reachable
      }
    }

    // Fallback: Only overwrite files that are provided; allow partial updates
    await Promise.all([
      typeof body?.ps_requirement === 'string' ? fs.writeFile(requirementPath, nextRequirement, 'utf-8') : Promise.resolve(),
      typeof body?.guidance_outline === 'string' ? fs.writeFile(outlinePath, nextOutline, 'utf-8') : Promise.resolve(),
      typeof body?.guidance_element === 'string' ? fs.writeFile(elementPath, nextElement, 'utf-8') : Promise.resolve()
    ])

    return { status: 'ok' }
  } catch (e: any) {
    return { status: 'error', error: e?.message || 'failed to save prompts' }
  }
})


