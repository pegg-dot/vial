// Friendly cartoon "peptide" props — vials, molecules, droplets — that float like Gumroad's coins but
// in VIAL's scientific palette. Purely decorative (aria-hidden). Used to give the homepage the
// gumdrop-cartoony-but-credible personality: playful shapes, clean science.

export function CartoonVial({ className = "", fill = "#6d5dfc", cap = "#4c6ef5" }: { className?: string; fill?: string; cap?: string }) {
  return (
    <svg viewBox="0 0 80 130" className={className} aria-hidden>
      <rect x="30" y="2" width="20" height="9" rx="4.5" fill={cap} />
      <rect x="25" y="9" width="30" height="15" rx="5" fill={cap} />
      <rect x="22" y="22" width="36" height="102" rx="17" fill="#ffffff" stroke="rgba(17,18,20,.10)" strokeWidth="2" />
      <path d="M24 74 q16 -8 32 0 v33 a15 15 0 0 1 -15 15 h-2 a15 15 0 0 1 -15 -15 z" fill={fill} opacity="0.85" />
      <circle cx="41" cy="92" r="3.5" fill="#ffffff" opacity="0.55" />
      <circle cx="47" cy="104" r="2.2" fill="#ffffff" opacity="0.45" />
      <rect x="28" y="32" width="5" height="34" rx="2.5" fill="#ffffff" opacity="0.85" />
    </svg>
  );
}

export function CartoonMolecule({ className = "", a = "#8fffd6", b = "#6d5dfc", c = "#4c6ef5" }: { className?: string; a?: string; b?: string; c?: string }) {
  return (
    <svg viewBox="0 0 110 110" className={className} aria-hidden>
      <g stroke="rgba(17,18,20,.22)" strokeWidth="4" strokeLinecap="round">
        <line x1="30" y1="34" x2="62" y2="30" />
        <line x1="62" y1="30" x2="80" y2="66" />
        <line x1="80" y1="66" x2="44" y2="78" />
        <line x1="44" y1="78" x2="30" y2="34" />
      </g>
      <circle cx="30" cy="34" r="15" fill={b} />
      <circle cx="62" cy="30" r="12" fill={c} />
      <circle cx="80" cy="66" r="14" fill={a} />
      <circle cx="44" cy="78" r="11" fill="#ffb787" />
      <circle cx="26" cy="30" r="4" fill="#fff" opacity=".7" />
      <circle cx="58" cy="26" r="3.4" fill="#fff" opacity=".7" />
    </svg>
  );
}

export function CartoonDroplet({ className = "", fill = "#8fffd6" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 80 100" className={className} aria-hidden>
      <path d="M40 6 C60 40 70 54 70 68 a30 30 0 0 1 -60 0 C10 54 20 40 40 6 Z" fill={fill} />
      <path d="M28 62 a12 12 0 0 0 6 16" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

// A scattered scene of floating props for hero-style sections.
export function GumdropScene({ variant = "hero" }: { variant?: "hero" | "band" }) {
  if (variant === "band") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <CartoonMolecule className="gum-float-slow absolute -left-6 top-10 w-24 opacity-90" />
        <CartoonVial className="gum-float absolute right-8 top-6 w-14 opacity-90" fill="#8fffd6" cap="#22c1a6" />
        <CartoonDroplet className="gum-float-rev absolute bottom-6 left-1/2 w-12 opacity-80" fill="#ffb787" />
      </div>
    );
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* soft gumdrop glows */}
      <div className="gum-blob gum-float absolute -left-24 top-24 size-64 bg-[radial-gradient(circle,rgba(143,255,214,.45),transparent_70%)] blur-2xl" />
      <div className="gum-blob-2 gum-float-rev absolute -right-16 top-10 size-72 bg-[radial-gradient(circle,rgba(109,93,252,.30),transparent_70%)] blur-2xl" />
      <div className="gum-blob gum-float-slow absolute bottom-0 left-1/4 size-56 bg-[radial-gradient(circle,rgba(96,165,250,.28),transparent_70%)] blur-2xl" />
      {/* cartoon props, like Gumroad's floating coins */}
      <CartoonVial className="gum-float absolute left-[6%] top-[30%] hidden w-16 drop-shadow-sm sm:block lg:w-20" fill="#6d5dfc" cap="#4c6ef5" />
      <CartoonMolecule className="gum-float-slow absolute right-[7%] top-[22%] hidden w-24 drop-shadow-sm sm:block lg:w-28" />
      <CartoonDroplet className="gum-float-rev absolute right-[14%] bottom-[14%] hidden w-12 drop-shadow-sm md:block lg:w-16" fill="#8fffd6" />
      <CartoonVial className="gum-float-rev absolute left-[11%] bottom-[8%] hidden w-12 drop-shadow-sm md:block lg:w-14" fill="#ffb787" cap="#ff9b57" />
    </div>
  );
}
