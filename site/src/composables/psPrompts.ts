import { useLocalStorage } from '@vueuse/core'

export interface PsPromptBundle {
  ps_requirement: string
  guidance_outline: string
  guidance_element: string
  outline_prefix?: string
  body_prefix?: string
}

type OverridesMap = Record<string, Partial<PsPromptBundle>> // keyed by document/chat id

export function usePsPrompts() {
  const defaults = useState<PsPromptBundle>('ps.prompts.defaults', () => ({
    ps_requirement: '',
    guidance_outline: '',
    guidance_element: '',
    outline_prefix: '[PS-OUTLINE]\nYou are drafting a PS outline only. Output structure and bullet points.',
    body_prefix: '[PS-BODY]\nYou are drafting the PS body text. Strictly follow the given outline.'
  }))
  const overrides = useLocalStorage<OverridesMap>('ps_prompts_overrides', {})

  async function loadDefaultPrompts(): Promise<void> {
    try {
      const res: any = await $fetch('/api/prompts/ps-defaults')
      if (res?.status === 'ok' && res?.data) {
        defaults.value = {
          ps_requirement: res.data.ps_requirement || '',
          guidance_outline: res.data.guidance_outline || '',
          guidance_element: res.data.guidance_element || ''
        }
      }
    } catch (e) {
      // ignore network errors; keep empty defaults
    }
  }

  function getEffectivePrompts(scopeId: string): PsPromptBundle {
    const o = (overrides.value || {})[scopeId] || {}
    return {
      ps_requirement: o.ps_requirement ?? defaults.value.ps_requirement,
      guidance_outline: o.guidance_outline ?? defaults.value.guidance_outline,
      guidance_element: o.guidance_element ?? defaults.value.guidance_element,
      outline_prefix: o.outline_prefix ?? defaults.value.outline_prefix,
      body_prefix: o.body_prefix ?? defaults.value.body_prefix
    }
  }

  function setOverrides(scopeId: string, partial: Partial<PsPromptBundle>) {
    const next = { ...(overrides.value || {}) }
    next[scopeId] = { ...(next[scopeId] || {}), ...partial }
    overrides.value = next
  }

  function clearOverrides(scopeId: string) {
    const next = { ...(overrides.value || {}) }
    delete next[scopeId]
    overrides.value = next
  }

  return { loadDefaultPrompts, getEffectivePrompts, setOverrides, clearOverrides, defaults }
}


