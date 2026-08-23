// Re-export of the shared helper so a script and the in-deployment scheduler cannot drift.
// The definition lives in src/server/collect/vendor-domains.ts.
export { vendorDomains } from "../../src/server/collect/vendor-domains.ts";
