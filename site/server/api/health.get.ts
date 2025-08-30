import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({ ok: true, time: Date.now() }))


