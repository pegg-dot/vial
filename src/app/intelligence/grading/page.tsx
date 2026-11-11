import { permanentRedirect } from "next/navigation";

// One method page. The research-file letters are a section of /how-we-check now.
export default function ResearchFileGradingRedirect() {
  permanentRedirect("/how-we-check#grade-checks");
}
