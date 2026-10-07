/** Yale-blue shield crest with a "Y", used in the navbar, footer and chat. */
export function Crest({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 3 L58 11 V30 C58 46 46 56 32 61 C18 56 6 46 6 30 V11 Z" fill="var(--yale-blue)" stroke="#fff" strokeWidth="3" />
      <path d="M20 18 L32 34 L44 18 M32 34 V48" stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Simple bulldog head mark (Handsome Dan nod) for the chat bubble and hero. */
export function Bulldog({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* ears */}
      <path d="M10 18 Q8 6 20 10 L22 20 Z" fill="#fff" />
      <path d="M54 18 Q56 6 44 10 L42 20 Z" fill="#fff" />
      {/* head */}
      <ellipse cx="32" cy="34" rx="22" ry="20" fill="#fff" />
      {/* jowls */}
      <ellipse cx="22" cy="44" rx="10" ry="8" fill="#e9eef5" />
      <ellipse cx="42" cy="44" rx="10" ry="8" fill="#e9eef5" />
      {/* eyes */}
      <circle cx="23" cy="30" r="3.2" fill="var(--yale-blue)" />
      <circle cx="41" cy="30" r="3.2" fill="var(--yale-blue)" />
      {/* brow */}
      <path d="M18 24 Q23 21 27 25 M37 25 Q41 21 46 24" stroke="var(--yale-blue)" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* nose */}
      <ellipse cx="32" cy="38" rx="6" ry="4" fill="var(--yale-blue)" />
      {/* mouth */}
      <path d="M32 42 V46 M25 48 Q32 52 39 48" stroke="var(--yale-blue)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
