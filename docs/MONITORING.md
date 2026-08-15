# Knowing when VialGrade breaks

On 14 August 2026 the site returned a server error on every page for several hours. Nobody noticed
until someone happened to load it. There was no monitoring of any kind: client errors died in the
visitor's own browser console, and server errors went to Vercel function logs nobody reads.

This document is how that gets caught next time. Two pieces, both free, about five minutes total.

## 1. Alerts to your phone — one environment variable

Errors are always written to Vercel's logs as single-line JSON, with no setup. To also get a push
notification, set `VIALGRADE_ALERT_WEBHOOK` to a Discord or Slack webhook URL.

**Discord** (easiest, and the notification lands on your phone):
1. Open any Discord server you own → pick or create a channel, e.g. `#vialgrade-alerts`
2. Channel name → **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook**
3. **Copy Webhook URL**

**Slack:** create an app at `api.slack.com/apps` → **Incoming Webhooks** → on → **Add New Webhook to
Workspace** → copy the URL.

Then add it to Vercel:

```
vercel env add VIALGRADE_ALERT_WEBHOOK production
# paste the URL when prompted, then redeploy
```

One URL works for either service — the payload carries both `content` (Discord) and `text` (Slack),
and each ignores the other's key.

### What you will and will not receive

Alerts fire on real degradation: the catalog becoming unreadable (which is what a database outage
looks like), a directory failing to load, and unhandled errors in the browser.

**Identical failures are collapsed to one message per 15 minutes.** This is deliberate and is the
most important property of the whole system. During the August outage every single request would
have alerted — thousands of messages, which means you mute the channel, which means you miss the
next real incident. Different failures are throttled separately, and a `critical` is never
suppressed by an earlier warning of the same kind.

If nothing is configured, nothing is sent and nothing breaks. The logging still happens.

## 2. Uptime checking — the one that actually catches an outage

Alerting only fires when the app runs well enough to report. If the whole deployment is down, or the
database is unreachable before any page renders, nothing sends. You need something *outside* Vercel
watching from the internet.

Use any free uptime monitor (UptimeRobot's free tier checks every 5 minutes and is enough):

- **URL to watch:** `https://vialgrade.com/api/health/ready`
- **Alert when:** the response is not HTTP 200
- **Send to:** your phone, and an email you actually read

That endpoint reports `status: ready` only when the database genuinely answers, so it catches the
exact failure that happened — the site "up" in the sense that Vercel is serving, while every page is
degraded because the data layer is gone.

Check `/api/health/ready` rather than the homepage: since the outage, the homepage deliberately
returns a friendly 200 with a "live data unavailable" notice rather than an error, so a homepage
check would report healthy during precisely the incident you want to hear about.

## 3. Reading the logs

Every alert is also a structured log line. In the Vercel dashboard → **Logs**, filter for a `kind`:

| kind | means |
| --- | --- |
| `catalog-unavailable` | root layout could not read the catalog — every page degraded |
| `home-catalog-unavailable` | homepage showing the data-unavailable notice |
| `compounds-unavailable` / `vendors-unavailable` / `passports-unavailable` | that directory failed |
| `client-error` | an error in a visitor's browser |

## What is deliberately not here

No Sentry, no PostHog, no third-party tracker. The site currently loads **zero** third-party scripts,
which removes an entire class of privacy exposure and is worth keeping. If exception grouping and
release tracking are ever genuinely needed, add Sentry then — but a dashboard nobody opens is not
monitoring, and a notification you actually see is.
