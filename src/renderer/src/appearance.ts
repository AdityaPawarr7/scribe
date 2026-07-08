interface AppearanceLike {
  theme: 'dark' | 'light'
  accent: string
  fontPack: string
}

export const ACCENTS = [
  { hex: '#5ee0c4', name: 'Mint' },
  { hex: '#7ab8ff', name: 'Sky' },
  { hex: '#c792ea', name: 'Lilac' },
  { hex: '#ff8fab', name: 'Rose' },
  { hex: '#e8a13c', name: 'Amber' },
  { hex: '#9ccc65', name: 'Moss' }
]

export const FONT_PACKS = [
  { id: 'system', label: 'System (San Francisco)' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'mono', label: 'Monospace' },
  { id: 'serif', label: 'Serif' }
] as const

export function applyAppearance(settings: AppearanceLike): void {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  root.dataset.font = settings.fontPack
  root.style.setProperty('--accent', settings.accent)
}
