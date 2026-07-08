import { useEffect, useMemo, useState } from 'react'
import type { ConcentrateModel } from '../env'

interface Props {
  value: string
  onChange: (model: string) => void
  compact?: boolean
}

const CUSTOM = '__custom__'
const FREE_MODELS = new Set(['gpt-oss-120b', 'gpt-oss-20b'])

/** Shown until the live fortress catalog loads (or when it can't). */
const FALLBACK: ConcentrateModel[] = [
  { id: 'claude-opus-4.8', displayName: 'Claude Opus 4.8', provider: 'anthropic' },
  { id: 'claude-fable-5', displayName: 'Claude Fable 5', provider: 'anthropic' },
  { id: 'claude-sonnet-5', displayName: 'Claude Sonnet 5', provider: 'anthropic' },
  { id: 'claude-haiku-4.5', displayName: 'Claude Haiku 4.5', provider: 'anthropic' },
  { id: 'gpt-5.5', displayName: 'GPT-5.5', provider: 'openai' },
  { id: 'gpt-5.4', displayName: 'GPT-5.4', provider: 'openai' },
  { id: 'gpt-oss-120b', displayName: 'OpenAI gpt-oss 120B', provider: 'openai' },
  { id: 'gemini-3.5-flash', displayName: 'Gemini 3.5 Flash', provider: 'google' },
  { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', provider: 'google' }
]

/** Providers surfaced first; everything else lands under "More providers". */
const FEATURED_PROVIDERS = ['anthropic', 'openai', 'google']

let catalogCache: ConcentrateModel[] | null = null

export default function ModelSelect(props: Props): React.JSX.Element {
  const [catalog, setCatalog] = useState<ConcentrateModel[]>(catalogCache ?? FALLBACK)
  const [customMode, setCustomMode] = useState(false)

  useEffect(() => {
    if (catalogCache) return
    void window.scribe.concentrate.models().then((result) => {
      if (result.ok && result.models.length > 0) {
        catalogCache = result.models
        setCatalog(result.models)
      }
    })
  }, [])

  const groups = useMemo(() => {
    const byProvider = new Map<string, ConcentrateModel[]>()
    for (const model of catalog) {
      const key = FEATURED_PROVIDERS.includes(model.provider) ? model.provider : 'more providers'
      if (!byProvider.has(key)) byProvider.set(key, [])
      byProvider.get(key)!.push(model)
    }
    return [...FEATURED_PROVIDERS, 'more providers']
      .filter((provider) => byProvider.has(provider))
      .map((provider) => ({ provider, models: byProvider.get(provider)! }))
  }, [catalog])

  const knownIds = useMemo(() => new Set(catalog.map((m) => m.id)), [catalog])
  const valueIsCustom = props.value !== '' && !knownIds.has(props.value)

  if (customMode || valueIsCustom) {
    return (
      <div className="model-select-custom">
        <input
          type="text"
          placeholder="any model ID from concentrate.ai/models"
          value={props.value}
          autoFocus={customMode}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setCustomMode(false)
            if (valueIsCustom) props.onChange('claude-opus-4.8')
          }}
        >
          back to list
        </button>
      </div>
    )
  }

  return (
    <select
      className={props.compact ? 'model-select compact' : 'model-select'}
      value={props.value}
      title={`Model: ${props.value}`}
      onChange={(event) => {
        if (event.target.value === CUSTOM) setCustomMode(true)
        else props.onChange(event.target.value)
      }}
    >
      {groups.map((group) => (
        <optgroup key={group.provider} label={group.provider}>
          {group.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
              {FREE_MODELS.has(model.id) ? ' — FREE' : ''}
            </option>
          ))}
        </optgroup>
      ))}
      <optgroup label="other">
        <option value={CUSTOM}>Custom model ID…</option>
      </optgroup>
    </select>
  )
}
