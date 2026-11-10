// The vendor's initials on its own accent colour. The accent is data (each vendor record carries
// its pair), so it is the one background on these pages that is not a kit tone; the ink border and,
// above row size, the hard shadow are what tie it to everything around it.
export function VendorMark({ initials, accent, size = "md" }: { initials: string; accent: [string, string]; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-10 rounded-[10px] text-[10px]" : size === "lg" ? "hard-sm size-20 rounded-[18px] text-lg" : "hard-sm size-13 rounded-[14px] text-xs";
  return (
    <span
      className={`ink grid shrink-0 place-items-center font-extrabold tracking-[.08em] text-white ${sizeClass}`}
      style={{ background: accent[0] }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
