import { loadSettings } from './settings'
import type { ConcentrateModel, ConnectionTestResult, ModelListResult } from '@shared/types'

const BASE = 'https://api.concentrate.ai/v1'

export function resolveApiKey(): string {
  return loadSettings().concentrateApiKey || process.env.CONCENTRATE_API_KEY || ''
}

interface RawModel {
  id: string
  display_name?: string
  owned_by?: string
  type?: string
}

let cachedModels: ConcentrateModel[] | null = null

/** Fetch the model fortress catalog (GET /v1/models), cached for the app session. */
export async function listModels(): Promise<ModelListResult> {
  if (cachedModels) return { ok: true, models: cachedModels }
  const apiKey = resolveApiKey()
  if (!apiKey) return { ok: false, models: [], error: 'No API key configured' }

  try {
    const response = await fetch(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!response.ok) {
      return { ok: false, models: [], error: `HTTP ${response.status}` }
    }
    const parsed = (await response.json()) as { data?: RawModel[] }
    const models = (parsed.data ?? [])
      .filter((raw) => raw.id && raw.type !== 'embedding')
      .map((raw) => ({
        id: raw.id,
        displayName: raw.display_name || raw.id,
        provider: raw.owned_by || 'other'
      }))
    if (models.length === 0) return { ok: false, models: [], error: 'Empty catalog' }
    cachedModels = models
    return { ok: true, models }
  } catch (error) {
    return { ok: false, models: [], error: error instanceof Error ? error.message : String(error) }
  }
}

/** Cheap end-to-end check: does the key work and can this model generate? */
export async function testConnection(model: string): Promise<ConnectionTestResult> {
  const apiKey = resolveApiKey()
  if (!apiKey) return { ok: false, message: 'Add an API key first' }

  try {
    const response = await fetch(`${BASE}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: 'Reply with exactly: OK',
        max_output_tokens: 500
      })
    })
    if (!response.ok) {
      const hints: Record<number, string> = {
        401: 'Key rejected — double-check it',
        402: 'Key works but the account has no credits',
        424: 'Key works but this model is unavailable right now — pick another'
      }
      return { ok: false, message: hints[response.status] ?? `Concentrate returned HTTP ${response.status}` }
    }
    const parsed = (await response.json()) as { status?: string; model?: string }
    if (parsed.status === 'completed' || parsed.status === 'incomplete') {
      return { ok: true, message: `Connected — ${parsed.model ?? model} responded` }
    }
    return { ok: false, message: `Model returned status "${parsed.status ?? 'unknown'}"` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
