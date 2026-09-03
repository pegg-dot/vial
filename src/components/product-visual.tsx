import type { CSSProperties } from "react";
import { displayProductTitle } from "@/lib/product-title";

export function ProductVisual({
  name,
  quantity,
  accent,
  compact = false,
  decorative = false,
}: {
  name: string;
  quantity: string;
  accent: [string, string, string];
  compact?: boolean;
  decorative?: boolean;
}) {
  const style = {
    "--accent-a": accent[0],
    "--accent-b": accent[1],
    "--accent-c": accent[2],
  } as CSSProperties;

  return (
    <div
      className={`product-visual relative isolate overflow-hidden ${compact ? "h-[148px]" : "min-h-[280px]"}`}
      style={style}
      aria-label={decorative ? undefined : `Stylized vial illustration for ${displayProductTitle(name, quantity)}`}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,.95),transparent_32%),linear-gradient(145deg,var(--accent-c),#fff_48%,color-mix(in_srgb,var(--accent-a)_14%,white))]" />
      <div className="absolute -right-[12%] -top-[16%] size-[68%] rounded-full bg-[var(--accent-b)] opacity-20 blur-3xl" />
      <div className="absolute -bottom-[28%] -left-[12%] size-[70%] rounded-full bg-[var(--accent-a)] opacity-15 blur-3xl" />
      <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[46%] ${compact ? "scale-[.55]" : "scale-100"}`}>
        <div className="relative h-[216px] w-[116px] drop-shadow-[0_28px_24px_rgba(16,18,24,.22)]">
          <div className="absolute left-1/2 top-0 h-[28px] w-[70px] -translate-x-1/2 rounded-t-[13px] rounded-b-[8px] border border-black/15 bg-[linear-gradient(180deg,#d9dde4,#8c939f_55%,#d9dde4)] shadow-[inset_0_1px_1px_rgba(255,255,255,.8)]" />
          <div className="absolute left-1/2 top-[22px] h-[188px] w-[104px] -translate-x-1/2 rounded-[20px_20px_25px_25px] border border-black/10 bg-[linear-gradient(90deg,rgba(255,255,255,.88),rgba(255,255,255,.46)_24%,rgba(255,255,255,.84)_74%,rgba(255,255,255,.38))] shadow-[inset_10px_0_18px_rgba(255,255,255,.7),inset_-8px_0_14px_rgba(10,20,40,.07)] backdrop-blur-sm" />
          <div className="absolute left-1/2 top-[57px] flex h-[112px] w-[92px] -translate-x-1/2 flex-col items-center justify-center rounded-[6px] border border-white/60 bg-white/80 px-2 text-center shadow-sm backdrop-blur">
            <span className="text-[8px] font-semibold uppercase tracking-[.22em] text-black/38">VialGrade index</span>
            <span className="mt-3 max-w-[78px] text-[14px] font-black leading-[.9] tracking-[-.05em] text-[#111214]">{name}</span>
            <span className="mt-2 text-[9px] font-semibold text-black/45">{quantity}</span>
            <span className="mt-3 h-[3px] w-10 rounded-full bg-[linear-gradient(90deg,var(--accent-a),var(--accent-b))]" />
          </div>
          <div className="absolute bottom-[9px] left-1/2 h-[21px] w-[86px] -translate-x-1/2 rounded-[50%] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,.6),rgba(103,118,141,.12))]" />
        </div>
      </div>
      
    </div>
  );
}
