import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return { ok: true, msg: 'pong from src/server/api' }
})


