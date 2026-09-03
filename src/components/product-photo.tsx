"use client";
import { useState } from "react";
import { ProductVisual } from "./product-visual";
import { displayProductTitle } from "@/lib/product-title";

// Shows the vendor's real product photo (aggregated from their own product page) when we
// have one for a Live listing; otherwise falls back to the generated vial illustration.
// If the remote image fails to load (hotlink block, moved URL), it falls back too — so a
// broken image is never shown.
export function ProductPhoto({
  name,
  quantity,
  accent,
  imageUrl,
  compact = false,
  decorative = false,
}: {
  name: string;
  quantity: string;
  accent: [string, string, string];
  imageUrl?: string;
  compact?: boolean;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return <ProductVisual name={name} quantity={quantity} accent={accent} compact={compact} decorative={decorative} />;
  }
  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-white ${compact ? "h-[148px]" : "min-h-[280px]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary vendor CDNs; next/image would need a per-host allowlist */}
      <img
        src={imageUrl}
        alt={decorative ? "" : `${displayProductTitle(name, quantity)} — the vendor's own product photo`}
        aria-hidden={decorative || undefined}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`h-full w-full object-contain ${compact ? "p-3" : "p-6"}`}
      />
    </div>
  );
}
