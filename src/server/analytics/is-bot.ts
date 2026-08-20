// Telling a crawler from a buyer.
//
// This matters more here than on a normal site. "We sent you 676 buyers" is the claim the whole
// business rests on — and the first thing a vendor does is check their own analytics. If our number
// is inflated with crawler hits, theirs will be far lower and the conversation is over, along with
// our credibility. An inflated number is worse than a small honest one.
//
// Erring toward EXCLUDING is deliberate: under-counting real people costs us a slightly smaller
// number; over-counting costs us the deal.

// Substrings that appear in the user-agent of automated clients. Lowercased before matching.
// Nothing here is ambiguous: no real browser sends any of these.
const BOT_SIGNATURES = [
  "bot", "crawler", "spider", "scraper", "slurp",
  "googlebot", "bingbot", "yandex", "baiduspider", "duckduckbot", "applebot",
  "gptbot", "chatgpt", "claudebot", "anthropic", "perplexity", "ccbot", "bytespider",
  "ahrefs", "semrush", "mj12", "dotbot", "petalbot", "dataforseo", "screaming frog",
  "facebookexternalhit", "twitterbot", "slackbot", "discordbot", "linkedinbot",
  "telegrambot", "embedly", "quora link preview", "redditbot",
  "curl/", "wget", "python-requests", "python-urllib", "go-http-client", "java/", "okhttp",
  "axios/", "node-fetch", "got/", "libwww-perl", "httpclient", "postman", "insomnia",
  "headlesschrome", "phantomjs", "playwright", "puppeteer", "selenium",
  "uptime", "pingdom", "statuscake", "monitoring", "healthcheck", "lighthouse",
  "validator", "feedfetcher", "vialgrade-",
];

/**
 * App names that appear in BOTH a link-preview crawler and a real in-app browser.
 *
 * Tapping a VialGrade link inside WhatsApp or Pinterest opens a WebView that puts the app's name in
 * an otherwise ordinary browser user-agent. Matching the bare substring dropped those readers
 * entirely — and marked their outbound clicks as bot traffic, so real demand never reached the
 * figure we show a vendor. Social apps are exactly where peptide links get shared, so this was
 * silently deleting the traffic we most want to prove.
 *
 * These count as automated ONLY when the agent is not also a full browser.
 */
const APP_SIGNATURES = ["whatsapp", "pinterest", "preview"];

/** A browser engine token plus the Mozilla preamble — what a WebView sends and a crawler does not. */
function looksLikeFullBrowser(ua: string): boolean {
  return ua.includes("mozilla/5.0") && /safari|chrome|firefox|gecko|applewebkit/.test(ua);
}

/**
 * True when a request almost certainly is not a person.
 *
 * A MISSING user-agent counts as a bot. Real browsers always send one; its absence means a script,
 * a scanner, or a synthetic request. That single rule removes most of the noise — and it is also
 * why our own verification traffic never inflated the figures.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim().toLowerCase();
  if (!ua) return true;
  // A real browser UA is long and mentions a rendering engine. Very short ones are tooling.
  if (ua.length < 16) return true;
  if (BOT_SIGNATURES.some(sig => ua.includes(sig))) return true;
  // Checked last, and only for agents that are not full browsers, so a crawler carrying one of
  // these names is still caught by the unambiguous list above.
  return APP_SIGNATURES.some(sig => ua.includes(sig)) && !looksLikeFullBrowser(ua);
}

/**
 * True when the request looks like a real browser we can attribute a person to.
 *
 * Requires BOTH a non-bot user-agent and a client address — without an address every visitor hashes
 * identically, which is how 676 clicks once collapsed into "1 distinct person".
 */
export function isAttributableVisitor(userAgent: string | null | undefined, ip: string | null | undefined): boolean {
  if (isBotUserAgent(userAgent)) return false;
  return Boolean(ip && ip.trim());
}
