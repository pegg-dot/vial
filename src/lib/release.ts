// The one place the application version comes from.
//
// It was previously stated in four places that had drifted apart: package.json said 10.0.0, the
// live /api/health/live endpoint reported 5.0.0 (a hardcoded zod default in config/env.ts that
// production never overrode), .env.example said 6.0.0, and the Stripe metadata said 5.0.0 again.
// Every one of them claimed to be the release. A version that has to be updated in four places is
// a version that will be wrong in three of them, which makes "what is actually deployed?"
// unanswerable at exactly the moment it matters.
//
// package.json is the source, because it is the one a release process actually bumps.
import pkg from "../../package.json";

/** The application version, e.g. "10.0.0". */
export const RELEASE: string = pkg.version;

/** Service identifier used in health and telemetry payloads. */
export const SERVICE_NAME = "vialgrade";
