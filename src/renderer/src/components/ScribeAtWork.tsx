/**
 * The scribe at work: a little line-art notetaker who scribbles away while
 * Scribe records — pausing now and then to push up his glasses, and every
 * so often wiping the sweat off his brow. Pure SVG + CSS, tinted by the
 * app accent, still under prefers-reduced-motion.
 */
export default function ScribeAtWork(): React.JSX.Element {
  return (
    <div className="scribe-at-work" aria-label="Scribe is listening and taking notes" role="img">
      <svg viewBox="0 0 150 110" width="150" height="110" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {/* desk */}
        <line x1="10" y1="96" x2="140" y2="96" />
        {/* paper */}
        <g className="saw-paper">
          <rect x="78" y="86" width="42" height="10" rx="2" strokeWidth="2" />
          <line className="saw-ink saw-ink1" x1="84" y1="90" x2="100" y2="90" strokeWidth="1.6" />
          <line className="saw-ink saw-ink2" x1="84" y1="93" x2="108" y2="93" strokeWidth="1.6" />
          <line className="saw-ink saw-ink3" x1="103" y1="90" x2="114" y2="90" strokeWidth="1.6" />
        </g>
        {/* mug of coffee, essential equipment */}
        <g strokeWidth="2">
          <path d="M22 96 v-9 h11 v9" />
          <path d="M33 89.5 c5 0 5 5 0 5" />
          <path className="saw-steam" d="M27.5 82 c-1.6 -2.4 1.6 -3.6 0 -6" strokeWidth="1.5" />
        </g>
        {/* body */}
        <path d="M52 96 C 51 78, 53 68, 60 62" />
        <path d="M60 62 C 66 58, 72 58, 76 60" />
        {/* head (bobs gently while writing) */}
        <g className="saw-head">
          <circle cx="66" cy="42" r="13" />
          {/* hair tuft */}
          <path d="M57 33 c 3 -4, 9 -6, 14 -4" strokeWidth="2" />
          {/* glasses */}
          <g className="saw-glasses">
            <circle cx="62" cy="44" r="4.6" strokeWidth="2" />
            <circle cx="73" cy="44" r="4.6" strokeWidth="2" />
            <line x1="66.5" y1="44" x2="68.5" y2="44" strokeWidth="2" />
          </g>
          {/* content little smile */}
          <path d="M65 51.5 c 2 1.4, 4 1.2, 5.5 0" strokeWidth="1.8" />
        </g>
        {/* sweat drops — appear only during the wipe beat */}
        <path className="saw-sweat saw-sweat1" d="M84 30 c 2.4 3.4, 2.4 5.4, 0 6.6 c -2.4 -1.2 -2.4 -3.2, 0 -6.6 Z" fill="currentColor" stroke="none" />
        <path className="saw-sweat saw-sweat2" d="M90 36 c 1.8 2.6, 1.8 4, 0 5 c -1.8 -1 -1.8 -2.4, 0 -5 Z" fill="currentColor" stroke="none" />
        {/* writing arm + pen: never stops */}
        <g className="saw-pen-arm">
          <path d="M62 64 C 70 70, 78 76, 86 80" />
          <line x1="86" y1="80" x2="94" y2="88" />
        </g>
        {/* free arm: three poses, cross-faded — rest → push glasses → wipe brow */}
        <g className="saw-arm saw-arm-rest">
          <path d="M58 66 C 54 74, 52 82, 54 90" />
        </g>
        <g className="saw-arm saw-arm-glasses">
          <path d="M58 66 C 54 60, 56 52, 60 48" />
        </g>
        <g className="saw-arm saw-arm-wipe">
          <path d="M58 66 C 56 56, 62 44, 74 36" />
        </g>
      </svg>
      <div className="saw-caption">
        <span className="saw-caption-line" />
        scribing
        <span className="saw-caption-line" />
      </div>
    </div>
  )
}
