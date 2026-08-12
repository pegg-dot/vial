import Link from "next/link";

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" aria-label="VialGrade home" className="inline-flex items-center gap-2.5">
      <span
        className={`relative grid size-8 place-items-center overflow-hidden rounded-[10px] border ${
          inverse ? "border-white/20 bg-white/10" : "border-black/10 bg-[#111214]"
        }`}
      >
        <span className="absolute inset-[5px] rounded-[6px] bg-[linear-gradient(145deg,#6d5dfc_0%,#b777ff_48%,#8fffd6_100%)]" />
        <span className="relative h-3 w-[7px] rounded-[3px_3px_4px_4px] border border-white/70 bg-white/20 shadow-[inset_0_-4px_4px_rgba(255,255,255,.22)]" />
      </span>
      <span className={`text-[15px] font-black tracking-[0.18em] ${inverse ? "text-white" : "text-[#111214]"}`}>VialGrade</span>
    </Link>
  );
}
