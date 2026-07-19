export function VendorMark({ initials, accent, size = "md" }: { initials: string; accent: [string, string]; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-10 rounded-xl text-[10px]" : size === "lg" ? "size-20 rounded-[24px] text-lg" : "size-13 rounded-2xl text-xs";
  return (
    <span
      className={`grid shrink-0 place-items-center border border-white/50 font-black tracking-[.08em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_8px_24px_rgba(0,0,0,.12)] ${sizeClass}`}
      style={{ background: `linear-gradient(145deg, ${accent[0]}, ${accent[1]} 68%, #111214)` }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
