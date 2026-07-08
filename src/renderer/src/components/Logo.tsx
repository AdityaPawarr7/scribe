interface Props {
  size?: number
  className?: string
}

/**
 * The Muesli mark: a cluster of grain silhouettes forming one rosette —
 * separate grains, stronger together.
 */
export default function Logo({ size = 28, className }: Props): React.JSX.Element {
  const grains = 7
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      className={className}
      role="img"
      aria-label="Muesli logo"
      fill="currentColor"
    >
      {Array.from({ length: grains }, (_, i) => {
        const angle = (360 / grains) * i
        return (
          <path
            key={i}
            transform={`rotate(${angle}) translate(0 -24)`}
            d="M0,-20 C8,-13 9,10 0,20 C-9,10 -8,-13 0,-20 Z"
          />
        )
      })}
      <circle r="7.5" />
    </svg>
  )
}
