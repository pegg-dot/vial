import type { VendorStatus } from "@/lib/types";

/**
 * What a vendor's profile status means to the person reading the page, in plain words.
 *
 * The stored words are ours, not theirs: "unclaimed · independent" reads to a buyer like a
 * compliment ("independent!") when it actually means the vendor has never touched this page and
 * nothing on it is their marketing. Display copy only — the stored status is untouched.
 */
export function vendorClaimLabel(status: VendorStatus): string {
  switch (status) {
    case "participating":
      return "The vendor manages this page";
    case "claimed":
      return "The vendor claimed this page";
    default:
      return "Unclaimed page — nothing here is written by them";
  }
}

/** The same answer where the row is one truncated line (directory rows, cards). */
export function vendorClaimLabelShort(status: VendorStatus): string {
  switch (status) {
    case "participating":
      return "Managed by the vendor";
    case "claimed":
      return "Claimed by the vendor";
    default:
      return "Unclaimed page";
  }
}
