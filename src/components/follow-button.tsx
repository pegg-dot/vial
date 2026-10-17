// Following creates persistent profiles of research interests. This surface is
// deliberately read-only while relevant health-data consent and rights are audited.
export function FollowButton({ entityType, entitySlug, entityName, initialFollowed }: {
  entityType: "compound" | "vendor" | "listing";
  entitySlug: string;
  entityName?: string;
  initialFollowed: boolean;
}) {
  void entityType; void entitySlug; void entityName; void initialFollowed;
  return <p className="rounded-[10px] border border-[#111214]/10 bg-white/80 px-3 py-2 text-xs font-semibold text-[var(--muted)]">Personal research alerts are paused during privacy review.</p>;
}
