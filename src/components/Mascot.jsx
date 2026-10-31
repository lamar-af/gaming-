// Bloop, the Bubble Quest octopus (from design/bubble-quest-prototype.html). Decorative only.
export default function Mascot({ size = 60, waving = false, className = '' }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g className={waving ? 'wave' : ''}>
        <path d="M22 70 q-6 26 8 34 q4-14 12-22" fill="#8E7DFF" />
        <path d="M40 78 q-4 28 12 32 q2-16 6-28" fill="#8E7DFF" />
        <path d="M62 80 q4 28 18 28 q-4-16-6-30" fill="#8E7DFF" />
        <path d="M80 72 q14 24 28 22 q-10-12-16-28" fill="#8E7DFF" />
      </g>
      <ellipse cx="62" cy="52" rx="44" ry="40" fill="#8E7DFF" />
      <ellipse cx="50" cy="32" rx="12" ry="7" fill="#B4A9FF" />
      <circle cx="46" cy="54" r="11" fill="#fff" />
      <circle cx="78" cy="54" r="11" fill="#fff" />
      <circle cx="48" cy="56" r="5.5" fill="#1B1446" />
      <circle cx="80" cy="56" r="5.5" fill="#1B1446" />
      <circle cx="50" cy="53" r="1.8" fill="#fff" />
      <circle cx="82" cy="53" r="1.8" fill="#fff" />
      <ellipse cx="36" cy="70" rx="6" ry="3.5" fill="#FF9DB0" />
      <ellipse cx="90" cy="70" rx="6" ry="3.5" fill="#FF9DB0" />
      <path
        d="M54 72 q8 9 16 0"
        stroke="#1B1446"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
