export function VendorMark({ initials, accent, size = "md" }: { initials: string; accent: [string, string]; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-10 rounded-[10px] text-[10px]" : size === "lg" ? "size-20 rounded-[18px] text-lg" : "size-13 rounded-[14px] text-xs";
  return (
    <span
      className={`ink grid shrink-0 place-items-center font-black tracking-[.08em] text-white ${sizeClass}`}
      style={{ background: accent[0] }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
