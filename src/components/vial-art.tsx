// Bold flat-outline "sticker" art for VialGrade — Gumroad discipline (thick black strokes, flat fills, no
// gradients, no soft shine) with Ascend's scientific edge (measurement ticks, clean geometry).
// Purely decorative (aria-hidden). Names kept stable so section components don't need rewiring.
const INK = "#111214";

// The vial: a hard-outlined bottle with a fill level and measurement ticks. No face — sharp, not cute.
export function VialBuddy({ className = "", liquid = "#2b31d8", cap = INK }: { className?: string; liquid?: string; cap?: string; face?: boolean }) {
  return (
    <svg viewBox="0 0 92 150" className={className} aria-hidden fill="none">
      <rect x="30" y="4" width="32" height="14" rx="3" fill={cap} stroke={INK} strokeWidth="4" />
      <rect x="24" y="18" width="44" height="16" rx="4" fill={cap} stroke={INK} strokeWidth="4" />
      <path d="M20 46 a20 20 0 0 1 20 -14 h12 a20 20 0 0 1 20 14 v66 a24 24 0 0 1 -24 24 h-4 a24 24 0 0 1 -24 -24 z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M20 92 h52 v20 a24 24 0 0 1 -24 24 h-4 a24 24 0 0 1 -24 -24 z" fill={liquid} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <line x1="20" y1="60" x2="30" y2="60" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="74" x2="27" y2="74" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
export const VialPlain = VialBuddy;

export function ArtMolecule({ className = "", a = "#2b31d8", b = "#12b3a6", c = "#fff" }: { className?: string; a?: string; b?: string; c?: string }) {
  return (
    <svg viewBox="0 0 118 118" className={className} aria-hidden fill="none">
      <g stroke={INK} strokeWidth="5" strokeLinecap="round">
        <line x1="34" y1="38" x2="66" y2="32" /><line x1="66" y1="32" x2="84" y2="70" />
        <line x1="84" y1="70" x2="46" y2="82" /><line x1="46" y1="82" x2="34" y2="38" />
      </g>
      <circle cx="34" cy="38" r="16" fill={a} stroke={INK} strokeWidth="4.5" />
      <circle cx="66" cy="32" r="12" fill={c} stroke={INK} strokeWidth="4.5" />
      <circle cx="84" cy="70" r="15" fill={b} stroke={INK} strokeWidth="4.5" />
      <circle cx="46" cy="82" r="11" fill={c} stroke={INK} strokeWidth="4.5" />
    </svg>
  );
}

export function ArtDroplet({ className = "", fill = "#2b31d8" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 84 104" className={className} aria-hidden fill="none">
      <path d="M42 8 C64 42 74 56 74 70 a32 32 0 0 1 -64 0 C10 56 20 42 42 8 Z" fill={fill} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M28 66 a12 12 0 0 0 6 16" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArtFlask({ className = "", fill = "#12b3a6" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 110 120" className={className} aria-hidden fill="none">
      <path d="M44 14 h22 M48 14 v30 L24 92 a12 12 0 0 0 11 18 h44 a12 12 0 0 0 11 -18 L66 44 V14" fill="#fff" stroke={INK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M35 74 h44 l14 20 a12 12 0 0 1 -11 16 H32 a12 12 0 0 1 -11 -16 z" fill={fill} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="46" cy="92" r="3.5" fill="#fff" /><circle cx="64" cy="98" r="3" fill="#fff" />
    </svg>
  );
}

export function ArtShieldCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 104 114" className={className} aria-hidden fill="none">
      <path d="M52 6 L90 20 V56 C90 80 74 98 52 106 C30 98 14 80 14 56 V20 Z" fill="#2b31d8" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M36 56 l11 12 l22 -27" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtCoa({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 112 132" className={className} aria-hidden fill="none">
      <rect x="16" y="10" width="80" height="112" rx="8" fill="#fff" stroke={INK} strokeWidth="5" />
      <line x1="30" y1="28" x2="66" y2="28" stroke="#2b31d8" strokeWidth="7" strokeLinecap="round" />
      <line x1="30" y1="44" x2="82" y2="44" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <g stroke={INK} strokeWidth="4.5" strokeLinejoin="round">
        <rect x="30" y="72" width="11" height="20" fill="#12b3a6" /><rect x="46" y="62" width="11" height="30" fill="#2b31d8" />
        <rect x="62" y="76" width="11" height="16" fill="#fff" />
      </g>
      <circle cx="82" cy="104" r="15" fill="#2b31d8" stroke={INK} strokeWidth="4.5" />
      <path d="M75 104 l5 5 l9 -11" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtTag({ className = "", fill = "#12b3a6" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 118 100" className={className} aria-hidden fill="none">
      <path d="M8 20 a12 12 0 0 1 12 -12 h44 a12 12 0 0 1 8.5 3.5 l38 38 a10 10 0 0 1 0 14 l-30 30 a10 10 0 0 1 -14 0 l-38 -38 A12 12 0 0 1 8 55 z" fill={fill} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <circle cx="34" cy="34" r="9" fill="#fff" stroke={INK} strokeWidth="5" />
    </svg>
  );
}

export function ArtMagnifierVial({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 132 132" className={className} aria-hidden fill="none">
      <path d="M32 34 a12 12 0 0 1 12 -10 h6 a12 12 0 0 1 12 10 v46 a15 15 0 0 1 -15 15 h-0 a15 15 0 0 1 -15 -15 z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <rect x="36" y="16" width="22" height="12" rx="3" fill={INK} />
      <path d="M32 70 h30 v10 a15 15 0 0 1 -15 15 a15 15 0 0 1 -15 -15 z" fill="#12b3a6" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <circle cx="84" cy="66" r="28" fill="#fff" stroke={INK} strokeWidth="6" />
      <path d="M76 66 l6 6 l14 -16" stroke="#2b31d8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="104" y1="86" x2="122" y2="104" stroke={INK} strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}
