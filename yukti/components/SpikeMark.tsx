// A small radial 4-spoke "spike" glyph — Yukti's content marker, echoing
// the editorial brand-mark idea from the Claude design system but drawn in
// our own cyan/green register. Used inline beside source lists and section
// labels. Purely decorative.

interface Props {
  size?: number
  color?: string
}

export default function SpikeMark({ size = 12, color = "#34d399" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle" }}
      aria-hidden="true">
      <path
        d="M12 2 L13.4 9.2 L20.5 6.2 L14.8 11.2 L22 12 L14.8 12.8 L20.5 17.8 L13.4 14.8 L12 22 L10.6 14.8 L3.5 17.8 L9.2 12.8 L2 12 L9.2 11.2 L3.5 6.2 L10.6 9.2 Z"
        fill={color}
      />
    </svg>
  )
}
