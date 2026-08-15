import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { HOSTING_PROVIDER, PRIVACY_EMAIL, RESPONSE_TARGET_DAYS } from "@/lib/contact";

export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/legal/privacy" } };

// This page describes what the code actually does today — not an intention, not a template. Each
// section below has a file behind it, and they must be changed together:
//
//   page views              src/app/api/track/view/route.ts, src/server/analytics/visitors.ts
//   visitor hash            src/server/outbound/attribution.ts (visitorHash)
//   outbound clicks + UTMs  src/server/outbound/clicks.ts, attribution.ts (tagDestination)
//   accounts and sessions   src/server/auth/register.ts, repository.ts, session-envelope.ts
//   push notifications      src/server/push/repository.ts
//   retention windows       src/server/db/retention.ts
//
// A privacy notice that claims less collection than the software performs is a deceptive practice,
// so treat any change to those files as a change to this page.
export default function Page() {
  return <LegalPage eyebrow="Legal" title="Privacy notice" updated="Updated August 2026" sections={[

["What this covers","This is what VialGrade collects when you use the site, and what happens to it. VialGrade sells nothing and takes no payment, so there is no order, card, or shipping information anywhere in it. Everything described here is what the software does today."],

["Every page view is counted","Opening a page records one row: the path you opened without its query string, a coarse page type such as product or vendor, the bare hostname of the site that linked you here — never the full referring URL — a device class of mobile, tablet, or desktop, the time, and the visitor hash described below. Your IP address and your browser's user-agent string are not stored. Requests that identify themselves as crawlers are dropped before anything is written, and administrative pages are never counted."],

["How we count people without knowing who they are","To count visitors rather than raw hits we take your IP address and user-agent string, combine them with a secret key held on the server and with today's date, and keep only the resulting hash. Because the date is part of the input, the same person produces a different hash tomorrow. That is enough to say how many people visited today, and not enough to follow anyone across days or build a profile. The IP address and user-agent themselves are never written down, and the hash is never linked to an account."],

["When you click through to a vendor","The buy control goes through /go, which records the click and redirects you to the vendor's own product page. We store which listing, vendor, and compound you clicked, the destination hostname, your device class, a short random click reference, the same daily visitor hash, the time, and — when your browser provides it — the VialGrade page you clicked from. That record is how we can tell a vendor how much traffic VialGrade sent them."],

["What the vendor receives","We add ordinary campaign parameters to the outgoing link: utm_source=vialgrade, utm_medium=referral, utm_campaign set to the compound, utm_content set to the listing, and the click reference as vg. Any parameter the vendor's own URL already sets is left alone. Those parameters describe where the visit came from and carry nothing about you. Once you arrive, you are on the vendor's site under their privacy policy, and they see what any site sees when a visitor arrives — your IP address and your browser — exactly as if you had typed their address yourself."],

["Accounts are optional","You can use all of VialGrade without one. Create an account and we store your email address, the name you enter, your password as a hash (never the password itself), and your notification preferences. While you are signed in we also store what you save to your watchlist, what you put in a comparison, and a record of those actions, so the lists follow you between devices. Signed out, watchlists and comparisons stay in your own browser's local storage and never reach us."],

["Sign-in security records","Signing in creates a session row holding a request ID and a keyed hash of your IP address and user-agent — again, not the values themselves. Sign-in attempts and security-relevant account actions are recorded the same way. Unlike the visitor hash, these use a fixed key rather than a daily one, because being comparable over time is the point: they are what shows you your own active sessions and what lets us rate-limit password guessing. They are never used for analytics."],

["Push notifications","Only if you turn them on. Doing so stores the push endpoint your browser issues, the two keys needed to encrypt a message to it, and your browser's user-agent string. The endpoint belongs to your browser maker's push service — Apple, Google, or Mozilla — which necessarily handles the notification on its way to your device. Turning notifications off deletes the subscription."],

["Cookies","One: vial_session, set only when you sign in. It is HTTP-only, same-site strict, marked secure in production, and expires after twelve hours. There is no analytics cookie and no advertising cookie, and a signed-out visitor is set no cookie at all."],

["No third-party trackers","There is no Google Analytics, no advertising or conversion pixel, no session recorder, no A/B testing service, no embedded social, chat, or comment widget, and no third-party script of any kind on this site. Every record described here is written to our own database by our own code. Nothing about your activity is sold, and nothing is shared with advertisers, ad networks, or data brokers. Analytics records carry no account identifier, so they cannot be attached to a person even by us."],

["How long we keep things","Page views from real visitors are deleted after 400 days, and any recorded from crawlers after 30. Collector-run history is deleted after 60 days, source-reliability snapshots after 90, and operational metric snapshots after 30. Outbound click records are kept indefinitely: they are the evidence of how much demand VialGrade sent a vendor, and they hold a rotating hash rather than a person. Source snapshots, price history, and published catalog records are also kept indefinitely — they are the provenance behind public claims and contain nothing about you. Account data is kept until the account is deleted."],

["What we never collect","No payment or card details, because VialGrade never takes money. No health information, symptoms, prescriptions, or product-use history. No identity documents. No precise location. What you type into the verify tool is answered and not stored as a record of your activity; checking a vendor we have not seen before may cause us to fetch and save a copy of that vendor's public pages, which is a record about the vendor, not about you."],

["Where it is stored",`The site and its PostgreSQL database run on ${HOSTING_PROVIDER}, which processes data only to host the service. VialGrade does not transfer personal information to any other company.`],

["Your requests",`Email ${PRIVACY_EMAIL} for a copy of what is attached to your account, to correct it, or to delete it. There is no self-service delete button yet, so a person handles the request; we aim to reply within ${RESPONSE_TARGET_DAYS} days. Deleting an account removes the account records. It does not reach into page-view or click rows, because nothing in them identifies you or points back to an account.`],

["Changes","This page describes current behaviour, not intentions. If what the software collects changes, this page changes in the same release, and the date at the top moves with it."],

  ]} />;
}
