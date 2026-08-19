// The contact and legal identity strings that render verbatim on /legal/contact, /legal/terms and
// /legal/privacy — the pages that promise a human will answer.
//
// Change a value here and every page that promises a reply updates with it.
//
// Two values are still unset and are written to FAIL LOUDLY rather than quietly: they read as
// unfinished on sight, so an unreplaced value is obvious instead of a broken promise nobody notices.
// See the note on each.

/** Corrections, disputes, and general contact. */
export const CONTACT_EMAIL = "admin@vialgrade.com";

/**
 * Access, correction, and deletion requests for account data.
 *
 * Deliberately the same mailbox as the others. Separate addresses are a routing nicety, not a legal
 * requirement, and one address that is actually read beats three that are not.
 */
export const PRIVACY_EMAIL = "admin@vialgrade.com";

/** Copyright, trademark, and other legal notices. */
export const LEGAL_EMAIL = "admin@vialgrade.com";

/**
 * The company or individual that operates VialGrade, as it should appear in the terms.
 *
 * "VialGrade" alone is accurate and sufficient while the site is run by an individual with no
 * registered company — the terms read correctly without naming a corporate entity that does not
 * exist. If a company is ever formed, put its registered name here.
 */
export const LEGAL_ENTITY = "VialGrade";

/**
 * Whose law governs the terms.
 *
 * Set by the owner. Note the clause in /legal/terms deliberately keeps a carve-out preserving any
 * consumer-protection right the reader's OWN jurisdiction grants and does not allow them to waive —
 * the site is readable from anywhere, and a Florida choice-of-law clause cannot strip a reader in
 * another state or country of rights their local law gives them. Claiming otherwise would be both
 * unenforceable and the kind of overreach this site criticises in vendor marketing.
 */
export const GOVERNING_LAW = "the State of Florida";

/**
 * Where disputes are heard.
 *
 * Stated at state level rather than naming a county, because the county is not known and an
 * incorrect one is worse than a general one — a venue clause naming the wrong court invites a
 * challenge to the whole clause.
 */
export const VENUE = "the state and federal courts located in Florida";

/**
 * Who hosts the site and stores the database, named for the privacy notice.
 *
 * Verified from the deployment itself rather than assumed: the project deploys to Vercel, and the
 * database is the Neon Postgres resource `neon-amber-bucket` provisioned through Vercel's
 * marketplace. Both process data on VialGrade's behalf, which is what the notice has to disclose.
 */
export const HOSTING_PROVIDER = "Vercel (hosting) and Neon (database), both in the United States";

/** How quickly we say we will reply. Stated publicly, so keep it a number that can be met. */
export const RESPONSE_TARGET_DAYS = 10;

/** True when a governing-law clause can be stated. Used to omit it rather than print a placeholder. */
export const HAS_GOVERNING_LAW = GOVERNING_LAW.trim().length > 0 && VENUE.trim().length > 0;
