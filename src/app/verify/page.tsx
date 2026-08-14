import type { Metadata } from "next";
import { VerifyClient } from "./verify-client";

// /verify is the site's single highest-intent query — someone with a vendor name or a COA code in
// hand, deciding whether to spend money. It previously shipped with no metadata of its own, so
// every search result for it read as the generic site title and said nothing about what the tool
// does. The description states the input and the honest limit, not a safety promise.
export const metadata: Metadata = {
  title: "Check a vendor, compound, or COA",
  description:
    "Paste a vendor, a website, a compound, or a Janoshik COA code to see what VialGrade holds on it — lab tests, reputation, and enforcement history. Unknown stays unknown.",
  alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
  return <VerifyClient />;
}
