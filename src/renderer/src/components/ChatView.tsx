import { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'
import type { ChatTurn } from '../env'
import Logo from './Logo'

interface Props {
  log: ChatTurn[]
  streaming: boolean
  streamBuffer: string
  onAsk: (question: string) => void
  onCancel: () => void
}

export default function ChatView(props: Props): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [props.log.length, props.streamBuffer])

  const submit = (): void => {
    const question = draft.trim()
    if (!question || props.streaming) return
    setDraft('')
    props.onAsk(question)
  }

  return (
    <div className="chat-page">
      <div className="chat-scroll">
        {props.log.length === 0 && !props.streaming && (
          <div className="chat-empty">
            <Logo size={44} />
            <h2>Ask your notes</h2>
            <p>
              Everything you've captured is searchable. Try “what did I promise last week?” or
              “summarize my meetings from today”.
            </p>
          </div>
        )}
        {props.log.map((turn, index) => (
          <div key={index} className={`chat-bubble ${turn.role}`}>
            {turn.role === 'assistant' ? (
              <div dangerouslySetInnerHTML={{ __html: marked.parse(turn.text) as string }} />
            ) : (
              turn.text
            )}
          </div>
        ))}
        {props.streaming && (
          <div className="chat-bubble assistant">
            {props.streamBuffer ? (
              <div
                dangerouslySetInnerHTML={{ __html: marked.parse(props.streamBuffer) as string }}
              />
            ) : (
              <span className="spinner" />
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="chat-inputbar">
        <input
          type="text"
          placeholder="Ask about your meetings…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        {props.streaming ? (
          <button className="secondary" onClick={props.onCancel}>
            Stop
          </button>
        ) : (
          <button className="primary" disabled={!draft.trim()} onClick={submit}>
            Ask
          </button>
        )}
      </div>
    </div>
  )
}
