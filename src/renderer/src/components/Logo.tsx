interface Props {
  size?: number
  className?: string
}

/**
 * The Scribe mark: a fountain-pen nib — the scribe's oldest tool.
 * Breather hole and slit are knocked out of the solid form.
 */
export default function Logo({ size = 28, className }: Props): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      className={className}
      role="img"
      aria-label="Scribe logo"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M0,-42
           C 22,-34 30,-10 25,12
           C 21,28 12,37 0,44
           C -12,37 -21,28 -25,12
           C -30,-10 -22,-34 0,-42
           Z
           M0,-1.5 a 5.5,5.5 0 1,0 0,11 a 5.5,5.5 0 1,0 0,-11
           Z
           M-1.3,12.5 L1.3,12.5 L1.3,36 L0,39 L-1.3,36 Z"
      />
    </svg>
  )
}
