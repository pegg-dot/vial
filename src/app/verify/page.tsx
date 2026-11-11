import { permanentRedirect } from "next/navigation";

// One source checker. The old interactive verifier stays paused; its address forwards to the
// research source checker so a saved link still lands somewhere that works.
export default function VerifyRedirect() {
  permanentRedirect("/intelligence/verify");
}
