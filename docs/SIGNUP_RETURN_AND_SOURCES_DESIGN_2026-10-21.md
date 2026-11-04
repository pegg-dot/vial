# Signup, return reasons and a "Sources" layer: design options
Date: October 21, 2026
Status: **DESIGN ONLY. Nothing here is built, and every item marked OWNER needs the owner's decision first.**

## Why this exists
The owner wants (1) vendor/manufacturer visibility back, in a research framing and with no selling language; (2) more signups, including a first-visit prompt for signed-out readers; (3) reasons for readers to return. Today none of these is possible as-is, for reasons recorded in code:

- `src/lib/public-research-release.ts`: the evidence-only quarantine exists "while prior seller/COA sources, privacy rights, and editorial claims are reviewed". It is a route quarantine, not a legal clearance. Referral/commerce endpoints return 410.
- `src/app/register/page.tsx`: new registration is **paused** because saved compounds, searches, preferences and alerts "might reveal health interests". Existing accounts keep access.
- `docs/ORIGINAL_MARKETPLACE_RESTORATION_2026-10-19.md` parks vendor scores, material grades, referral fees, seller import and personalized monitoring, and says there is no import of old merchant price, inventory, buyer behaviour, certificates or reputation data.

So the real blocker for items 2 and 3 is a privacy decision, not UI work. Item 1 is a sourcing/legal decision.

## Part A. Sources layer (no buy links)

**Question researchers ask:** "Can I trust this material, and who stands behind it?" The answer does not need a "where to buy" link.

Proposed content per compound dossier, in a "Sources" section:
1. **Manufacturers / originators** as recorded in public documents (patent assignee, trial sponsor, regulatory filings, published papers). Source link on every row.
2. **Testing laboratories** that have published results for the compound, with the document linked.
3. **Published analytical results (COAs)**: shown as documents with batch, method and date as written, and the label "document as published, not independently verified".
4. **Nothing outbound to a seller**: no price, stock, cart, referral URL or "available from" wording.

Options:
| Option | What it is | Risk |
|---|---|---|
| A1 Originators and sponsors only | Built from trial sponsors and paper affiliations we already hold | Lowest. Reuses data in the existing dossiers. |
| A2 + test labs and published COAs | Adds lab documents | Needs rights/licensing review and the "not verified" labelling. OWNER. |
| A3 Restore vendor click-throughs | Old referral behaviour | Conflicts with the quarantine and the 410 policy. Needs legal review. OWNER. Not recommended now. |

**Recommendation:** A1 first (no new rights questions), A2 after review. A3 stays parked. Note that A1 gives the admin analytics something real to count again (clicks to source documents, not to sellers).

**Open question (OWNER):** do researchers want to buy through us at all? This is untested. The usability study is still unrun, so it is the cheapest place to ask.

## Part B. First-visit signup prompt

Constraint: registration is paused (privacy). Two ways forward:

- **B1 (no account): email-only update list.** A prompt collects an email for a weekly "what changed" digest. No saved compounds or interests, so no health-interest profile. Still personal data: needs a privacy notice line, consent checkbox, unsubscribe and deletion path. OWNER to approve.
- **B2 (accounts): re-open registration.** Only after the privacy review concludes. Then the prompt links to /register.

Prompt behaviour (either option):
- Signed-out, first visit only, remembered dismissal (localStorage with try/catch, never required).
- A slim dismissible bar, not a blocking modal: show after about 10 seconds **or** first dossier scroll, whichever is first. Blocking modals on arrival hurt mobile search ranking and trust.
- Never on `/legal/*`, `/login`, `/register`, `/admin*`, and not for signed-in users.
- Honest copy: say what is collected and what is not.
- Must pass the 24px target rule and the single-`<main>` landmark checks already in CI.

## Part C. Reasons to come back
In order of privacy risk (lowest first):
1. **"What changed" digest, global**: new trial status changes and new records across all compounds. No per-person interest data. Works with B1.
2. **Public changelog / "recently updated" strip** on /intelligence. No signup needed, and gives returning readers a reason to look.
3. **Per-compound follow with alerts**: highest value, but it reveals which compounds a person cares about. Needs B2 and the privacy review. OWNER.
4. **Saved comparisons**: same privacy class as 3. Existing accounts already have this via /watchlist and /saved-searches.

## Suggested order
1. Part C item 2 (recently-updated strip): no new data, no decisions.
2. Part A1 (originators/sponsors section).
3. Decide B1 vs B2, then build the prompt and the digest.
4. Parts A2 and C3 after the privacy and rights reviews.

## Owner decisions (recorded 2026-10-21, in chat)
1. **Email-only list (B1):** owner deferred to the assistant. Recommendation: yes, build it, but only after the "recently updated" strip and with a consent line, unsubscribe and deletion path. It stores no compound interests.
2. **Published lab COAs (A2):** owner said acceptable. Still do the rights check on each document before showing it, and keep the label "document as published, not independently verified".
3. **Vendor click-throughs (A3):** owner is undecided but leans toward having them. NOT decided. Do not build or re-enable. See HANDOFF for the framing and what must happen first.
4. **Usability study question "would you buy through this site?":** owner undecided. Recommendation: ask it. It is the cheapest evidence for item 3.
