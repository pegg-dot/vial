// Hand-built cartoon "peptide" art for VIAL — friendly gumdrop characters with the credibility of a
// lab. Purely decorative (aria-hidden). The star is VialBuddy, a vial mascot with a face; the rest are
// scene props (plain vials, molecule, droplet, shield-check, COA doc, magnifier) used across the page.

export function VialBuddy({ className = "", liquid = "#6d5dfc", cap = "#3b4fe0", face = true }: { className?: string; liquid?: string; cap?: string; face?: boolean }) {
  return (
    <svg viewBox="0 0 150 200" className={className} aria-hidden>
      <ellipse cx="75" cy="188" rx="42" ry="8" fill="rgba(17,18,20,.08)" />
      {/* cap */}
      <rect x="52" y="6" width="46" height="16" rx="7" fill={cap} />
      <rect x="46" y="20" width="58" height="20" rx="8" fill={cap} />
      <rect x="50" y="24" width="12" height="12" rx="4" fill="#fff" opacity=".25" />
      {/* glass body */}
      <rect x="40" y="38" width="70" height="150" rx="30" fill="#ffffff" stroke="rgba(17,18,20,.10)" strokeWidth="3" />
      {/* liquid */}
      <path d="M43 118 q32 -14 64 0 v42 a27 27 0 0 1 -27 27 h-10 a27 27 0 0 1 -27 -27 z" fill={liquid} />
      <path d="M43 118 q32 -14 64 0 v10 q-32 12 -64 0 z" fill="#fff" opacity=".18" />
      <circle cx="88" cy="150" r="5" fill="#fff" opacity=".4" />
      <circle cx="95" cy="166" r="3" fill="#fff" opacity=".35" />
      {/* long shine on glass */}
      <rect x="49" y="52" width="8" height="52" rx="4" fill="#fff" opacity=".9" />
      {face && (
        <g>
          <circle cx="64" cy="86" r="7.5" fill="#111214" />
          <circle cx="90" cy="86" r="7.5" fill="#111214" />
          <circle cx="66.5" cy="83.5" r="2.4" fill="#fff" />
          <circle cx="92.5" cy="83.5" r="2.4" fill="#fff" />
          <path d="M67 100 q8 9 16 0" fill="none" stroke="#111214" strokeWidth="4" strokeLinecap="round" />
          <circle cx="55" cy="98" r="5" fill="#ff8fa3" opacity=".55" />
          <circle cx="99" cy="98" r="5" fill="#ff8fa3" opacity=".55" />
        </g>
      )}
    </svg>
  );
}

export function VialPlain({ className = "", liquid = "#8fffd6", cap = "#22b8a0" }: { className?: string; liquid?: string; cap?: string }) {
  return (
    <svg viewBox="0 0 80 130" className={className} aria-hidden>
      <rect x="30" y="2" width="20" height="9" rx="4.5" fill={cap} />
      <rect x="25" y="9" width="30" height="15" rx="5" fill={cap} />
      <rect x="22" y="22" width="36" height="102" rx="17" fill="#ffffff" stroke="rgba(17,18,20,.10)" strokeWidth="2" />
      <path d="M24 78 q16 -8 32 0 v29 a15 15 0 0 1 -15 15 h-2 a15 15 0 0 1 -15 -15 z" fill={liquid} />
      <rect x="28" y="32" width="5" height="34" rx="2.5" fill="#ffffff" opacity=".85" />
    </svg>
  );
}

export function ArtMolecule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 110" className={className} aria-hidden>
      <g stroke="rgba(17,18,20,.20)" strokeWidth="4" strokeLinecap="round">
        <line x1="30" y1="34" x2="62" y2="30" /><line x1="62" y1="30" x2="80" y2="66" />
        <line x1="80" y1="66" x2="44" y2="78" /><line x1="44" y1="78" x2="30" y2="34" />
      </g>
      <circle cx="30" cy="34" r="15" fill="#6d5dfc" /><circle cx="62" cy="30" r="12" fill="#3b4fe0" />
      <circle cx="80" cy="66" r="14" fill="#8fffd6" /><circle cx="44" cy="78" r="11" fill="#ffb787" />
      <circle cx="26" cy="30" r="4" fill="#fff" opacity=".7" /><circle cx="58" cy="26" r="3.4" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function ArtDroplet({ className = "", fill = "#4c6ef5" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 80 100" className={className} aria-hidden>
      <path d="M40 6 C60 40 70 54 70 68 a30 30 0 0 1 -60 0 C10 54 20 40 40 6 Z" fill={fill} />
      <path d="M28 62 a12 12 0 0 0 6 16" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function ArtShieldCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 110" className={className} aria-hidden>
      <path d="M50 6 L88 20 V54 C88 78 72 96 50 104 C28 96 12 78 12 54 V20 Z" fill="#3b4fe0" />
      <path d="M50 14 L80 25 V54 C80 73 68 88 50 95 C32 88 20 73 20 54 V25 Z" fill="#eef1ff" />
      <path d="M36 55 l10 11 l20 -25" fill="none" stroke="#3b4fe0" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtCoa({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 110 130" className={className} aria-hidden>
      <rect x="16" y="10" width="78" height="110" rx="12" fill="#ffffff" stroke="rgba(17,18,20,.12)" strokeWidth="3" />
      <rect x="28" y="24" width="40" height="8" rx="4" fill="#3b4fe0" />
      <rect x="28" y="42" width="54" height="5" rx="2.5" fill="rgba(17,18,20,.14)" />
      <rect x="28" y="54" width="46" height="5" rx="2.5" fill="rgba(17,18,20,.14)" />
      <g>
        <rect x="28" y="72" width="10" height="18" rx="2" fill="#8fffd6" />
        <rect x="42" y="64" width="10" height="26" rx="2" fill="#6d5dfc" />
        <rect x="56" y="76" width="10" height="14" rx="2" fill="#ffb787" />
        <rect x="70" y="68" width="10" height="22" rx="2" fill="#4c6ef5" />
      </g>
      <circle cx="80" cy="104" r="15" fill="#3b4fe0" />
      <path d="M73 104 l5 5 l9 -11" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArtMagnifierVial({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 130" className={className} aria-hidden>
      <rect x="30" y="26" width="34" height="80" rx="15" fill="#ffffff" stroke="rgba(17,18,20,.12)" strokeWidth="3" />
      <rect x="36" y="18" width="22" height="12" rx="5" fill="#3b4fe0" />
      <path d="M32 72 q15 -7 30 0 v18 a14 14 0 0 1 -14 14 h-2 a14 14 0 0 1 -14 -14 z" fill="#8fffd6" />
      <circle cx="82" cy="66" r="28" fill="rgba(76,110,245,.12)" stroke="#3b4fe0" strokeWidth="7" />
      <line x1="102" y1="86" x2="120" y2="104" stroke="#3b4fe0" strokeWidth="9" strokeLinecap="round" />
      <path d="M74 66 l6 6 l12 -14" fill="none" stroke="#3b4fe0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
