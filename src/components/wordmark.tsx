import Link from "next/link";

// The header mark is the SAME V used for the app icon and favicon — previously this drew a
// CSS vial-capsule that appeared nowhere else in the brand, so the site's most-seen surface
// disagreed with its own logo. Inlined as SVG (not an <img>) so it inherits crispness at any
// density and never flashes on load. Geometry matches public/brand/vialgrade-icon.svg.
// The gradient and clip ids must be unique per rendered instance. The header and the footer both
// draw this mark, so a single hardcoded set put three duplicate ids in every page's DOM — invalid
// HTML, and fragile besides: the second instance's url(#...) fills silently resolve against the
// FIRST instance's defs. It looked fine and was wrong. The structural accessibility audit catches a
// duplicate id, which is what surfaced this, and is what stops it coming back.
function Mark({ className = "size-8", idPrefix = "wm" }: { className?: string; idPrefix?: string }) {
  const violet = `${idPrefix}-v-violet`;
  const mint = `${idPrefix}-v-mint`;
  const clip = `${idPrefix}-v-clip`;
  return (
    <span className={`relative block shrink-0 ${className}`} aria-hidden>
      <svg viewBox="0 0 512 512" className="size-full" role="presentation">
        <defs>
          <radialGradient id={violet} cx="0.94" cy="0.06" r="0.72">
            <stop offset="0%" stopColor="#6d5dfc" stopOpacity="0.78" />
            <stop offset="55%" stopColor="#3c3682" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#111214" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={mint} cx="0.06" cy="0.94" r="0.72">
            <stop offset="0%" stopColor="#8fffd6" stopOpacity="0.44" />
            <stop offset="55%" stopColor="#34544a" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#111214" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clip}>
            <rect x="16" y="16" width="480" height="480" rx="116" ry="116" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x="16" y="16" width="480" height="480" fill="#111214" />
          <rect x="16" y="16" width="480" height="480" fill={`url(#${violet})`} />
          <rect x="16" y="16" width="480" height="480" fill={`url(#${mint})`} />
        </g>
        <path d="M138 144 L214 144 L256 262 L298 144 L374 144 L284 386 L228 386 Z" fill="#ffffff" />
      </svg>
    </span>
  );
}

export function Wordmark({ inverse = false, idPrefix }: { inverse?: boolean; idPrefix?: string }) {
  return (
    <Link href="/" aria-label="VialGrade home" className="inline-flex items-center gap-2.5">
      <Mark idPrefix={idPrefix} />
      <span className={`text-[15px] font-black tracking-[0.18em] ${inverse ? "text-white" : "text-[#111214]"}`}>VialGrade</span>
    </Link>
  );
}

export { Mark as VialGradeMark };
