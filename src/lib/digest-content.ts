/**
 * Weekly "what changed" email. Pure: given registry rows it returns the message, or null when there
 * is nothing to say (an empty digest is never sent). Registry facts only: no result, safety,
 * quality or availability claim, and nothing about any individual reader.
 */
import type { TopicTrials } from "@/server/intelligence/public-trials";

export const DIGEST_CONSENT_VERSION = "digest-2026-11";
export const DIGEST_MAX_ITEMS = 20;

export type DigestChange = { compound: string; nctId: string; title: string; status: string; updated: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Registry rows whose posted-update date is on or after `since` (YYYY-MM-DD), newest first. */
export function selectDigestChanges(topics: readonly TopicTrials[], since: string): DigestChange[] {
  if (!ISO_DAY.test(since)) return [];
  const rows: DigestChange[] = [];
  for (const topic of topics) {
    if (topic.unavailable) continue;
    for (const study of topic.studies) {
      // A month-only registry date cannot be placed against a day cutoff, so it is not guessed.
      if (!study.lastUpdated || !ISO_DAY.test(study.lastUpdated) || study.lastUpdated < since) continue;
      rows.push({ compound: topic.label, nctId: study.nctId, title: study.title, status: study.status.replaceAll("_", " ").toLowerCase(), updated: study.lastUpdated });
    }
  }
  return rows.sort((a, b) => b.updated.localeCompare(a.updated) || a.nctId.localeCompare(b.nctId)).slice(0, DIGEST_MAX_ITEMS);
}

/** True only when every topic answered. A registry fault is not "nothing changed". */
export function allTopicsAnswered(topics: readonly TopicTrials[]): boolean {
  return topics.length > 0 && topics.every(t => !t.unavailable);
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export function buildDigest(input: { changes: readonly DigestChange[]; siteUrl: string; unsubscribeUrl: string; since: string }) {
  if (input.changes.length === 0) return null;
  const { changes, siteUrl, unsubscribeUrl, since } = input;
  const link = (c: DigestChange) => siteUrl + "/intelligence/studies/" + c.nctId;
  const subject = changes.length === 1 ? "VialGrade: 1 registry record updated" : "VialGrade: " + changes.length + " registry records updated";
  const intro = "These ClinicalTrials.gov records changed since " + since + ". An update means the record was edited, not that a study produced a result.";
  const foot = "You get this because you asked for the VialGrade update email. It holds only your address. Unsubscribe and delete it any time: " + unsubscribeUrl;
  const text = [intro, "", ...changes.map(c => "- " + c.compound + " | " + c.nctId + " | " + c.title + " | status: " + c.status + " | record updated " + c.updated + "\n  " + link(c)), "", foot].join("\n");
  const html = "<p>" + esc(intro) + "</p><ul>" + changes.map(c =>
    '<li><a href="' + esc(link(c)) + '">' + esc(c.nctId) + "</a> · " + esc(c.compound) + " · " + esc(c.title) + " · status: " + esc(c.status) + " · record updated " + esc(c.updated) + "</li>").join("") +
    '</ul><p style="color:#666;font-size:12px">' + esc("You get this because you asked for the VialGrade update email. It holds only your address.") +
    ' <a href="' + esc(unsubscribeUrl) + '">Unsubscribe and delete my address</a>.</p>';
  return { subject, text, html };
}

export function confirmationEmail(confirmUrl: string) {
  const text = "Someone, hopefully you, asked for the VialGrade update email: a weekly note when a ClinicalTrials.gov record we track changes. It holds only your email address.\n\nConfirm here: " + confirmUrl + "\n\nIf this was not you, ignore this message. The request is deleted automatically after 3 days and nothing is sent.";
  const html = "<p>" + esc("Someone, hopefully you, asked for the VialGrade update email: a weekly note when a ClinicalTrials.gov record we track changes. It holds only your email address.") + '</p><p><a href="' + esc(confirmUrl) + '">Confirm my email address</a></p><p style="color:#666;font-size:12px">' + esc("If this was not you, ignore this message. The request is deleted automatically after 3 days and nothing is sent.") + "</p>";
  return { subject: "Confirm your VialGrade update email", text, html };
}
