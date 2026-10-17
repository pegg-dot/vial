// No purchasing links or new account watchlist writes during evidence-only review.
export function ProductActions({ slug, vendorName, origin, externalUrl }: {
  slug: string;
  vendorName: string;
  origin?: "demo" | "live";
  externalUrl?: string;
}) {
  void slug; void vendorName; void origin; void externalUrl;
  return (
    <div className="rounded-[12px] border border-[#111214]/15 bg-[var(--background)] px-4 py-3 text-xs font-medium leading-6 text-[var(--muted)]">
      Historical source observation only, not an offer, vendor endorsement or purchasing referral.
      New saved-product accounts and personal alerts are paused for privacy review.
      A reported laboratory result does not establish what any delivered vial contains.
    </div>
  );
}
